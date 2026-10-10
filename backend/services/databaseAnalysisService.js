/**
 * Database Analysis Service - Text-to-SQL & Data Intelligence
 * 
 * Provides natural language to SQL conversion, data analysis, and insights
 * using the APINEX.BOND AI models.
 */

const apinexService = require('./apinexBondService');
const { sql, getPool } = require('../database/db');

/**
 * Database schema cache for text-to-SQL
 */
const SCHEMA_CACHE_KEY = 'database_schema_cache';
let schemaCache = null;
let schemaCacheTime = 0;
const SCHEMA_CACHE_TTL = 300000; // 5 minutes

/**
 * Get database schema for text-to-SQL context
 */
async function getDatabaseSchema(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && schemaCache && (now - schemaCacheTime) < SCHEMA_CACHE_TTL) {
    return schemaCache;
  }

  const pool = await getPool();
  
  // Get all tables and columns
  const tablesResult = await pool.request().query(`
    SELECT 
      TABLE_NAME,
      COLUMN_NAME,
      DATA_TYPE,
      IS_NULLABLE,
      COLUMN_DEFAULT,
      CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);

  // Get foreign keys
  const fkResult = await pool.request().query(`
    SELECT 
      fk.name AS FK_Name,
      OBJECT_NAME(fk.parent_object_id) AS TableName,
      COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS ColumnName,
      OBJECT_NAME(fk.referenced_object_id) AS ReferencedTableName,
      COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS ReferencedColumnName
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    WHERE fk.is_disabled = 0
  `);

  // Build schema string
  const tables = {};
  for (const row of tablesResult.recordset) {
    if (!tables[row.TABLE_NAME]) {
      tables[row.TABLE_NAME] = { columns: [], description: '' };
    }
    tables[row.TABLE_NAME].columns.push({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE,
      nullable: row.IS_NULLABLE === 'YES',
      default: row.COLUMN_DEFAULT,
      maxLength: row.CHARACTER_MAXIMUM_LENGTH,
    });
  }

  const fks = {};
  for (const row of fkResult.recordset) {
    if (!fks[row.TableName]) {
      fks[row.TableName] = [];
    }
    fks[row.TableName].push({
      column: row.ColumnName,
      referencedTable: row.ReferencedTableName,
      referencedColumn: row.ReferencedColumnName,
    });
  }

  // Build schema string
  let schemaString = 'DATABASE SCHEMA:\n\n';
  
  for (const [tableName, table] of Object.entries(tables)) {
    schemaString += `TABLE: ${tableName}\n`;
    for (const col of table.columns) {
      const nullable = col.nullable ? 'NULL' : 'NOT NULL';
      const defaultVal = col.default ? ` DEFAULT ${col.default}` : '';
      const length = col.maxLength ? `(${col.maxLength})` : '';
      schemaString += `  ${col.name} ${col.type}${length} ${nullable}${defaultVal}\n`;
    }
    
    if (fks[tableName]) {
      for (const fk of fks[tableName]) {
        schemaString += `  FK: ${fk.column} -> ${fk.referencedTable}.${fk.referencedColumn}\n`;
      }
    }
    schemaString += '\n';
  }

  schemaCache = schemaString;
  schemaCacheTime = Date.now();
  return schemaString;
}

/**
 * Invalidate schema cache
 */
function invalidateSchemaCache() {
  schemaCache = null;
  schemaCacheTime = 0;
}

/**
 * Convert natural language to SQL
 */
async function naturalLanguageToSQL(question, options = {}) {
  const schema = await getDatabaseSchema();
  
  const systemPrompt = `You are an expert SQL analyst for a RetailOps e-commerce platform database.
Convert the user's natural language question into a valid, optimized SQL Server (T-SQL) query.

DATABASE SCHEMA:
${schema}

RULES:
1. Return ONLY the SQL query - no explanations, no markdown
2. Use proper T-SQL syntax (TOP instead of LIMIT, etc.)
3. Use proper table aliases and JOINs
4. Use proper WHERE clauses with proper date handling
5. Always use table aliases
6. Use proper date functions: DATEADD, DATEDIFF, GETDATE()
7. Handle NULL values with ISNULL/COALESCE
8. Use ONLY table and column names that appear in DATABASE SCHEMA - never invent names
9. For relative dates: use DATEADD(day, -N, GETDATE()) pattern
10. Return ONLY the SQL query - no explanations, no markdown code fences
11. If the question cannot be answered with SQL, return: -- ERROR: Cannot answer with SQL

Examples:
Q: "Show me total sales by seller for last 30 days"
A: SELECT s.Name, SUM(t.Amount) as TotalSales FROM PemsTaskInstances ti JOIN Sellers s ON ti.SellerId = s.Id WHERE ti.CreatedAt >= DATEADD(day, -30, GETDATE()) AND ti.Status = 'APPROVED' GROUP BY s.Name ORDER BY TotalSales DESC

Q: "Top 10 products by revenue"
A: SELECT TOP 10 p.Name, SUM(oi.Quantity * oi.UnitPrice) as Revenue FROM OrderItems oi JOIN Products p ON oi.ProductId = p.Id GROUP BY p.Name ORDER BY Revenue DESC`;

  const userPrompt = `Question: ${question}`;

  // Use a capable model for SQL generation
  const result = await apinexService.structuredChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], {
    ...options,
    type: 'object',
    properties: {
      sql: { type: 'string' },
      explanation: { type: 'string' },
      confidence: { type: 'number' },
    },
    required: ['sql', 'explanation'],
  });

  return result;
}

/**
 * Execute a SQL query safely
 */
async function executeQuery(sql, params = {}) {
  const pool = await getPool();
  const request = pool.request();
  
  // Add parameters
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }
  
  try {
    const result = await request.query(sql);
    return { success: true, data: result.recordset, rowsAffected: result.rowsAffected };
  } catch (error) {
    return { success: false, error: error.message, sql };
  }
}

/**
 * Execute natural language query and return results
 */
async function queryDatabase(question, options = {}) {
  try {
    // Convert to SQL
    const { sql, explanation, confidence } = await naturalLanguageToSQL(question, options);
    
    // Execute query
    const result = await executeQuery(sql);
    
    if (!result.success) {
      return { success: false, error: result.error, sql: result.sql };
    }

    // Generate insights if requested
    let insights = null;
    if (options.generateInsights && result.data?.length > 0) {
      insights = await generateDataInsights(question, result.data);
    }

    return {
      success: true,
      sql,
      explanation,
      confidence,
      data: result.data,
      rowCount: result.data.length,
      insights,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate insights from query results
 */
async function generateDataInsights(question, data, options = {}) {
  try {
    const sampleData = data.slice(0, 100); // Limit for token efficiency
    
    const result = await apinexService.analyzeData(sampleData, question, {
      ...options,
      model: options.model || 'free/gpt-6-luna',
    });

    return {
      answer: result.answer,
      insights: result.insights || [],
      visualization: result.visualization || null,
      recommendations: result.recommendations || [],
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Generate business insights from data
 */
async function generateBusinessInsights(data, context = '', options = {}) {
  try {
    return await apinexService.generateInsights(data, context, options);
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get database schema info for UI
 */
async function getSchemaInfo() {
  const schema = await getDatabaseSchema();
  
  const pool = await getPool();
  const tablesResult = await pool.request().query(`
    SELECT 
      TABLE_NAME,
      COUNT(*) as ColumnCount
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
    GROUP BY TABLE_NAME
    ORDER BY TABLE_NAME
  `);

  return {
    schema: schema,
    tables: tablesResult.recordset,
    totalTables: tablesResult.recordset.length,
  };
}

/**
 * Get sample data from a table for context
 */
async function getTableSample(tableName, limit = 10) {
  const pool = await getPool();
  const result = await pool.request()
    .input('tableName', sql.NVarChar, tableName)
    .query(`
      SELECT TOP (@limit) * FROM ${tableName}
    `);
  
  return result.recordset;
}

/**
 * Analyze table statistics
 */
async function analyzeTable(tableName) {
  const pool = await getPool();
  
  // Get row count
  const countResult = await pool.request()
    .input('tableName', sql.NVarChar, tableName)
    .query(`SELECT COUNT(*) as rowCount FROM ${tableName}`);
  
  // Get column stats
  const columnsResult = await pool.request()
    .input('tableName', sql.NVarChar, tableName)
    .query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName
    `);

  return {
    tableName,
    rowCount: countResult.recordset[0]?.rowCount || 0,
    columns: columnsResult.recordset,
  };
}

module.exports = {
  getDatabaseSchema,
  invalidateSchemaCache,
  naturalLanguageToSQL,
  executeQuery,
  queryDatabase,
  generateDataInsights,
  generateBusinessInsights,
  getSchemaInfo,
  getTableSample,
  analyzeTable,
};