const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const trustedDeviceService = require('../services/trustedDeviceService');
const { deviceFingerprint } = require('../utils/requestFingerprint');

// OTP Audit Log (paginated)
router.get('/otp-logs', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 50, action, status, email } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const pool = await getPool();
    const request = pool.request();
    
    let whereClause = 'WHERE 1=1';
    if (action) { whereClause += ' AND Action = @action'; request.input('action', sql.NVarChar, action); }
    if (status) { whereClause += ' AND Status = @status'; request.input('status', sql.NVarChar, status); }
    if (email) { whereClause += ' AND Email LIKE @email'; request.input('email', sql.NVarChar, `%${email}%`); }
    
    const countResult = await request.query(`SELECT COUNT(*) as total FROM OtpAuditLog ${whereClause}`);
    const total = countResult.recordset[0].total;
    
    const dataRequest = pool.request();
    if (action) dataRequest.input('action', sql.NVarChar, action);
    if (status) dataRequest.input('status', sql.NVarChar, status);
    if (email) dataRequest.input('email', sql.NVarChar, `%${email}%`);
    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, parseInt(limit));
    
    const data = await dataRequest.query(`
      SELECT ol.*, u.FirstName, u.LastName
      FROM OtpAuditLog ol
      LEFT JOIN Users u ON ol.UserId = u.Id
      ${whereClause}
      ORDER BY ol.CreatedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
    
    // Stats for the same filters
    const statsReq = pool.request();
    if (action) statsReq.input('action', sql.NVarChar, action);
    if (status) statsReq.input('status', sql.NVarChar, status);
    if (email) statsReq.input('email', sql.NVarChar, `%${email}%`);
    const stats = await statsReq.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN Action = 'OTP_SENT' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN Action = 'OTP_VERIFIED' OR Action = 'VERIFY' THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN Action = 'OTP_FAILED' OR Action = 'VERIFY_FAILED' THEN 1 ELSE 0 END) as failed
      FROM OtpAuditLog
      ${whereClause}
    `);
    
    res.json({ success: true, data: data.recordset, total, stats: stats.recordset[0], page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Trusted Devices
router.get('/trusted-devices', authenticate, async (req, res) => {
  try {
    const currentFingerprint = deviceFingerprint(req);
    const devices = await trustedDeviceService.getUserDevices(req.user.Id || req.user._id);
    // Never return the fingerprint itself; it is only used locally to flag the
    // current installation so the app can offer "remove other devices" safely.
    res.json({
      success: true,
      devices: devices.map((device) => ({
        id: device.Id,
        name: device.DeviceName || 'Unknown device',
        ipAddress: device.IpAddress || null,
        lastUsedAt: device.LastUsedAt || null,
        expiresAt: device.ExpiresAt || null,
        isCurrent: Boolean(currentFingerprint && device.DeviceFingerprint === currentFingerprint),
      })),
    });
  } catch (e) {
    console.error('[SECURITY] Trusted device list failed:', e.message);
    res.status(500).json({ success: false, message: 'Unable to load trusted devices' });
  }
});

router.delete('/trusted-devices/others', authenticate, async (req, res) => {
  try {
    const result = await trustedDeviceService.revokeOthers(req.user.Id || req.user._id, deviceFingerprint(req));
    if (!result.currentFound) {
      return res.status(409).json({ success: false, message: 'Unable to identify this trusted device' });
    }
    res.json({ success: true, message: 'Other trusted devices revoked' });
  } catch (e) {
    console.error('[SECURITY] Trusted-device revocation failed:', e.message);
    res.status(500).json({ success: false, message: 'Unable to revoke trusted devices' });
  }
});

router.delete('/trusted-devices/all', authenticate, async (req, res) => {
  try {
    await trustedDeviceService.revokeAll(req.user.Id || req.user._id);
    res.json({ success: true, message: 'All trusted devices revoked' });
  } catch (e) {
    console.error('[SECURITY] Trusted-device revocation failed:', e.message);
    res.status(500).json({ success: false, message: 'Unable to revoke trusted devices' });
  }
});

router.delete('/trusted-devices/:deviceId', authenticate, async (req, res) => {
  try {
    await trustedDeviceService.revoke(req.user.Id || req.user._id, req.params.deviceId);
    res.json({ success: true, message: 'Device revoked' });
  } catch (e) {
    console.error('[SECURITY] Trusted-device revocation failed:', e.message);
    res.status(500).json({ success: false, message: 'Unable to revoke device' });
  }
});

module.exports = router;
