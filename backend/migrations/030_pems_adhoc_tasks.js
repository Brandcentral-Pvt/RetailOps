/**
 * Migration 030: ad-hoc (template-less) PEMS tasks + rule-task query support.
 *
 * Why this exists
 * ---------------
 * The ruleset engine creates tasks without a template (ad-hoc). pemsService.createInstance
 * guards the template LOOKUP when templateId is missing, but it still inserted NULL into
 * PemsTaskInstances.TemplateId, which was NOT NULL. Every single ruleset "create_task"
 * action therefore threw:
 *
 *   Cannot insert the value NULL into column 'TemplateId',
 *   table 'retailops.dbo.PemsTaskInstances'
 *
 * rulesetEngineService swallowed that in a try/catch and fell back to the legacy Actions
 * table. A single ruleset run over the ~188k-row Asins table created 221,665 rows there,
 * all Type='automated' / Status='PENDING'. The Tasks page then loaded every one of them
 * (pemsService.getInstances prepends open rule tasks with no LIMIT), which is what made
 * the page unusable.
 *
 * This migration:
 *   1. Makes TemplateId nullable so ad-hoc tasks land in PEMS where they belong.
 *      SQL Server refuses ALTER COLUMN while an index or a foreign key references the
 *      column, so those are dropped and rebuilt around the ALTER.
 *   2. Adds the index the open-rule-task lookup needs so that query stays cheap even
 *      while the legacy Actions backlog is being cleaned up.
 *   3. Adds a filtered index so the ruleset engine's duplicate guard is a seek.
 */
module.exports = {
  up: async (pool) => {
    const q = (s) => pool.request().query(s);

    const tableExists = async (t) => {
      const r = await q(`SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='${t}'`);
      return r.recordset.length > 0;
    };
    const indexExists = async (name, table) => {
      // Must be scoped to the table: index names are only unique per table, so an
      // unscoped lookup happily "finds" IX_PemsInstance_Template on some other table
      // and skips creating the one PemsTaskInstances needs.
      const r = table
        ? await q(`SELECT 1 AS ok FROM sys.indexes WHERE name='${name}' AND object_id=OBJECT_ID('dbo.${table}')`)
        : await q(`SELECT 1 AS ok FROM sys.indexes WHERE name='${name}'`);
      return r.recordset.length > 0;
    };
    const ensureIndex = async (name, keys, includes) => {
      if (await indexExists(name, 'PemsTaskInstances')) return;
      // The INCLUDE lists below were written when this table had a wider column set;
      // later PEMS migrations (027-029) renamed/dropped some of them. Filter the
      // include list down to columns that actually exist, and refuse to guess on keys.
      const colRes = await q(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='PemsTaskInstances'`);
      const cols = new Set(colRes.recordset.map((r) => r.COLUMN_NAME));
      const missingKeys = keys.filter((k) => !cols.has(k.split(' ')[0]));
      if (missingKeys.length) {
        console.log(`[Migration 030] ⏭ skip ${name}: missing key column(s) ${missingKeys.join(', ')}`);
        return;
      }
      let ddl = `CREATE INDEX ${name} ON dbo.PemsTaskInstances(${keys.join(', ')})`;
      const inc = (includes || []).filter((c) => cols.has(c));
      if (inc.length) ddl += ` INCLUDE (${inc.join(', ')})`;
      await q(`${ddl};`);
      console.log(`[Migration 030] ✅ ${name} created`);
    };

    // ── 1. Allow template-less task instances ────────────────────────────────
    const col = await q(`
      SELECT c.is_nullable, t.name AS type_name, c.max_length
      FROM sys.columns c
      JOIN sys.types t ON t.user_type_id = c.user_type_id
      WHERE c.object_id = OBJECT_ID('dbo.PemsTaskInstances') AND c.name = 'TemplateId'
    `);
    const templateId = col.recordset[0];

    // The mssql driver maps sys.columns.is_nullable (char(1) 'YES'/'NO') to a JS
    // boolean, so a bare `=== 'NO'` comparison reports NOT NULL columns as already
    // nullable and silently skips the ALTER. Accept every shape.
    const isNotNull = (v) => v === false || v === 'NO' || v === 0 || v === 'no';

    // Indexes that must exist once we're done. IX_PemsInstance_Template backs the FK;
    // IX_PemsTaskInstances_Template_Status_Covering comes from migration 008.
    const TEMPLATE_INDEXES = [
      { name: 'IX_PemsInstance_Template', keys: ['TemplateId'], includes: [] },
      { name: 'IX_PemsTaskInstances_Template_Status_Covering',
        keys: ['TemplateId', 'Status'],
        includes: ['AssigneeId', 'ReviewerId', 'DueDate', 'Priority', 'SlaHours', 'IsEscalated', 'CreatedAt'] },
    ];

    if (!templateId) {
      console.log('[Migration 030] ⏭ PemsTaskInstances.TemplateId not present — skipped');
    } else if (isNotNull(templateId.is_nullable)) {
      // Capture every index that references the column so we can rebuild it verbatim.
      // NOTE: also match indexes whose FILTER PREDICATE mentions TemplateId (e.g. the
      // filtered dedupe index below). Those never appear in sys.index_columns for that
      // column, yet they still block ALTER COLUMN — that is what made the first run of
      // this migration fail with error 4922 while sys.indexes looked innocent.
      const dep = await q(`
        SELECT DISTINCT i.name AS IndexName
        FROM sys.indexes i
        LEFT JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        LEFT JOIN sys.columns c ON c.object_id = i.object_id AND c.column_id = ic.column_id
        WHERE i.object_id = OBJECT_ID('dbo.PemsTaskInstances')
          AND i.name IS NOT NULL
          AND (c.name = 'TemplateId' OR i.filter_definition LIKE '%TemplateId%')
      `);
      const names = dep.recordset.map((r) => r.IndexName);

      const shapes = new Map();
      for (const name of names) {
        const detail = await q(`
          SELECT i.is_unique AS IsUnique, c.name AS ColumnName,
                 ic.is_included_column AS IsIncluded, ic.is_descending_key AS IsDesc
          FROM sys.indexes i
          JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
          JOIN sys.columns c ON c.object_id = i.object_id AND c.column_id = ic.column_id
          WHERE i.object_id = OBJECT_ID('dbo.PemsTaskInstances') AND i.name = '${name}'
          ORDER BY ic.is_included_column, ic.key_ordinal
        `);
        if (!detail.recordset.length) continue;
        shapes.set(name, { unique: !!detail.recordset[0].IsUnique, keys: [], includes: [] });
        for (const row of detail.recordset) {
          const s = shapes.get(name);
          if (row.IsIncluded) s.includes.push(row.ColumnName);
          else s.keys.push(`${row.ColumnName}${row.IsDesc ? ' DESC' : ''}`);
        }
      }
      for (const name of shapes.keys()) {
        await q(`DROP INDEX ${name} ON dbo.PemsTaskInstances;`);
      }
      if (shapes.size) console.log(`[Migration 030] 🔧 dropped ${shapes.size} index(es) on TemplateId: ${[...shapes.keys()].join(', ')}`);

      // The foreign key also blocks ALTER COLUMN.
      const fks = await q(`
        SELECT fk.name
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
        JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
        WHERE fk.parent_object_id = OBJECT_ID('dbo.PemsTaskInstances') AND c.name = 'TemplateId'
      `);
      for (const fk of fks.recordset) {
        await q(`ALTER TABLE dbo.PemsTaskInstances DROP CONSTRAINT ${fk.name};`);
        console.log(`[Migration 030] 🔧 dropped FK ${fk.name}`);
      }

      await q(`ALTER TABLE dbo.PemsTaskInstances ALTER COLUMN TemplateId ${templateId.type_name}${
        templateId.max_length === -1 ? '(MAX)' : `(${templateId.max_length})`
      } NULL;`);
      console.log('[Migration 030] ✅ PemsTaskInstances.TemplateId is now NULL-able');

      for (const fk of fks.recordset) {
        await q(`ALTER TABLE dbo.PemsTaskInstances WITH CHECK ADD CONSTRAINT ${fk.name}
                 FOREIGN KEY (TemplateId) REFERENCES dbo.PemsTaskTemplates(Id);`);
        console.log(`[Migration 030] 🔧 restored FK ${fk.name}`);
      }
      for (const [name, s] of shapes) {
        let ddl = `CREATE ${s.unique ? 'UNIQUE ' : ''}INDEX ${name} ON dbo.PemsTaskInstances(${s.keys.join(', ')})`;
        if (s.includes.length) ddl += ` INCLUDE (${s.includes.join(', ')})`;
        await q(`${ddl};`);
        console.log(`[Migration 030] 🔧 rebuilt ${name}`);
      }
    } else {
      console.log('[Migration 030] ⏭ PemsTaskInstances.TemplateId already NULL-able');
    }

    // Make sure the TemplateId indexes and the template FK are present even if a
    // previous partial run of this migration dropped them (the drop/alter/rebuild
    // sequence is not atomic, so a crash mid-way would otherwise leave them missing).
    if (await tableExists('PemsTaskInstances')) {
      for (const spec of TEMPLATE_INDEXES) await ensureIndex(spec.name, spec.keys, spec.includes);
      const fkExists = await q(`SELECT 1 AS ok FROM sys.foreign_keys WHERE name='FK_PemsInstance_Template'`);
      if (!fkExists.recordset.length) {
        await q(`ALTER TABLE dbo.PemsTaskInstances WITH CHECK ADD CONSTRAINT FK_PemsInstance_Template
                 FOREIGN KEY (TemplateId) REFERENCES dbo.PemsTaskTemplates(Id);`);
        console.log('[Migration 030] ✅ FK_PemsInstance_Template restored');
      }
    }

    // ── 2. Index for the open rule-task lookup ───────────────────────────────
    // getInstances() filters Type='automated' AND Status IN ('PENDING','IN_PROGRESS')
    // and orders by CreatedAt DESC. Without this it is a full scan + sort.
    if (await tableExists('Actions')) {
      if (await indexExists('IX_Actions_OpenAutomated', 'Actions')) {
        console.log('[Migration 030] ⏭ IX_Actions_OpenAutomated already present');
      } else {
        await q(`
          CREATE INDEX IX_Actions_OpenAutomated ON dbo.Actions(Type, Status, CreatedAt DESC)
          INCLUDE (Id, Title, Priority, SellerId, AssignedTo, DueDate, Description, Asins, SubTasks, SubTaskProgress, Category)
        `);
        console.log('[Migration 030] ✅ IX_Actions_OpenAutomated created');
      }
    } else {
      console.log('[Migration 030] ⏭ Actions table absent — index skipped');
    }

    // ── 3. Ruleset duplicate guard ───────────────────────────────────────────
    // The ruleset engine dedupes open ad-hoc tasks on (SourceId, SourceRef);
    // this filtered index makes that lookup a seek instead of a scan.
    // The predicate deliberately does NOT mention TemplateId: a filtered index that
    // references a column in its predicate blocks ALTER COLUMN on that column
    // (error 4922), which would make any future TemplateId change painful.
    if (await tableExists('PemsTaskInstances')) {
      if (await indexExists('IX_PemsTaskInstances_RulesetDedupe', 'PemsTaskInstances')) {
        console.log('[Migration 030] ⏭ IX_PemsTaskInstances_RulesetDedupe already present');
      } else {
        await q(`
          CREATE INDEX IX_PemsTaskInstances_RulesetDedupe
          ON dbo.PemsTaskInstances(SourceId, SourceRef, Status)
          INCLUDE (Id, Title, SellerId, Asins, TemplateId)
          WHERE Source = 'RULESET'
        `);
        console.log('[Migration 030] ✅ IX_PemsTaskInstances_RulesetDedupe created');
      }
    }
  },
};
