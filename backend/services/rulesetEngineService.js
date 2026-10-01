const { sql, getPool, generateId } = require('../database/db');

const DATE_RANGE_MAP = {
  'Last 7 days': 7,
  'Last 14 days': 14,
  'Last 30 days': 30,
  'Last 60 days': 60,
  'Last 90 days': 90,
};

const EXCLUDE_DAYS_MAP = {
  'Latest day': 1,
  'Latest 2 days': 2,
  'Latest 3 days': 3,
  'None': 0
};

async function getEntityData(type, sellerId, dateRange, excludeDays, hasTotalOrders = true, sqlFilter = '', filterParams = {}, sharedPool = null) {
  const pool = sharedPool || await getPool();

  if (type === 'ASIN' || type === 'Product') {
    let query = `SELECT 
      a.AsinCode, a.Title, a.Status, a.SellerId, a.Category, a.Brand,
      a.CurrentPrice, a.UploadedPrice, a.Mrp, a.DiscountPercentage,
      a.BSR, a.SubBsr, a.Rating, a.ReviewCount,
      a.LQS, a.TitleScore, a.BulletScore, a.ImageScore, a.DescriptionScore,
      a.ImagesCount, a.BulletPoints, a.HasAplus, a.BuyBoxWin,
      a.AvailabilityStatus, a.StockLevel,
      a.PriceDispute, a.HasDeal, a.DealBadge,
      a.BsrTrend, a.RatingTrend,
      a.Tags, a.SoldBy, a.Manufacturer,
      ${hasTotalOrders ? `(SELECT SUM(ISNULL(OrderedUnits, 0)) FROM GmsDailyPerformance WITH (NOLOCK) WHERE Asin = a.AsinCode)` : '0'} as totalOrders
    FROM Asins a WITH (NOLOCK)
    WHERE a.Status IN ('Active', 'Error') ${sqlFilter}`;
    
    const request = pool.request();
    if (sellerId) {
      query += ' AND a.SellerId = @sellerId';
      request.input('sellerId', sql.VarChar, sellerId);
    }
    
    // Bind parameterized filter params
    for (const [key, val] of Object.entries(filterParams)) {
      if (typeof val === 'number') {
        request.input(key, sql.Decimal(18, 4), val);
      } else {
        request.input(key, sql.NVarChar, String(val));
      }
    }

    const result = await request.query(query);
    
    return result.recordset.map(asin => {
      let tags = [];
      try { tags = JSON.parse(asin.Tags || '[]'); } catch (e) { tags = []; }

      return {
        asinCode: asin.AsinCode,
        title: asin.Title || '',
        seller: asin.SellerId || '',
        category: asin.Category || '',
        brand: asin.Brand || '',
        status: asin.Status || 'Active',
        tags: tags,

        // Price & Buybox
        currentPrice: asin.CurrentPrice || 0,
        uploadedPrice: asin.UploadedPrice || 0,
        mrp: asin.Mrp || 0,
        discountPercentage: asin.DiscountPercentage || 0,
        priceDispute: asin.PriceDispute === 1 || asin.PriceDispute === true,
        buyBoxWin: asin.BuyBoxWin === 1 || asin.BuyBoxWin === true,
        hasDeal: asin.HasDeal === 1 || asin.HasDeal === true,
        dealBadge: asin.DealBadge || '',

        // Listing Quality
        lqs: asin.LQS || 0,
        titleScore: asin.TitleScore || 0,
        bulletScore: asin.BulletScore || 0,
        imageScore: asin.ImageScore || 0,
        descriptionScore: asin.DescriptionScore || 0,
        imagesCount: asin.ImagesCount || 0,
        bulletPoints: asin.BulletPoints || 0,
        hasAplus: asin.HasAplus === 1 || asin.HasAplus === true,

        // Performance
        bsr: asin.BSR || 0,
        subBsr: asin.SubBsr || 0,
        rating: asin.Rating || 0,
        reviewCount: asin.ReviewCount || 0,
        bsrTrend: asin.BsrTrend || 'Stable',
        ratingTrend: asin.RatingTrend || 'Stable',
        totalOrders: asin.totalOrders || 0,

        // Inventory
        stockLevel: asin.StockLevel || 0,
        availabilityStatus: asin.AvailabilityStatus || 'Available',

        // Ads
        ads: asin.Ads ? 1 : 0,
        adsActive: asin.Ads === 1 || asin.Ads === true,
      };
    });
  }

  return [];
}

function evaluateCondition(condition, entity) {
  const { attribute, operator, value, value2 } = condition;
  const entityValue = entity[attribute];

  if (entityValue === undefined || entityValue === null) {
    if (operator === 'is empty') return true;
    if (operator === 'is not empty') return false;
    return false;
  }

  // ── Boolean attributes (only when both sides are actually boolean) ──
  const isEntityBool = typeof entityValue === 'boolean' || entityValue === 1 || entityValue === 0;
  const boolValues = ['true', 'false', true, false, 1, 0, 'Yes', 'No', 'yes', 'no', 'Y', 'N', 'y', 'n'];
  if (isEntityBool && boolValues.includes(value)) {
    const boolVal = value === 'true' || value === true || value === 1 || value === 'Yes' || value === 'yes' || value === 'Y' || value === 'y';
    const currentBool = entityValue === true || entityValue === 1;
    if (operator === '=' || operator === 'is') return currentBool === boolVal;
    if (operator === '≠' || operator === 'is not') return currentBool !== boolVal;
    return false;
  }

  // ── List (tags array) ──
  if (Array.isArray(entityValue)) {
    const valStr = String(value).toLowerCase();
    switch (operator) {
      case 'contains': return entityValue.some(v => String(v).toLowerCase().includes(valStr));
      case 'not contains': return !entityValue.some(v => String(v).toLowerCase().includes(valStr));
      case '=': return entityValue.some(v => String(v).toLowerCase() === valStr);
      case '≠': return !entityValue.some(v => String(v).toLowerCase() === valStr);
      case 'is empty': return entityValue.length === 0;
      case 'is not empty': return entityValue.length > 0;
      default: return false;
    }
  }

  // ── Enum / text ──
  if (typeof entityValue === 'string') {
    const ev = entityValue.toLowerCase();
    const v = String(value ?? '').toLowerCase();
    switch (operator) {
      case '=': return ev === v;
      case '≠': return ev !== v;
      case 'contains': return ev.includes(v);
      case 'not contains': return !ev.includes(v);
      case 'starts with': return ev.startsWith(v);
      case 'is empty': return ev.trim() === '';
      case 'is not empty': return ev.trim() !== '';
      default: return false;
    }
  }

  // ── Number ──
  const numVal = Number(entityValue);
  const targetVal = Number(value);
  const targetVal2 = Number(value2);

  if (operator === 'is empty') return numVal === 0 || isNaN(numVal);
  if (operator === 'is not empty') return numVal !== 0 && !isNaN(numVal);
  if (isNaN(targetVal)) return false;

  switch (operator) {
    case '=': return numVal === targetVal;
    case '≠': return numVal !== targetVal;
    case '<': return numVal < targetVal;
    case '<=': return numVal <= targetVal;
    case '>': return numVal > targetVal;
    case '>=': return numVal >= targetVal;
    case 'between': return !isNaN(targetVal2) && numVal >= targetVal && numVal <= targetVal2;
    default: return false;
  }
}

function evaluateRule(rule, entity) {
  if (!rule.isActive || !rule.conditions || rule.conditions.length === 0) {
    return false;
  }

  // Evaluate with proper AND/OR logic (left-to-right, respecting logicalOp on each condition)
  let result = evaluateCondition(rule.conditions[0], entity);

  for (let i = 1; i < rule.conditions.length; i++) {
    const condition = rule.conditions[i];
    const condResult = evaluateCondition(condition, entity);
    const op = condition.logicalOp || 'AND';

    if (op === 'AND') {
      result = result && condResult;
    } else {
      result = result || condResult;
    }
  }

  return result;
}

async function applyAction(entity, action, type, sellerId, userId, matchedRule = null, rulesetMeta = null) {
  const results = [];
  const pool = await getPool();

  // Map action.priority to PEMS priority (CRITICAL/HIGH/MEDIUM/LOW)
  const pemsPriority = (p) => {
    const m = { Critical: 'CRITICAL', High: 'HIGH', Medium: 'MEDIUM', Low: 'LOW', critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };
    return m[p] || 'MEDIUM';
  };
  const mapCategory = (attr) => {
    if (/price|buyBox|mrp|discount|deal/i.test(attr || '')) return 'PRICING';
    if (/lqs|title|bullet|image|description|aplus/i.test(attr || '')) return 'LISTING';
    if (/stock|availability|inventory/i.test(attr || '')) return 'INVENTORY';
    if (/bsr|rating|review|order/i.test(attr || '')) return 'GENERAL';
    return 'GENERAL';
  };

  switch (action.actionType) {
    case 'send_email':
    case 'send_notification': {
      try {
        const id = generateId();
        const ruleName = matchedRule?.name || 'Ruleset Rule';
        const asinCode = entity.asinCode || 'Unknown';
        const message = `Rule "${ruleName}" matched for ASIN ${asinCode}. ${matchedRule?.conditions?.map(c => `${c.attribute} ${c.operator} ${c.value}`).join(', ') || ''}`;

        await pool.request()
          .input('Id', sql.VarChar, id)
          .input('RecipientId', sql.VarChar, userId)
          .input('Type', sql.NVarChar, 'RULESET')
          .input('ReferenceModel', sql.NVarChar, 'Seller')
          .input('ReferenceId', sql.VarChar, sellerId)
          .input('Message', sql.NVarChar, message)
          .query(`
            INSERT INTO Notifications (Id, RecipientId, Type, ReferenceModel, ReferenceId, Message, CreatedAt)
            VALUES (@Id, @RecipientId, @Type, @ReferenceModel, @ReferenceId, @Message, dbo.GetEnvDate())
          `);
        results.push({ action: action.actionType, status: 'success' });
      } catch (err) {
        results.push({ action: action.actionType, status: 'failed', error: err.message });
      }
      break;
    }

    case 'create_task':
    case 'create_task_high': {
      try {
        const ruleName = matchedRule?.name || 'Ruleset Rule';
        const asinCode = entity.asinCode || entity.entityId || '';
        const title = `[Ruleset] ${ruleName}${asinCode ? ` — ${asinCode}` : ''}`;
        const attrCsv = (matchedRule?.conditions || []).map(c => `${c.attribute} ${c.operator} ${c.value}${c.value2 ? '–' + c.value2 : ''}`).join(', ');
        const description = `Automated task from ruleset "${rulesetMeta?.name || 'Ruleset'}" — rule "${ruleName}".\nTrigger: ${attrCsv}\nASIN: ${asinCode}${entity.title ? `\nTitle: ${entity.title}` : ''}`;
        const sellerIdStr = sellerId || entity.seller || '';
        const createdByUserId = userId || rulesetMeta?.createdBy || '';
        const priority = action.priority || (action.actionType === 'create_task_high' ? 'High' : 'Medium');
        const category = mapCategory(matchedRule?.conditions?.[0]?.attribute);

        // Default due date: CRITICAL=1d, HIGH=3d, MEDIUM=7d, LOW=14d
        const dueDays = { Critical: 1, High: 3, Medium: 7, Low: 14, CRITICAL: 1, HIGH: 3, MEDIUM: 7, LOW: 14 };
        const slaHours = { Critical: 24, High: 72, Medium: 168, Low: 336, CRITICAL: 24, HIGH: 72, MEDIUM: 168, LOW: 336 };
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (dueDays[priority] || 7));

        // Resolve the assignee to a real, seller-associated user and capture
        // their name. Both halves matter: the id decides who can open the task,
        // and the name is what the list renders (it was left empty before, so
        // every ruleset task showed "Unknown").
        let assignedTo = createdByUserId;
        let assigneeName = '';
        if (sellerIdStr) {
          try {
            const pemsService = require('./pems/pemsService');
            const owner = await pemsService.resolveAssigneeForSeller(sellerIdStr, createdByUserId);
            if (owner) {
              assignedTo = owner.id;
              assigneeName = owner.name;
            } else {
              // Nobody covers this seller: leave it visibly unassigned rather
              // than crediting someone who cannot access the task.
              assignedTo = '';
              assigneeName = '';
            }
          } catch (e) { /* keep creator as a last resort */ }
        } else if (createdByUserId) {
          try {
            const pemsService = require('./pems/pemsService');
            const creator = await pemsService.resolveAssigneeForSeller(null, createdByUserId);
            if (creator) { assignedTo = creator.id; assigneeName = creator.name; }
          } catch (e) { /* best effort */ }
        }

        // Try PEMS first; if it fails, fall back to legacy Actions table
        let taskId;
        try {
          const pemsService = require('./pems/pemsService');
          const r = await pemsService.createInstance({
            title,
            description,
            priority: pemsPriority(priority),
            status: 'ASSIGNED',
            frequency: 'ONE_TIME',
            department: category === 'PRICING' ? 'Operations' : category === 'LISTING' ? 'Catalog Team' : 'Operations',
            category,
            sellerId: sellerIdStr,
            assignedTo,
            assigneeName,
            createdBy: createdByUserId,
            reviewerId: null,
            dueDate,
            slaHours: slaHours[priority] || 168,
            tags: ['automation', 'ruleset', rulesetMeta?.name || ''].filter(Boolean),
            source: 'RULESET',
            sourceId: rulesetMeta?.id || null,
            sourceRef: ruleName,
            asins: asinCode ? [asinCode] : [],
          });
          taskId = r.id;
        } catch (pemsErr) {
          // Fallback: write into legacy Actions table
          taskId = generateId();
          await pool.request()
            .input('Id', sql.VarChar, taskId)
            .input('Title', sql.NVarChar, title)
            .input('Description', sql.NVarChar, description)
            .input('Priority', sql.NVarChar, priority)
            .input('Status', sql.NVarChar, 'PENDING')
            .input('Type', sql.NVarChar, 'automated')
            .input('Category', sql.NVarChar, category)
            .input('Asins', sql.NVarChar, JSON.stringify(asinCode ? [asinCode] : []))
            .input('SellerId', sql.VarChar, sellerIdStr)
            .input('CreatedBy', sql.VarChar, createdByUserId)
            .input('AssignedTo', sql.VarChar, assignedTo)
            .input('DueDate', sql.DateTime2, dueDate)
            .query(`INSERT INTO Actions (Id, Title, Description, Priority, Status, Type, Category, Asins, SellerId, CreatedBy, AssignedTo, DueDate, CreatedAt, UpdatedAt)
                    VALUES (@Id, @Title, @Description, @Priority, @Status, @Type, @Category, @Asins, @SellerId, @CreatedBy, @AssignedTo, @DueDate, dbo.GetEnvDate(), dbo.GetEnvDate())`);
        }

        results.push({ action: 'task_created', status: 'success', taskId, title, priority, dueDate: dueDate.toISOString(), source: 'RULESET' });
      } catch (err) {
        results.push({ action: 'task_failed', status: 'failed', error: err.message });
      }
      break;
    }

    case 'add_tag': {
      try {
        const tagValue = action.value || '';
        if (tagValue && entity.asinCode) {
          let currentTags = [];
          try {
            const tagResult = await pool.request()
              .input('asin', sql.NVarChar, entity.asinCode)
              .query('SELECT Tags FROM Asins WHERE AsinCode = @asin');
            if (tagResult.recordset.length > 0) {
              currentTags = JSON.parse(tagResult.recordset[0].Tags || '[]');
            }
          } catch (e) {}

          if (!currentTags.includes(tagValue)) {
            currentTags.push(tagValue);
            await pool.request()
              .input('asin', sql.NVarChar, entity.asinCode)
              .input('tags', sql.NVarChar, JSON.stringify(currentTags))
              .query('UPDATE Asins SET Tags = @tags WHERE AsinCode = @asin');
          }
          results.push({ action: 'add_tag', status: 'success', tag: tagValue });
        } else {
          results.push({ action: 'add_tag', status: 'skipped', reason: 'No tag value or ASIN' });
        }
      } catch (err) {
        results.push({ action: 'add_tag', status: 'failed', error: err.message });
      }
      break;
    }

    case 'remove_tag': {
      try {
        const tagValue = action.value || '';
        if (tagValue && entity.asinCode) {
          let currentTags = [];
          try {
            const tagResult = await pool.request()
              .input('asin', sql.NVarChar, entity.asinCode)
              .query('SELECT Tags FROM Asins WHERE AsinCode = @asin');
            if (tagResult.recordset.length > 0) {
              currentTags = JSON.parse(tagResult.recordset[0].Tags || '[]');
            }
          } catch (e) {}

          const newTags = currentTags.filter(t => t !== tagValue);
          await pool.request()
            .input('asin', sql.NVarChar, entity.asinCode)
            .input('tags', sql.NVarChar, JSON.stringify(newTags))
            .query('UPDATE Asins SET Tags = @tags WHERE AsinCode = @asin');
          results.push({ action: 'remove_tag', status: 'success', tag: tagValue });
        }
      } catch (err) {
        results.push({ action: 'remove_tag', status: 'failed', error: err.message });
      }
      break;
    }

    case 'flag_review': {
      try {
        if (entity.asinCode) {
          let currentTags = [];
          try {
            const tagResult = await pool.request()
              .input('asin', sql.NVarChar, entity.asinCode)
              .query('SELECT Tags FROM Asins WHERE AsinCode = @asin');
            if (tagResult.recordset.length > 0) {
              currentTags = JSON.parse(tagResult.recordset[0].Tags || '[]');
            }
          } catch (e) {}

          if (!currentTags.includes('Needs Review')) {
            currentTags.push('Needs Review');
            await pool.request()
              .input('asin', sql.NVarChar, entity.asinCode)
              .input('tags', sql.NVarChar, JSON.stringify(currentTags))
              .query('UPDATE Asins SET Tags = @tags WHERE AsinCode = @asin');
          }
          results.push({ action: 'flag_review', status: 'success' });
        }
      } catch (err) {
        results.push({ action: 'flag_review', status: 'failed', error: err.message });
      }
      break;
    }

    case 'create_group_task':
      // Group actions are handled in evaluateRuleset post-processing, not per-entity
      results.push({ action: 'create_group_task', status: 'deferred', reason: 'Handled as group action' });
      break;

    default:
      results.push({ action: action.actionType || 'unknown', status: 'skipped', reason: 'Action not implemented' });
  }

  return results;
}

// ─── Default SOP Templates (by category) ────────────────────────────────────
const SOP_TEMPLATES = {
  pricing: [
    { stepNo: 1, title: 'Review Affected ASINs', description: 'Identify all ASINs with pricing discrepancies.' },
    { stepNo: 2, title: 'Check Active Deals', description: 'Verify if any discrepancy is caused by an active deal badge.' },
    { stepNo: 3, title: 'Contact Channel Team', description: 'Raise a ticket with the channel/pricing team.' },
    { stepNo: 4, title: 'Update Prices', description: 'Update prices for all affected ASINs.' },
    { stepNo: 5, title: 'Verify Resolution', description: 'Confirm all ASINs now show correct prices.' },
    { stepNo: 6, title: 'Close Task', description: 'Mark all sub-tasks as completed and submit for review.' },
  ],
  listing: [
    { stepNo: 1, title: 'Review Affected ASINs', description: 'Identify all ASINs with listing quality issues.' },
    { stepNo: 2, title: 'Prioritize by Impact', description: 'Rank ASINs by BSR, revenue, or LQS score.' },
    { stepNo: 3, title: 'Create Optimization Plan', description: 'Define specific improvements for each ASIN.' },
    { stepNo: 4, title: 'Implement Changes', description: 'Update titles, images, bullets, descriptions as needed.' },
    { stepNo: 5, title: 'Verify Improvements', description: 'Confirm LQS scores and listing completeness improved.' },
  ],
  inventory: [
    { stepNo: 1, title: 'Review Stock Levels', description: 'Check current stock levels for all affected ASINs.' },
    { stepNo: 2, title: 'Contact Supply Chain', description: 'Coordinate with supply chain for restocking.' },
    { stepNo: 3, title: 'Update Inventory', description: 'Update stock levels and availability status.' },
    { stepNo: 4, title: 'Monitor Restock', description: 'Track restock progress until items are back in stock.' },
  ],
  general: [
    { stepNo: 1, title: 'Review Affected Items', description: 'Review all items flagged by this ruleset.' },
    { stepNo: 2, title: 'Take Action', description: 'Address each item according to the ruleset criteria.' },
    { stepNo: 3, title: 'Verify Resolution', description: 'Confirm all items are resolved.' },
    { stepNo: 4, title: 'Close Task', description: 'Mark all sub-tasks as completed and submit for review.' },
  ],
};

/**
 * Creates grouped tasks — 1 main task per group, sub-tasks per entity.
 * Universal: works for any ruleset type, groups by configurable field.
 * 
 * @param {Array} matchedEntities - [{ entity, matchedRule, matchedIndex }]
 * @param {Object} ruleset - The ruleset being executed
 * @param {Object} pool - Database pool
 * @param {Object} options - { groupBy: 'seller'|'category'|'brand', priority, sop, titleTemplate }
 */
async function createGroupTasks(matchedEntities, ruleset, pool, options = {}) {
  const results = [];
  const dryRun = options.dryRun || false;

  const groupByField = options.groupBy || 'seller';
  const priority = options.priority || 'Medium';
  const customSop = options.sop || null;
  const titleTemplate = options.titleTemplate || null;
  const dueDays = { Critical: 1, High: 3, Medium: 7, Low: 14 };
  const dueDateMs = dueDays[priority] || 7;

  // Determine grouping key from entity
  const getGroupKey = (entity) => {
    switch (groupByField) {
      case 'seller': return entity.seller || 'UNKNOWN';
      case 'category': return entity.category || 'UNCATEGORIZED';
      case 'brand': return entity.brand || 'NO_BRAND';
      case 'bsrRange': {
        const bsr = entity.bsr || 0;
        if (bsr <= 1000) return 'Top 1K';
        if (bsr <= 10000) return '1K-10K';
        if (bsr <= 50000) return '10K-50K';
        return '50K+';
      }
      case 'priceRange': {
        const price = entity.currentPrice || 0;
        if (price <= 500) return 'Under ₹500';
        if (price <= 2000) return '₹500-2K';
        if (price <= 5000) return '₹2K-5K';
        return 'Over ₹5K';
      }
      default: return entity[groupByField] || 'UNKNOWN';
    }
  };

  // Group entities
  const groups = {};
  for (const me of matchedEntities) {
    const key = getGroupKey(me.entity);
    if (!groups[key]) {
      groups[key] = { key, entities: [], rule: me.matchedRule, ruleIndex: me.matchedIndex };
    }
    groups[key].entities.push(me.entity);
  }

  // Resolve display names for group keys
  let displayNameMap = {};
  const groupKeys = Object.keys(groups);

  if (groupByField === 'seller' && groupKeys.length > 0) {
    const validKeys = groupKeys.filter(k => k !== 'UNKNOWN');
    if (validKeys.length > 0) {
      try {
        const placeholders = validKeys.map((_, i) => `@gk${i}`).join(',');
        const req = pool.request();
        validKeys.forEach((id, i) => req.input(`gk${i}`, sql.VarChar, id));
        const res = await req.query(`SELECT Id, Name FROM Sellers WHERE Id IN (${placeholders})`);
        res.recordset.forEach(s => { displayNameMap[s.Id] = s.Name; });
      } catch (e) { console.warn('[GroupTask] Could not fetch seller names:', e.message); }
    }
  } else if (groupByField === 'category') {
    // Categories are already human-readable
    groupKeys.forEach(k => { displayNameMap[k] = k; });
  } else if (groupByField === 'brand') {
    groupKeys.forEach(k => { displayNameMap[k] = k; });
  } else {
    groupKeys.forEach(k => { displayNameMap[k] = k; });
  }

  // Get SOP
  const getSop = (entities) => {
    if (customSop && customSop.length > 0) return customSop;
    // Auto-detect SOP from entity data
    const hasPriceDispute = entities.some(e => e.priceDispute);
    const hasLowLqs = entities.some(e => (e.lqs || 0) < 70);
    const hasLowStock = entities.some(e => (e.stockLevel || 0) === 0);
    if (hasPriceDispute) return SOP_TEMPLATES.pricing;
    if (hasLowLqs) return SOP_TEMPLATES.listing;
    if (hasLowStock) return SOP_TEMPLATES.inventory;
    return SOP_TEMPLATES.general;
  };

  // Create tasks for each group
  for (const [groupKey, group] of Object.entries(groups)) {
    const displayName = displayNameMap[groupKey] || groupKey;
    const entityCount = group.entities.length;
    const ruleName = group.rule?.name || 'Ruleset';
    const sop = getSop(group.entities);

    // Build sub-tasks generically from entity data
    const subTasks = group.entities.map((entity, idx) => {
      const sub = {
        id: idx + 1,
        asinCode: entity.asinCode || '',
        title: entity.title || entity.asinCode || `Item ${idx + 1}`,
        brand: entity.brand || '',
        category: entity.category || '',
        status: 'pending',
      };

      // Add contextual data based on what the entity has
      if (entity.currentPrice !== undefined) sub.currentPrice = entity.currentPrice;
      if (entity.uploadedPrice !== undefined) sub.uploadedPrice = entity.uploadedPrice;
      if (entity.currentPrice && entity.uploadedPrice) {
        sub.difference = Math.abs(entity.currentPrice - entity.uploadedPrice);
      }
      if (entity.bsr) sub.bsr = entity.bsr;
      if (entity.rating) sub.rating = entity.rating;
      if (entity.reviewCount) sub.reviewCount = entity.reviewCount;
      if (entity.stockLevel !== undefined) sub.stockLevel = entity.stockLevel;
      if (entity.lqs) sub.lqs = entity.lqs;
      if (entity.hasAplus !== undefined) sub.hasAplus = entity.hasAplus;
      if (entity.imagesCount) sub.imagesCount = entity.imagesCount;
      if (entity.hasDeal) sub.hasDeal = entity.hasDeal;
      if (entity.dealBadge) sub.dealBadge = entity.dealBadge;
      if (entity.priceDispute) sub.priceDispute = true;
      if (entity.bsrTrend) sub.bsrTrend = entity.bsrTrend;
      if (entity.availabilityStatus) sub.availabilityStatus = entity.availabilityStatus;
      if (entity.totalOrders) sub.totalOrders = entity.totalOrders;

      return sub;
    });

    // Build title from template or auto-generate
    const mainTitle = titleTemplate
      ? titleTemplate
        .replace('{seller}', displayName)
        .replace('{count}', entityCount)
        .replace('{rule}', ruleName)
        .replace('{groupBy}', groupByField)
      : `[${ruleName}] ${displayName} — ${entityCount} item${entityCount > 1 ? 's' : ''}`;

    // Build description with SOP
    const description = [
      `Ruleset: ${ruleName}`,
      `Group: ${displayName} (${groupByField})`,
      `Affected Items: ${entityCount}`,
      '',
      'Items:',
      ...subTasks.map((st, i) => {
        const parts = [`  ${i + 1}. ${st.asinCode}${st.brand ? ` (${st.brand})` : ''}`];
        if (st.currentPrice && st.uploadedPrice) parts.push(` — ₹${st.uploadedPrice} vs ₹${st.currentPrice}`);
        if (st.stockLevel === 0) parts.push(' — OUT OF STOCK');
        if (st.lqs && st.lqs < 70) parts.push(` — LQS: ${st.lqs}`);
        return parts.join('');
      }).join('\n'),
      '',
      'SOP:',
      ...sop.map(s => `  ${s.stepNo}. ${s.title}: ${s.description}`),
      '',
      'Complete all sub-tasks below to resolve.',
    ].join('\n');

    // Resolve the assignee for this group to a real, seller-associated user and
    // keep their name, so grouped ruleset tasks are attributed rather than
    // rendering as "Unknown". See resolveAssigneeForSeller for the ordering.
    const groupSellerId = groupByField === 'seller' && groupKey !== 'UNKNOWN' ? groupKey : null;
    let assignedTo = ruleset.CreatedBy || '';
    let assigneeName = '';
    try {
      const pemsService = require('./pems/pemsService');
      const owner = await pemsService.resolveAssigneeForSeller(groupSellerId, ruleset.CreatedBy || null);
      if (owner) {
        assignedTo = owner.id;
        assigneeName = owner.name;
      } else if (groupSellerId) {
        assignedTo = '';
        assigneeName = '';
      }
    } catch (e) { /* keep creator as a last resort */ }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDateMs);

    if (!dryRun) {
      let taskId;
      try {
        const pemsService = require('./pems/pemsService');
        const r = await pemsService.createInstance({
          title: mainTitle,
          description,
          priority: ({ Critical:'CRITICAL', High:'HIGH', Medium:'MEDIUM', Low:'LOW' })[priority] || 'MEDIUM',
          status: 'ASSIGNED',
          frequency: 'ONE_TIME',
          department: group.entities[0]?.category || 'Operations',
          category: group.entities[0]?.category || 'GENERAL',
          sellerId: groupByField === 'seller' ? groupKey : null,
          assignedTo,
          assigneeName,
          createdBy: ruleset.CreatedBy || '',
          dueDate,
          slaHours: dueDateMs * 24,
          tags: ['automation','ruleset',ruleset.Name||''].filter(Boolean),
          source: 'RULESET',
          sourceId: ruleset.Id,
          sourceRef: rule.name,
          asins: subTasks.map(st => st.asinCode),
          subTaskDefinitions: subTasks.map((st, i) => ({
            title: st.title || `Resolve ${st.asinCode}`,
            description: st.description || '',
            expectedOutput: 'Issue resolved per rule.',
            activities: st.sop?.map(s => ({ title: s.title, instructions: s.description, expectedOutput: 'Done', isMandatory: true })) || [],
          })),
        });
        taskId = r.id;
      } catch (pemsErr) {
        console.warn('[rulesetEngine] PEMS create failed, falling back to legacy Actions:', pemsErr.message);
        taskId = generateId();
      await pool.request()
        .input('Id', sql.VarChar, taskId)
        .input('Title', sql.NVarChar, mainTitle)
        .input('Description', sql.NVarChar, description)
        .input('Priority', sql.NVarChar, priority)
        .input('Status', sql.NVarChar, 'PENDING')
        .input('Type', sql.NVarChar, 'automated')
        .input('Category', sql.NVarChar, group.entities[0]?.category || 'General')
        .input('Asins', sql.NVarChar, JSON.stringify(subTasks.map(st => st.asinCode)))
        .input('SubTasks', sql.NVarChar, JSON.stringify(subTasks))
        .input('SubTaskProgress', sql.NVarChar, `0/${entityCount}`)
        .input('SellerId', sql.VarChar, groupKey)
        .input('CreatedBy', sql.VarChar, ruleset.CreatedBy || '')
        .input('AssignedTo', sql.VarChar, assignedTo)
        .input('DueDate', sql.DateTime2, dueDate)
        .input('TimeLimit', sql.Int, dueDateMs)
        .query(`
          INSERT INTO Actions (Id, Title, Description, Priority, Status, Type, Category, Asins, SubTasks, SubTaskProgress, SellerId, CreatedBy, AssignedTo, DueDate, TimeLimit, CreatedAt, UpdatedAt)
          VALUES (@Id, @Title, @Description, @Priority, @Status, @Type, @Category, @Asins, @SubTasks, @SubTaskProgress, @SellerId, @CreatedBy, @AssignedTo, @DueDate, @TimeLimit, dbo.GetEnvDate(), dbo.GetEnvDate())
        `);
      } // end catch (legacy fallback)
    }

    results.push({
      action: 'group_task_created',
      status: 'success',
      taskId,
      title: mainTitle,
      groupKey,
      displayName,
      groupByField,
      entityCount,
      subTaskCount: subTasks.length,
      priority,
      dueDate: dueDate.toISOString(),
    });

    console.log(`📋 [GroupTask] Created: ${mainTitle} (${entityCount} sub-tasks)`);
  }

  return results;
}

/**
 * Authoritative attribute -> column map. Anything not in here cannot be
 * evaluated or turned into SQL, so this table is the contract for rule authors
 * (including the AI generator).
 */
const RULE_ATTRIBUTE_COLUMNS = {
  // Price & BuyBox
  priceDispute: 'PriceDispute',
  buyBoxWin: 'BuyBoxWin',
  uploadedPrice: 'UploadedPrice',
  currentPrice: 'CurrentPrice',
  mrp: 'Mrp',
  discountPercentage: 'DiscountPercentage',
  hasDeal: 'HasDeal',
  dealBadge: 'DealBadge',
  // Listing Quality
  lqs: 'LQS',
  titleScore: 'TitleScore',
  bulletScore: 'BulletScore',
  imageScore: 'ImageScore',
  descriptionScore: 'DescriptionScore',
  imagesCount: 'ImagesCount',
  bulletPoints: 'BulletPoints',
  hasAplus: 'HasAplus',
  // Performance
  bsr: 'BSR',
  subBsr: 'SubBsr',
  bsrTrend: 'BsrTrend',
  rating: 'Rating',
  ratingTrend: 'RatingTrend',
  reviewCount: 'ReviewCount',
  // Inventory
  stockLevel: 'StockLevel',
  availabilityStatus: 'AvailabilityStatus',
  // Filters
  asinStatus: 'Status',
  seller: 'SellerId',
  category: 'Category',
  brand: 'Brand',
  ads: 'Ads',
};

/** Valid `groupBy` values for create_group_task actions. */
const RULE_GROUP_BY_FIELDS = ['seller', 'category', 'brand', 'bsrRange', 'priceRange'];

function mapAttributeToColumn(attr) {
  return RULE_ATTRIBUTE_COLUMNS[attr] || null;
}

// formatSqlCondition removed — use parameterized buildSqlFilter instead

function buildSqlFilter(rules) {
  if (!Array.isArray(rules) || rules.length === 0) return { sql: '', params: {} };
  
  const ruleFilters = [];
  const params = {};
  let paramIdx = 0;

  for (const rule of rules) {
    if (!rule.isActive || !rule.conditions || rule.conditions.length === 0) continue;
    
    const condFilters = [];
    for (let i = 0; i < rule.conditions.length; i++) {
      const cond = rule.conditions[i];
      const col = mapAttributeToColumn(cond.attribute);
      if (!col) continue;
      
      const key = `rf${paramIdx++}`;
      const op = cond.operator;
      const val = cond.value;
      const val2 = cond.value2;

      if (op === 'is empty') {
        condFilters.push(`(${col} IS NULL OR ${col} = '')`);
      } else if (op === 'is not empty') {
        condFilters.push(`(${col} IS NOT NULL AND ${col} <> '')`);
      } else if (op === 'contains') {
        params[key] = `%${val}%`;
        condFilters.push(`${col} LIKE @${key}`);
      } else if (op === 'not contains') {
        params[key] = `%${val}%`;
        condFilters.push(`${col} NOT LIKE @${key}`);
      } else if (op === 'starts with') {
        params[key] = `${val}%`;
        condFilters.push(`${col} LIKE @${key}`);
      } else if (op === 'between') {
        const k1 = `rf${paramIdx++}`;
        const k2 = `rf${paramIdx++}`;
        params[k1] = Number(val) || 0;
        params[k2] = Number(val2) || 0;
        condFilters.push(`(${col} BETWEEN @${k1} AND @${k2})`);
      } else if (op === '=' || op === '≠' || op === '<' || op === '<=' || op === '>' || op === '>=') {
        let sqlOp = op === '≠' ? '<>' : op;
        let sqlVal = val;

        // Type-aware binding: booleans → 1/0, numbers → Number, strings → String
        const boolAttrs = new Set(['priceDispute','buyBoxWin','hasDeal','hasAplus','ads']);
        const numericAttrs = new Set(['stockLevel','currentPrice','uploadedPrice','mrp','discountPercentage','lqs','titleScore','bulletScore','imageScore','descriptionScore','imagesCount','bulletPoints','bsr','subBsr','rating','reviewCount']);
        const textAttrs = new Set(['dealBadge','bsrTrend','ratingTrend','availabilityStatus','asinStatus','seller','category','brand']);

        if (boolAttrs.has(cond.attribute)) {
          // BIT column: compare against 1/0, but include NULL for "false" checks
          // NULL BuyBoxWin means "not won" → should match "false"/"No"
          const isTrue = (val === 'true' || val === true || val === 1 || val === 'Yes' || val === 'yes');
          const isNotOp = (sqlOp === '<>' || op === '≠' || op === 'is not');
          
          if (isTrue && !isNotOp) {
            // true/Yes: exact match 1
            params[key] = 1;
            condFilters.push(`${col} ${sqlOp} @${key}`);
          } else if (!isTrue && !isNotOp) {
            // false/No: match 0 OR NULL (never won = not won)
            condFilters.push(`(${col} = 0 OR ${col} IS NULL)`);
          } else if (isTrue && isNotOp) {
            // NOT true/Yes: match 0 OR NULL
            condFilters.push(`(${col} = 0 OR ${col} IS NULL)`);
          } else {
            // NOT false/No: match 1 only
            params[key] = 1;
            condFilters.push(`${col} ${sqlOp} @${key}`);
          }
        } else if (numericAttrs.has(cond.attribute)) {
          params[key] = Number(val);
          if (isNaN(params[key])) continue;
          condFilters.push(`${col} ${sqlOp} @${key}`);
        } else {
          params[key] = String(val ?? '');
          condFilters.push(`${col} ${sqlOp} @${key}`);
        }
      } else {
        continue;
      }

      if (condFilters.length > 1 && i > 0) {
        condFilters[condFilters.length - 1] = ` ${cond.logicalOp || 'AND'} ${condFilters[condFilters.length - 1]}`;
      }
    }
    if (condFilters.length > 0) {
      ruleFilters.push(`(${condFilters.join('')})`);
    }
  }
  
  if (ruleFilters.length > 0) {
    return { sql: ` AND (${ruleFilters.join(' OR ')})`, params };
  }
  return { sql: '', params: {} };
}

async function evaluateRuleset(rulesetId, options = {}) {
  const dryRun = options.dryRun || false;
  const triggeredBy = options.triggeredBy || 'manual';
  const selectedAsins = options.selectedAsins || null;

  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.VarChar, rulesetId)
    .query("SELECT * FROM Rulesets WHERE Id = @id");
  
  const ruleset = result.recordset[0];
  if (!ruleset) {
    throw new Error('Ruleset not found');
  }
  if (triggeredBy !== 'manual' && !ruleset.IsActive) {
    throw new Error('Ruleset is inactive');
  }

  let rules = ruleset.Rules;
  try {
    if (typeof rules === 'string') {
      rules = JSON.parse(rules);
      if (typeof rules === 'string') {
        rules = JSON.parse(rules);
      }
    }
  } catch (e) {
    rules = [];
  }
  ruleset.Rules = Array.isArray(rules) ? rules : [];

  const startTime = Date.now();
  const hasTotalOrders = ruleset.Rules.some(r => 
    r.conditions?.some(c => c.attribute === 'totalOrders')
  );
  const sqlFilterResult = buildSqlFilter(ruleset.Rules);

  let entities = await getEntityData(
    ruleset.Type,
    ruleset.SellerId,
    ruleset.UsingDataFrom,
    ruleset.ExcludeDays,
    hasTotalOrders,
    sqlFilterResult.sql,
    sqlFilterResult.params,
    pool
  );

  if (selectedAsins && selectedAsins.length > 0) {
    entities = entities.filter(entity => selectedAsins.includes(entity.asinCode));
  }

  const summary = {
    totalEvaluated: entities.length,
    totalMatched: 0,
    totalActioned: 0,
    totalSkipped: 0,
    executionTimeMs: 0
  };

  const entries = [];

  const matchedEntities = [];
  for (const entity of entities) {
    let matchedRule = null;
    let matchedIndex = -1;

    for (let i = 0; i < ruleset.Rules.length; i++) {
      const rule = ruleset.Rules[i];
      if (evaluateRule(rule, entity)) {
        matchedRule = rule;
        matchedIndex = i;
        break;
      }
    }

    if (matchedRule) {
      summary.totalMatched++;
      matchedEntities.push({ entity, matchedRule, matchedIndex });
    } else {
      summary.totalSkipped++;
    }
  }

  const batchSize = 100;
  const GROUP_ACTIONS = ['create_group_task'];
  const individualEntities = [];
  const groupEntities = {};

  // Separate individual vs group actions
  for (const me of matchedEntities) {
    const actionType = me.matchedRule?.action?.actionType;
    if (GROUP_ACTIONS.includes(actionType)) {
      const key = actionType;
      if (!groupEntities[key]) groupEntities[key] = { action: me.matchedRule.action, entities: [], rule: me.matchedRule };
      groupEntities[key].entities.push(me);
    } else {
      individualEntities.push(me);
    }
  }

  // Process individual actions (existing logic)
  for (let i = 0; i < individualEntities.length; i += batchSize) {
    const batch = individualEntities.slice(i, i + batchSize);
    await Promise.all(batch.map(async ({ entity, matchedRule, matchedIndex }) => {
      let actionResults = [];
      if (!dryRun) {
        actionResults = await applyAction(
          entity,
          matchedRule.action,
          ruleset.Type,
          ruleset.SellerId,
          ruleset.CreatedBy,
          matchedRule,
          { id: ruleset.Id, name: ruleset.Name, createdBy: ruleset.CreatedBy }
        );
        summary.totalActioned++;
      }

      entries.push({
        entityId: entity.asinCode || entity.entityId,
        entityType: ruleset.Type,
        entityName: entity.title || entity.asinCode,
        ruleName: matchedRule.name,
        ruleOrder: matchedIndex,
        conditionsMet: matchedRule.conditions.map(c => ({
          attribute: c.attribute,
          operator: c.operator,
          value: c.value
        })),
        actionApplied: matchedRule.action,
        status: dryRun ? 'dry_run' : (actionResults.some(r => r.status === 'success') ? 'applied' : 'failed')
      });
    }));
  }

  // Process group actions (e.g., create_group_task)
  for (const [actionKey, groupData] of Object.entries(groupEntities)) {
    if (actionKey === 'create_group_task') {
      const actionConfig = groupData.action || {};
      const groupResults = await createGroupTasks(groupData.entities, ruleset, pool, {
        groupBy: actionConfig.groupBy || 'seller',
        priority: actionConfig.priority || 'Medium',
        sop: actionConfig.sop || null,
        titleTemplate: actionConfig.titleTemplate || null,
        dryRun,
      });
      summary.totalActioned += groupResults.length;

      for (const gr of groupResults) {
        entries.push({
          entityId: `${gr.groupKey} (${gr.entityCount} items)`,
          entityType: 'GROUP_TASK',
          entityName: gr.title,
          ruleName: groupData.rule?.name || 'Group Task',
          ruleOrder: 0,
          conditionsMet: [],
          actionApplied: { actionType: 'create_group_task', ...actionConfig },
          status: dryRun ? 'dry_run' : gr.status
        });
      }
    }
  }

  summary.executionTimeMs = Date.now() - startTime;

  if (!dryRun) {
    const logId = generateId();
    const summaryJson = JSON.stringify(summary);
    // Detect whether the Summary column exists (migration 026). If not,
    // fall back to stuffing the JSON into ErrorMessage (the historical bug)
    // so execution logs are never lost before migrations run.
    const colCheck = await pool.request().query(`
      SELECT 1 FROM sys.columns
       WHERE object_id = OBJECT_ID('dbo.RulesetExecutionLogs') AND name = 'Summary'
    `);
    const hasSummaryCol = colCheck.recordset.length > 0;

    if (hasSummaryCol) {
      await pool.request()
        .input('Id', sql.VarChar, logId)
        .input('RulesetId', sql.VarChar, rulesetId)
        .input('TriggeredBy', sql.NVarChar, triggeredBy)
        .input('Status', sql.NVarChar, 'SUCCESS')
        .input('MatchedCount', sql.Int, summary.totalMatched)
        .input('ActionedCount', sql.Int, summary.totalActioned)
        .input('Summary', sql.NVarChar, summaryJson)
        .input('ErrorMessage', sql.NVarChar, null)
        .query(`
          INSERT INTO RulesetExecutionLogs (Id, RulesetId, ExecutedAt, TriggeredBy, Status, MatchedCount, ActionedCount, Summary, ErrorMessage)
          VALUES (@Id, @RulesetId, dbo.GetEnvDate(), @TriggeredBy, @Status, @MatchedCount, @ActionedCount, @Summary, @ErrorMessage)
        `);
    } else {
      // Legacy fallback: ErrorMessage doubles as summary storage.
      await pool.request()
        .input('Id', sql.VarChar, logId)
        .input('RulesetId', sql.VarChar, rulesetId)
        .input('TriggeredBy', sql.NVarChar, triggeredBy)
        .input('Status', sql.NVarChar, 'SUCCESS')
        .input('MatchedCount', sql.Int, summary.totalMatched)
        .input('ActionedCount', sql.Int, summary.totalActioned)
        .input('ErrorMessage', sql.NVarChar, summaryJson)
        .query(`
          INSERT INTO RulesetExecutionLogs (Id, RulesetId, ExecutedAt, TriggeredBy, Status, MatchedCount, ActionedCount, ErrorMessage)
          VALUES (@Id, @RulesetId, dbo.GetEnvDate(), @TriggeredBy, @Status, @MatchedCount, @ActionedCount, @ErrorMessage)
        `);
    }

    await pool.request()
      .input('id', sql.VarChar, rulesetId)
      .input('summary', sql.NVarChar, JSON.stringify(summary))
      .query(`
        UPDATE Rulesets 
        SET LastRunAt = dbo.GetEnvDate(), 
            TotalRunCount = ISNULL(TotalRunCount, 0) + 1,
            LastRunSummary = @summary,
            UpdatedAt = dbo.GetEnvDate()
        WHERE Id = @id
      `);
  }

  return { summary, entries };
}

async function scheduleRuleset(rulesetId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.VarChar, rulesetId)
    .query("SELECT * FROM Rulesets WHERE Id = @id");
  
  const ruleset = result.recordset[0];
  if (!ruleset || !ruleset.IsActive || !ruleset.IsAutomated) {
    return null;
  }

  const syncResult = await evaluateRuleset(rulesetId, { triggeredBy: 'scheduled' });
  return syncResult;
}

async function runForSeller(sellerId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('sellerId', sql.VarChar, sellerId)
    .query(`
      SELECT Id FROM Rulesets 
      WHERE IsActive = 1 AND IsAutomated = 1 
      AND (SellerId = @sellerId OR SellerId IS NULL OR SellerId = '')
    `);
  
  const rulesets = result.recordset || [];
  const results = [];
  for (const r of rulesets) {
    try {
      const res = await evaluateRuleset(r.Id, { triggeredBy: 'scheduled' });
      results.push({ rulesetId: r.Id, status: 'success', summary: res?.summary });
    } catch (err) {
      console.error(`Error running automated ruleset ${r.Id} for seller ${sellerId}:`, err);
      results.push({ rulesetId: r.Id, status: 'error', error: err.message });
    }
  }
  return results;
}

module.exports = {
  evaluateRuleset,
  scheduleRuleset,
  runForSeller,
  getEntityData,
  evaluateCondition,
  evaluateRule,
  // Exported so the AI prompt builder derives its allowed-attribute list from
  // the same table the SQL filter uses. An attribute the AI invents is an
  // attribute the engine silently drops, so the two must not drift.
  RULE_ATTRIBUTE_COLUMNS,
  RULE_GROUP_BY_FIELDS,
};
