const { getPool, sql, generateId } = require('../../database/db');

const ONGOING_EPISODE = 'ongoing';

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || message;
  return err;
}

async function addEvent(incidentId, { runId, eventType, detail, actorId } = {}) {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.VarChar, generateId())
    .input('incidentId', sql.VarChar, incidentId)
    .input('runId', sql.VarChar, runId || null)
    .input('eventType', sql.VarChar, eventType)
    .input('detailJson', sql.NVarChar(sql.MAX), detail == null ? null : JSON.stringify(detail))
    .input('actorId', sql.VarChar, actorId || null)
    .query(`
      INSERT INTO OosIncidentEvents (Id, IncidentId, RunId, EventType, DetailJson, ActorId, CreatedAt)
      VALUES (@id, @incidentId, @runId, @eventType, @detailJson, @actorId, GETUTCDATE())
    `);
}

/**
 * Idempotently ensure exactly ONE open incident for (seller, channel, ASIN,
 * episode). Re-observation appends an EVIDENCE event instead of duplicating it.
 */
async function ensureOpenIncident({ sellerId, sellerName, channel, asin, runId, detail, actorId } = {}) {
  if (!sellerId || !channel || !asin) {
    throw httpError(400, 'sellerId, channel and asin are required', 'INCIDENT_SCOPE_REQUIRED');
  }
  const pool = await getPool();
  const existing = await pool
    .request()
    .input('sellerId', sql.VarChar, sellerId)
    .input('channel', sql.VarChar, channel)
    .input('asin', sql.VarChar, asin)
    .input('episodeKey', sql.VarChar, ONGOING_EPISODE)
    .query(`
      SELECT TOP 1 * FROM OosIncidents
      WHERE SellerId = @sellerId AND Channel = @channel AND AsinCode = @asin
        AND EpisodeKey = @episodeKey AND Status = 'OPEN'
    `);

  if (existing.recordset[0]) {
    await addEvent(existing.recordset[0].Id, { runId, eventType: 'EVIDENCE', detail, actorId });
    return { incident: existing.recordset[0], created: false };
  }

  const id = generateId();
  try {
    const inserted = await pool
      .request()
      .input('id', sql.VarChar, id)
      .input('sellerId', sql.VarChar, sellerId)
      .input('sellerName', sql.NVarChar, sellerName || '')
      .input('channel', sql.VarChar, channel)
      .input('asin', sql.VarChar, asin)
      .input('episodeKey', sql.VarChar, ONGOING_EPISODE)
      .input('status', sql.VarChar, 'OPEN')
      .query(`
        INSERT INTO OosIncidents
          (Id, SellerId, SellerName, Channel, AsinCode, EpisodeKey, Status, OpenedAt, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.*
        VALUES (@id, @sellerId, @sellerName, @channel, @asin, @episodeKey, @status, GETUTCDATE(), GETUTCDATE(), GETUTCDATE())
      `);
    const incident = inserted.recordset[0];
    await addEvent(id, { runId, eventType: 'OPENED', detail, actorId });
    return { incident, created: true };
  } catch (err) {
    // Filtered unique index won the race — reuse the existing open incident.
    const retry = await pool
      .request()
      .input('sellerId', sql.VarChar, sellerId)
      .input('channel', sql.VarChar, channel)
      .input('asin', sql.VarChar, asin)
      .input('episodeKey', sql.VarChar, ONGOING_EPISODE)
      .query(`
        SELECT TOP 1 * FROM OosIncidents
        WHERE SellerId = @sellerId AND Channel = @channel AND AsinCode = @asin
          AND EpisodeKey = @episodeKey AND Status = 'OPEN'
      `);
    if (retry.recordset[0]) {
      await addEvent(retry.recordset[0].Id, { runId, eventType: 'EVIDENCE', detail, actorId });
      return { incident: retry.recordset[0], created: false };
    }
    throw err;
  }
}

async function listOpenIncidents({ sellerId } = {}) {
  const pool = await getPool();
  const request = pool.request();
  const where = ["Status = 'OPEN'"];
  if (sellerId) { request.input('sellerId', sql.VarChar, sellerId); where.push('SellerId = @sellerId'); }
  const result = await request.query(`
    SELECT * FROM OosIncidents WHERE ${where.join(' AND ')} ORDER BY OpenedAt ASC
  `);
  return result.recordset;
}

async function getIncident(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.VarChar, id)
    .query('SELECT TOP 1 * FROM OosIncidents WHERE Id = @id');
  return result.recordset[0] || null;
}

async function updateIncident(id, patch = {}, actorId) {
  const incident = await getIncident(id);
  if (!incident) throw httpError(404, 'Incident not found', 'INCIDENT_NOT_FOUND');
  const pick = (key, column) => (Object.prototype.hasOwnProperty.call(patch, key) ? patch[key] : incident[column]);
  const fields = {
    OwnerId: pick('ownerId', 'OwnerId'),
    OwnerName: pick('ownerName', 'OwnerName'),
    CommunicationStatus: pick('communicationStatus', 'CommunicationStatus'),
    NextAction: pick('nextAction', 'NextAction'),
    EtaDate: pick('etaDate', 'EtaDate'),
    FollowUpDate: pick('followUpDate', 'FollowUpDate'),
  };
  const pool = await getPool();
  const updated = await pool
    .request()
    .input('id', sql.VarChar, id)
    .input('ownerId', sql.VarChar, fields.OwnerId)
    .input('ownerName', sql.NVarChar, fields.OwnerName)
    .input('communicationStatus', sql.VarChar, fields.CommunicationStatus)
    .input('nextAction', sql.NVarChar, fields.NextAction)
    .input('etaDate', sql.Date, fields.EtaDate)
    .input('followUpDate', sql.Date, fields.FollowUpDate)
    .query(`
      UPDATE OosIncidents SET
        OwnerId = @ownerId, OwnerName = @ownerName, CommunicationStatus = @communicationStatus,
        NextAction = @nextAction, EtaDate = @etaDate, FollowUpDate = @followUpDate, UpdatedAt = GETUTCDATE()
      OUTPUT INSERTED.*
      WHERE Id = @id
    `);
  await addEvent(id, { eventType: 'NOTE', detail: patch, actorId });
  return updated.recordset[0];
}

async function resolveIncident(id, { actorId, runId, detail, status = 'RESOLVED' } = {}) {
  const incident = await getIncident(id);
  if (!incident) throw httpError(404, 'Incident not found', 'INCIDENT_NOT_FOUND');
  if (incident.Status !== 'OPEN') return { incident, changed: false };
  const pool = await getPool();
  const updated = await pool
    .request()
    .input('id', sql.VarChar, id)
    .input('status', sql.VarChar, status)
    .input('resolvedBy', sql.VarChar, actorId || null)
    .query(`
      UPDATE OosIncidents SET Status = @status, ResolvedAt = GETUTCDATE(), ResolvedBy = @resolvedBy, UpdatedAt = GETUTCDATE()
      OUTPUT INSERTED.*
      WHERE Id = @id
    `);
  await addEvent(id, { runId, eventType: status === 'WAIVED' ? 'WAIVED' : 'RESOLVED', detail, actorId });
  return { incident: updated.recordset[0], changed: true };
}

async function resolveForAsin({ sellerId, channel, asin, actorId, runId, detail }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('sellerId', sql.VarChar, sellerId)
    .input('channel', sql.VarChar, channel)
    .input('asin', sql.VarChar, asin)
    .query(`
      SELECT TOP 1 Id FROM OosIncidents
      WHERE SellerId = @sellerId AND Channel = @channel AND AsinCode = @asin AND Status = 'OPEN'
    `);
  if (!result.recordset[0]) return { changed: false };
  return resolveIncident(result.recordset[0].Id, { actorId, runId, detail });
}

module.exports = {
  ONGOING_EPISODE,
  ensureOpenIncident,
  listOpenIncidents,
  getIncident,
  updateIncident,
  resolveIncident,
  resolveForAsin,
  addEvent,
};
