const { sql, getPool, generateId } = require('../database/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const SystemLogService = require('../services/SystemLogService');
const otpService = require('../services/otpService');
const trustedDeviceService = require('../services/trustedDeviceService');
const tokenBlacklist = require('../services/tokenBlacklistService');
const { recordFailedAttempt, recordSuccessfulLogin, GENERIC_BLOCK } = require('../middleware/loginRateLimiter');

const generateTokens = (userId, fingerprint) => {
  const accessToken = jwt.sign({ userId, type: 'access', fp: fingerprint || null }, config.jwt.secret, { expiresIn: config.jwt.expiresIn || '2h' });
  const refreshToken = jwt.sign({ userId, type: 'refresh', fp: fingerprint || null }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn || '7d' });
  return { accessToken, refreshToken };
};

const AUTH_COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',
};
const ACCESS_COOKIE_MAX_AGE = 2 * 60 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
// Must match the refresh route (POST /api/auth/refresh-token) or the browser
// will not send the cookie back and every refresh fails.
const REFRESH_COOKIE_PATH = '/api/auth/refresh-token';

const setAuthCookies = (res, tokens) => {
  res.cookie('accessToken', tokens.accessToken, {
    ...AUTH_COOKIE_BASE,
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });
  res.cookie('refreshToken', tokens.refreshToken, {
    ...AUTH_COOKIE_BASE,
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: REFRESH_COOKIE_PATH,
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', { ...AUTH_COOKIE_BASE });
  res.clearCookie('refreshToken', { ...AUTH_COOKIE_BASE, path: REFRESH_COOKIE_PATH });
};

const getResolvedUserResponse = async (user, pool) => {
  // Fetch role details
  const roleResult = await pool.request()
    .input('roleId', sql.VarChar, user.RoleId)
    .query('SELECT Name, DisplayName FROM Roles WHERE Id = @roleId');
  
  const roleInfo = roleResult.recordset[0] || { Name: 'viewer', DisplayName: 'Viewer' };

  // Fetch permissions
  const permsResult = await pool.request()
    .input('roleId', sql.VarChar, user.RoleId)
    .query(`
      SELECT P.Name FROM Permissions P
      JOIN RolePermissions RP ON P.Id = RP.PermissionId
      WHERE RP.RoleId = @roleId
    `);
  
  return {
    ...user,
    _id: user.Id,
    id: user.Id,
    role: {
      Name: roleInfo.Name,
      DisplayName: roleInfo.DisplayName
    },
    permissions: permsResult.recordset.map(p => p.Name)
  };
};

exports.register = async (req, res) => {
  return res.status(403).json({ success: false, message: 'Registration is currently disabled.' });
};

exports.requestOtp = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.VarChar, email.toLowerCase().trim())
      .query('SELECT * FROM Users WHERE Email = @email');

    const user = result.recordset[0];

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email' });
    }

    if (!user.IsActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    // Check if user is associated with any active seller
    const sellerCheck = await pool.request()
      .input('userId', sql.VarChar, user.Id)
      .query(`
        SELECT COUNT(*) as sellerCount 
        FROM UserSellers US
        JOIN Sellers S ON US.SellerId = S.Id
        WHERE US.UserId = @userId AND S.IsActive = 1
      `);

    const sellerCount = sellerCheck.recordset[0]?.sellerCount || 0;

    if (sellerCount === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'No seller account associated with this email. Please contact your administrator.' 
      });
    }

    // Generate temp token for OTP verification (must match verifyOtp's expected step)
    const tempToken = jwt.sign(
      { userId: user.Id, email: user.Email, step: 'PASSWORD_VERIFIED', purpose: 'OTP_VERIFICATION' },
      config.jwt.secret,
      { expiresIn: '10m' }
    );

    // Send OTP
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const otpResult = await otpService.sendOtp(
        user.Id,
        user.Email,
        'LOGIN',
        { ipAddress: clientIp, userAgent: req.headers['user-agent'], source: req.headers['x-platform'] || 'web' }
      );
      
      return res.json({
        success: true,
        requiresOtp: true,
        tempToken,
        destination: otpResult.destination,
        expiresIn: otpResult.expiresIn,
        message: `Verification code sent to ${otpResult.destination}`
      });
    } catch (otpError) {
      return res.status(429).json({
        success: false,
        message: otpError.message || 'Failed to send verification code'
      });
    }
  } catch (error) {
    console.error('[REQUEST_OTP] Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.register = async (req, res) => {
  return res.status(403).json({ success: false, message: 'Registration is currently disabled.' });
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = await getPool();
    const clientIp = req._authMetadata?.clientIp || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE Email = @email');

    if (result.recordset.length === 0) {
      console.warn(`[AUTH_FAILURE] Account not found. Email: ${email} | IP: ${clientIp}`);
      await SystemLogService.log({
        type: 'AUTH_FAILURE', entityType: 'USER', entityTitle: email,
        description: `Failed login attempt: User not found (${email})`,
        metadata: { ip: clientIp, email }
      });
      // Record failed attempt even for non-existent emails (prevents user enumeration timing attacks)
      await recordFailedAttempt(email, clientIp);
      return res.status(401).json({ success: false, message: GENERIC_BLOCK });
    }
    const user = result.recordset[0];

    if (user.LockUntil && new Date(user.LockUntil) > new Date()) {
      await SystemLogService.log({
        type: 'AUTH_FAILURE', entityType: 'USER', entityId: user.Id,
        entityTitle: email, user: user.Id,
        description: `Locked login attempt: ${email}`,
        metadata: { ip: clientIp }
      });
      return res.status(423).json({ success: false, message: GENERIC_BLOCK });
    }

    if (!user.IsActive) {
      await SystemLogService.log({
        type: 'AUTH_FAILURE', entityType: 'USER', entityId: user.Id,
        entityTitle: email, user: user.Id,
        description: `Deactivated account login attempt: ${email}`,
        metadata: { ip: clientIp }
      });
      return res.status(403).json({ success: false, message: GENERIC_BLOCK });
    }

    const isMatch = await bcrypt.compare(password, user.Password);
    if (!isMatch) {
      const attempts = (user.LoginAttempts || 0) + 1;
      let lockUntil = null;
      if (attempts >= 5) lockUntil = new Date(Date.now() + 15 * 60 * 1000);

      await pool.request()
        .input('id', sql.VarChar, user.Id)
        .input('attempts', sql.Int, attempts)
        .input('lockUntil', sql.DateTime, lockUntil)
        .query('UPDATE Users SET LoginAttempts = @attempts, LockUntil = @lockUntil WHERE Id = @id');

      console.warn(`[AUTH_FAILURE] Password mismatch. Email: ${email} | IP: ${clientIp} | Attempt: ${attempts}`);

      await SystemLogService.log({
        type: 'AUTH_FAILURE', entityType: 'USER', entityId: user.Id,
        entityTitle: email, user: user.Id,
        description: `Password mismatch. Attempt: ${attempts}`,
        metadata: { ip: clientIp, attempts }
      });

      // Track failure in Redis for progressive delay and lockout
      const failCount = await recordFailedAttempt(email, clientIp);
      console.warn(`[LOGIN] Progressive failure count for ${email}: ${failCount}/${5}`);

      return res.status(401).json({ success: false, message: GENERIC_BLOCK });
    }

    // Success — clear all failure counters
    await recordSuccessfulLogin(email);

    // Reset login attempts in DB
    if (user.LoginAttempts > 0 || user.LockUntil) {
      await pool.request()
        .input('id', sql.VarChar, user.Id)
        .query('UPDATE Users SET LoginAttempts = 0, LockUntil = NULL WHERE Id = @id');
    }

    await pool.request()
      .input('id', sql.VarChar, user.Id)
      .query('UPDATE Users SET LoginAttempts = 0, LockUntil = NULL, LastSeen = dbo.GetEnvDate() WHERE Id = @id');

    // Track force password reset (don't block login — wizard handles it)
    const needsPasswordReset = !!(user.ForcePasswordReset) || (user.PasswordExpiresAt && new Date(user.PasswordExpiresAt) < new Date());

    // Check trusted device — skip OTP if trusted
    const fingerprint = Buffer.from(`${req.headers['user-agent'] || ''}|${clientIp}`).toString('base64').slice(0, 32);
    const isTrustedDevice = await trustedDeviceService.isTrusted(user.Id, fingerprint);

    if (isTrustedDevice) {
      // Direct login from trusted device
      const tokens = generateTokens(user.Id, fingerprint);
      setAuthCookies(res, tokens);
      await pool.request().input('id', sql.NVarChar, user.Id).input('token', sql.NVarChar, tokens.refreshToken)
        .query('UPDATE Users SET RefreshToken = @token WHERE Id = @id');
      const resolvedUser = await getResolvedUserResponse(user, pool);
      await SystemLogService.log({ type: 'AUTH_SUCCESS', entityType: 'USER', entityId: user.Id, entityTitle: resolvedUser.FirstName + ' ' + resolvedUser.LastName, user: user.Id, description: `${resolvedUser.FirstName} logged in (trusted device)`, metadata: { ip: clientIp } });
      return res.json({ success: true, data: { user: resolvedUser }, trustedDevice: true, requiresSetup: !!(user.IsFirstLogin) && !user.SetupCompletedAt, needsPasswordReset });
    }

    // OTP REQUIRED — Generate temp token and send OTP
    const tempToken = jwt.sign({ userId: user.Id, email: user.Email, step: 'PASSWORD_VERIFIED', purpose: 'OTP_VERIFICATION' }, config.jwt.secret, { expiresIn: '10m' });

    try {
      const otpResult = await otpService.sendOtp(user.Id, user.Email, 'LOGIN', { ipAddress: clientIp, userAgent: req.headers['user-agent'] });
      return res.json({ success: true, requiresOtp: true, tempToken, destination: otpResult.destination, expiresIn: otpResult.expiresIn, message: `Verification code sent to ${otpResult.destination}` });
    } catch (otpError) {
      return res.status(429).json({ success: false, message: otpError.message || 'Failed to send verification code' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    // Cookie is the browser path; body stays supported for API clients.
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Token required' });

    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    const pool = await getPool();

    const result = await pool.request().input('id', sql.VarChar, decoded.userId).query('SELECT * FROM Users WHERE Id = @id');
    const user = result.recordset[0];

    if (!user || user.RefreshToken !== refreshToken) return res.status(401).json({ success: false, message: 'Invalid token' });
    if (!user.IsActive) return res.status(403).json({ success: false, message: 'Deactivated' });

    const tokens = generateTokens(user.Id);
    await pool.request()
      .input('id', sql.VarChar, user.Id)
      .input('token', sql.NVarChar, tokens.refreshToken)
      .query('UPDATE Users SET RefreshToken = @token WHERE Id = @id');

    setAuthCookies(res, tokens);

    res.json({ success: true, data: tokens });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

exports.logout = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.VarChar, req.userId).query('UPDATE Users SET RefreshToken = NULL WHERE Id = @id');

    const authHeader = req.headers.authorization;
    const accessToken =
      req.cookies?.accessToken ||
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);
    if (accessToken) {
      await tokenBlacklist.blacklist(accessToken);
    }

    clearAuthCookies(res);
    
    // Log Logout
    if (req.userId) {
      await SystemLogService.log({
        type: 'AUTH_LOGOUT',
        entityType: 'USER',
        entityId: req.userId,
        entityTitle: 'User Session',
        user: req.userId,
        description: 'User logged out'
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

exports.getMe = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().input('id', sql.VarChar, req.userId).query('SELECT * FROM Users WHERE Id = @id');
    if (result.recordset.length === 0) return res.status(404).json({ success: false });
    const user = result.recordset[0];

    // Fetch assigned sellers with full details
    let sellers = [];
    try {
      const sellersResult = await pool.request()
        .input('userId', sql.VarChar, req.userId)
        .query(`
          SELECT S.Id, S.Name, S.Marketplace, S.SellerId, S.IsActive, S.[Plan],
                 S.PartnerTag, S.CreatedAt
          FROM Sellers S
          JOIN UserSellers US ON S.Id = US.SellerId
          WHERE US.UserId = @userId AND S.IsActive = 1
        `);
      sellers = sellersResult.recordset;
    } catch (e) {
      console.error('[AUTH] Failed to fetch sellers:', e.message);
    }

    const resolvedUser = await getResolvedUserResponse(user, pool);
    resolvedUser.sellers = sellers;
    resolvedUser.assignedSellers = sellers.map(s => s.Id);

    res.json({ success: true, data: resolvedUser });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, preferences } = req.body;
    const pool = await getPool();

    await pool.request()
      .input('id', sql.VarChar, req.userId)
      .input('fn', sql.NVarChar, firstName)
      .input('ln', sql.NVarChar, lastName)
      .input('ph', sql.NVarChar, phone)
      .input('pref', sql.NVarChar, JSON.stringify(preferences))
      .query(`
        UPDATE Users SET 
          FirstName = @fn, LastName = @ln, Phone = @ph, Preferences = @pref, UpdatedAt = dbo.GetEnvDate()
        WHERE Id = @id
      `);

    const result = await pool.request().input('id', sql.VarChar, req.userId).query('SELECT * FROM Users WHERE Id = @id');
    res.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

exports.requestPasswordChange = async (req, res) => {
  try {
    const { currentPassword } = req.body;
    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.VarChar, req.userId)
      .query('SELECT Id, Email, FirstName, LastName, Password FROM Users WHERE Id = @id AND IsActive = 1');
    const user = result.recordset[0];

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.Password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const otpResult = await otpService.sendOtp(
      user.Id,
      user.Email,
      'PASSWORD_CHANGE',
      { ipAddress: clientIp, userAgent, source: 'profile' }
    );

    const tempToken = jwt.sign(
      { userId: user.Id, email: user.Email, step: 'PASSWORD_VERIFIED', purpose: 'PASSWORD_CHANGE' },
      config.jwt.secret,
      { expiresIn: '10m' }
    );

    res.json({
      success: true,
      tempToken,
      destination: otpResult.destination,
      expiresIn: otpResult.expiresIn,
      message: `Verification code sent to ${otpResult.destination}`
    });
  } catch (error) {
    console.error('[AUTH] Request password change error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to send verification code' });
  }
};

exports.changePasswordWithOtp = async (req, res) => {
  try {
    const { tempToken, otp, newPassword } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!tempToken || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token, OTP, and new password are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, config.jwt.secret);
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Session expired. Please start again.' });
    }

    if (decoded.purpose !== 'PASSWORD_CHANGE' || decoded.step !== 'PASSWORD_VERIFIED') {
      return res.status(401).json({ success: false, message: 'Invalid session token' });
    }

    await otpService.verifyOtp(decoded.userId, otp, 'PASSWORD_CHANGE', { ipAddress: clientIp, userAgent });

    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.VarChar, decoded.userId)
      .query('SELECT Id, Password FROM Users WHERE Id = @id AND IsActive = 1');
    const user = result.recordset[0];

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const historyResult = await pool.request()
      .input('id', sql.VarChar, decoded.userId)
      .query('SELECT TOP 5 PasswordHash FROM PasswordHistory WHERE UserId = @id ORDER BY ChangedAt DESC');
    for (const row of historyResult.recordset) {
      if (await bcrypt.compare(newPassword, row.PasswordHash)) {
        return res.status(400).json({ success: false, message: 'Cannot reuse last 5 passwords' });
      }
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    const histId = require('crypto').randomBytes(12).toString('hex');
    await pool.request()
      .input('id', sql.VarChar, decoded.userId)
      .input('hash', sql.NVarChar, user.Password)
      .input('hid', sql.VarChar, histId)
      .query('INSERT INTO PasswordHistory (Id, UserId, PasswordHash, ChangedAt) VALUES (@hid, @id, @hash, dbo.GetEnvDate())');

    await pool.request()
      .input('id', sql.VarChar, decoded.userId)
      .input('pw', sql.NVarChar, hashed)
      .query(`UPDATE Users SET Password = @pw, ForcePasswordReset = 0, 
              PasswordChangedAt = dbo.GetEnvDate(), 
              PasswordExpiresAt = DATEADD(day, 90, dbo.GetEnvDate()),
              RefreshToken = NULL, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id`);

    await tokenBlacklist.blacklistUser(decoded.userId);

    res.json({ success: true, message: 'Password changed successfully. Please login again.' });
  } catch (error) {
    if (error.message && error.message.includes('OTP')) {
      return res.status(401).json({ success: false, message: error.message });
    }
    console.error('[AUTH] Change password with OTP error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const pool = await getPool();

    const result = await pool.request().input('id', sql.VarChar, req.userId).query('SELECT * FROM Users WHERE Id = @id');
    const user = result.recordset[0];

    const isMatch = await bcrypt.compare(currentPassword, user.Password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Current password incorrect' });

    const historyResult = await pool.request()
      .input('id', sql.VarChar, req.userId)
      .query('SELECT TOP 5 PasswordHash FROM PasswordHistory WHERE UserId = @id ORDER BY ChangedAt DESC');
    for (const row of historyResult.recordset) {
      if (await bcrypt.compare(newPassword, row.PasswordHash)) {
        return res.status(400).json({ success: false, message: 'Cannot reuse last 5 passwords' });
      }
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    
    const histId = require('crypto').randomBytes(12).toString('hex');
    await pool.request()
      .input('id', sql.VarChar, req.userId)
      .input('hash', sql.NVarChar, user.Password)
      .input('hid', sql.VarChar, histId)
      .query('INSERT INTO PasswordHistory (Id, UserId, PasswordHash, ChangedAt) VALUES (@hid, @id, @hash, dbo.GetEnvDate())');

    await pool.request()
      .input('id', sql.VarChar, req.userId)
      .input('pw', sql.NVarChar, hashed)
      .query(`UPDATE Users SET Password = @pw, ForcePasswordReset = 0, 
              PasswordChangedAt = dbo.GetEnvDate(), 
              PasswordExpiresAt = DATEADD(day, 90, dbo.GetEnvDate()),
              RefreshToken = NULL, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id`);

    await tokenBlacklist.blacklistUser(req.userId);

    res.json({ success: true, message: 'Password changed. Please login again.' });
  } catch (error) {
    console.error('[AUTH] Change password error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { tempToken, otp, trustDevice } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];

    if (!tempToken || !otp) return res.status(400).json({ success: false, message: 'Token and OTP are required' });

    let decoded;
    try {
      decoded = jwt.verify(tempToken, config.jwt.secret);
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Session expired. Please login again.', code: 'SESSION_EXPIRED' });
    }

    if (decoded.purpose !== 'OTP_VERIFICATION' || decoded.step !== 'PASSWORD_VERIFIED') {
      return res.status(401).json({ success: false, message: 'Invalid session token' });
    }

    const pool = await getPool();
    const result = await pool.request().input('id', sql.VarChar, decoded.userId).query('SELECT * FROM Users WHERE Id = @id AND IsActive = 1');
    const user = result.recordset[0];
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // Verify OTP
    await otpService.verifyOtp(user.Id, otp, 'LOGIN', { ipAddress: clientIp, userAgent });

    // Trust device if requested
    const fingerprint = Buffer.from(`${userAgent || ''}|${clientIp}`).toString('base64').slice(0, 32);
    if (trustDevice) {
      await trustedDeviceService.trust(user.Id, fingerprint, { ipAddress: clientIp, userAgent });
    }

    // Complete login — generate tokens
    const tokens = generateTokens(user.Id, fingerprint);

    setAuthCookies(res, tokens);

    await pool.request().input('id', sql.VarChar, user.Id).input('token', sql.NVarChar, tokens.refreshToken)
      .query('UPDATE Users SET RefreshToken = @token WHERE Id = @id');

    const resolvedUser = await getResolvedUserResponse(user, pool);
    await SystemLogService.log({ type: 'AUTH_SUCCESS', entityType: 'USER', entityId: user.Id, entityTitle: resolvedUser.FirstName + ' ' + resolvedUser.LastName, user: user.Id, description: `${resolvedUser.FirstName} logged in (OTP verified)`, metadata: { ip: clientIp } });

    const needsPasswordReset = !!(user.ForcePasswordReset) || (user.PasswordExpiresAt && new Date(user.PasswordExpiresAt) < new Date());
    res.json({ success: true, data: { user: resolvedUser }, requiresSetup: !!(user.IsFirstLogin) && !user.SetupCompletedAt, needsPasswordReset });
  } catch (error) {
    if (error.message && error.message.includes('OTP')) {
      return res.status(401).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { tempToken } = req.body;
    if (!tempToken) return res.status(400).json({ success: false, message: 'Token required' });

    let decoded;
    try { decoded = jwt.verify(tempToken, config.jwt.secret); } catch (e) { return res.status(401).json({ success: false, message: 'Session expired' }); }

    const pool = await getPool();
    const result = await pool.request().input('id', sql.VarChar, decoded.userId).query('SELECT Email FROM Users WHERE Id = @id AND IsActive = 1');
    const user = result.recordset[0];
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    const otpResult = await otpService.resendOtp(decoded.userId, user.Email, 'LOGIN', { ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress, userAgent: req.headers['user-agent'] });

    res.json({ success: true, destination: otpResult.destination, expiresIn: otpResult.expiresIn, message: `New code sent to ${otpResult.destination}` });
  } catch (error) {
    res.status(429).json({ success: false, message: error.message || 'Failed to resend code' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const passwordResetService = require('../services/passwordResetService');
    const emailService = require('../services/emailService');
    const passwordResetTemplate = require('../emails/templates/auth/passwordReset');

    const result = await passwordResetService.generateResetToken(email);
    
    if (result.success) {
      const resetUrl = `${config.brand?.dashboardUrl || process.env.DASHBOARD_URL || 'https://data.brandcentral.in'}/reset-password?token=${result.token}`;
      const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      
      const html = passwordResetTemplate({
        userName: result.user.firstName,
        resetUrl,
        expiresInMinutes: 60,
        ipAddress
      });

      await emailService.send({
        to: result.user.email,
        subject: 'Reset Your RetailOps Password',
        html
      });
    }

    res.json({ success: true, message: 'If an account exists with this email, a reset link has been sent.' });
  } catch (error) {
    console.error('[AUTH] Forgot password error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
};

exports.validateResetToken = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

    const passwordResetService = require('../services/passwordResetService');
    const result = await passwordResetService.validateResetToken(token);

    if (!result.valid) {
      return res.status(400).json({ success: false, valid: false, message: result.message });
    }

    res.json({ success: true, valid: true, email: result.email, firstName: result.firstName });
  } catch (error) {
    console.error('[AUTH] Validate reset token error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to validate token' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Token and new password are required' });

    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

    const passwordResetService = require('../services/passwordResetService');
    const result = await passwordResetService.resetPassword(token, newPassword);

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    res.json({ success: true, message: 'Password reset successfully. You can now login with your new password.' });
  } catch (error) {
    console.error('[AUTH] Reset password error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};
