const { sql, getPool, generateId } = require('../database/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const SystemLogService = require('../services/SystemLogService');
const otpService = require('../services/otpService');
const trustedDeviceService = require('../services/trustedDeviceService');
const tokenBlacklist = require('../services/tokenBlacklistService');
const { recordFailedAttempt, recordSuccessfulLogin, GENERIC_BLOCK } = require('../middleware/loginRateLimiter');
const { getClientIp } = require('../utils/clientIp');
const PasswordPolicy = require('../utils/passwordPolicy');
// F2 dual-mode refresh: JSON body tokens remain the primary contract (mobile);
// an httpOnly `retailops_rt` cookie is set/cleared ADDITIVELY at every token
// lifecycle point below. Cookie contents are never logged.
const { setRefreshCookie, clearRefreshCookie } = require('../utils/refreshCookie');

// SECURITY: rows come from SELECT * — strip credential material before any
// user object is serialized to a client (getMe / login / verifyOtp /
// register_disabled / updateProfile).
const SENSITIVE_USER_FIELDS = ['Password', 'RefreshToken', 'LockUntil', 'LoginAttempts', 'TwoFactorSecret'];
const sanitizeUserRow = (user) => {
  if (!user || typeof user !== 'object') return user;
  const clean = { ...user };
  for (const field of SENSITIVE_USER_FIELDS) delete clean[field];
  return clean;
};

// SECURITY: shared strength gate for every password-set path (documented
// policy: min 12 chars + zxcvbn score >= 3). Returns a generic message so
// we never disclose which rule failed.
const assertPasswordPolicy = (res, newPassword) => {
  const verdict = PasswordPolicy.validate(newPassword);
  if (!verdict.isValid) {
    res.status(400).json({ success: false, message: 'Password does not meet security requirements.' });
    return false;
  }
  return true;
};

const generateTokens = (userId, fingerprint) => {
  const accessToken = jwt.sign({ userId, type: 'access', fp: fingerprint || null }, config.jwt.secret, { expiresIn: config.jwt.expiresIn || '2h' });
  const refreshToken = jwt.sign({ userId, type: 'refresh', fp: fingerprint || null }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn || '7d' });
  return { accessToken, refreshToken };
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
    ...sanitizeUserRow(user),
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
    const { email, password } = req.body;
    const pool = await getPool();
    const clientIp = req._authMetadata?.clientIp || getClientIp(req);

    // SECURITY: uniform response for all "valid credentials but restricted
    // account" outcomes — identical shape so the endpoint cannot be used to
    // enumerate accounts. Discriminating details are logged server-side only.
    const genericSuccess = (reason) => {
      console.warn(`[REQUEST_OTP] Blocked OTP request (${reason}). Email: ${email} | IP: ${clientIp}`);
      return res.json({ success: true, requiresOtp: true });
    };

    if (!email || !password) {
      return res.status(400).json({ success: false, message: GENERIC_BLOCK });
    }

    const result = await pool.request()
      .input('email', sql.VarChar, email.toLowerCase().trim())
      .query('SELECT * FROM Users WHERE Email = @email');

    const user = result.recordset[0];

    // SECURITY: unknown email is indistinguishable from a wrong password —
    // same 401 GENERIC_BLOCK shape as login, and it counts as a failed
    // attempt so lockout applies.
    if (!user) {
      console.warn(`[REQUEST_OTP] Account not found. Email: ${email} | IP: ${clientIp}`);
      // SECURITY (Bug 11 fix): Prevent rate limit counter leakage for non-existent emails.
      await bcrypt.compare(password, '$2a$12$dummyhashdummyhashdummyhashdummyhashdummy');
      await SystemLogService.log({
        type: 'AUTH_FAILURE', entityType: 'USER', entityTitle: email,
        description: 'Failed OTP request: User not found',
        metadata: { ip: clientIp, email, reason: 'user_not_found' }
      });
      return res.status(401).json({ success: false, message: GENERIC_BLOCK });
    }

    // SECURITY (Bug 12 fix): Rely on Redis-based lockout (accountLockoutCheck middleware)
    // instead of DB LockUntil/LoginAttempts to avoid desync between the two systems.

    // SECURITY: verify the password EXACTLY as login does before minting any
    // session token. Previously this endpoint only checked email existence,
    // allowing full 2FA bypass.
    const isMatch = await bcrypt.compare(password, user.Password);
    if (!isMatch) {
      console.warn(`[REQUEST_OTP] Password mismatch. Email: ${email} | IP: ${clientIp}`);

      await SystemLogService.log({
        type: 'AUTH_FAILURE', entityType: 'USER', entityId: user.Id,
        entityTitle: email, user: user.Id,
        description: 'Password mismatch',
        metadata: { ip: clientIp, reason: 'password_mismatch', endpoint: 'request_otp' }
      });

      await recordFailedAttempt(email, clientIp);

      return res.status(401).json({ success: false, message: GENERIC_BLOCK });
    }

    // Password verified — clear failure counters in Redis (same as login).
    await recordSuccessfulLogin(email);

    // From here on, every rejection uses the uniform success response so no
    // account state can be probed with valid credentials.
    if (!user.IsActive) {
      await SystemLogService.log({
        type: 'AUTH_FAILURE', entityType: 'USER', entityId: user.Id,
        entityTitle: email, user: user.Id,
        description: `OTP request blocked: deactivated account (${email})`,
        metadata: { ip: clientIp }
      });
      return genericSuccess('deactivated');
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
      await SystemLogService.log({
        type: 'AUTH_FAILURE', entityType: 'USER', entityId: user.Id,
        entityTitle: email, user: user.Id,
        description: `OTP request blocked: no active seller associated (${email})`,
        metadata: { ip: clientIp }
      });
      return genericSuccess('no-seller');
    }

    // Generate temp token for OTP verification (must match verifyOtp's expected step)
    const tempToken = jwt.sign(
      { userId: user.Id, email: user.Email, step: 'LOGIN_PASSWORD_VERIFIED', purpose: 'OTP_VERIFICATION' },
      config.jwt.secret,
      { expiresIn: '10m' }
    );

    // Send OTP
    try {
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

exports.register_disabled = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const pool = await getPool();

    // Check if user exists
    const existing = await pool.request().input('email', sql.NVarChar, email).query('SELECT Id FROM Users WHERE Email = @email');
    if (existing.recordset.length > 0) return res.status(400).json({ success: false, message: 'Email already registered' });

    // Get role
    let roleId;
    if (req.body.role) {
      const roleResult = await pool.request().input('name', sql.NVarChar, req.body.role).query('SELECT Id FROM Roles WHERE Name = @name');
      if (roleResult.recordset.length > 0) roleId = roleResult.recordset[0].Id;
    }
    if (!roleId) {
      const viewerRole = await pool.request().query("SELECT Id FROM Roles WHERE Name = 'viewer'");
      roleId = viewerRole.recordset[0]?.Id;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = generateId();

    await pool.request()
      .input('id', sql.VarChar, userId)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('firstName', sql.NVarChar, firstName)
      .input('lastName', sql.NVarChar, lastName)
      .input('roleId', sql.VarChar, roleId)
      .query(`
        INSERT INTO Users (Id, Email, Password, FirstName, LastName, RoleId, IsActive, CreatedAt, UpdatedAt)
        VALUES (@id, @email, @password, @firstName, @lastName, @roleId, 1, dbo.GetEnvDate(), dbo.GetEnvDate())
      `);

    const { accessToken, refreshToken } = generateTokens(userId);
    await pool.request()
      .input('id', sql.VarChar, userId)
      .input('token', sql.NVarChar, refreshToken)
      .query('UPDATE Users SET RefreshToken = @token WHERE Id = @id');

    const user = (await pool.request().input('id', sql.VarChar, userId).query('SELECT * FROM Users WHERE Id = @id')).recordset[0];
    const resolvedUser = await getResolvedUserResponse(user, pool);

    res.status(201).json({ success: true, data: { user: resolvedUser, accessToken, refreshToken } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = await getPool();
    const clientIp = req._authMetadata?.clientIp || getClientIp(req);

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
      // SECURITY (Bug 11 fix): Prevent rate limit counter leakage for non-existent emails.
      // Do NOT call recordFailedAttempt with the real email — that would allow
      // enumeration via progressive delay/lockout side channels. Instead, perform
      // a dummy bcrypt comparison to maintain constant-time response characteristics.
      await bcrypt.compare(password, '$2a$12$dummyhashdummyhashdummyhashdummyhashdummy');
      return res.status(401).json({ success: false, message: GENERIC_BLOCK });
    }
    const user = result.recordset[0];

    // SECURITY (Bug 12 fix): Rely on Redis-based lockout (accountLockoutCheck middleware)
    // instead of DB LockUntil/LoginAttempts to avoid desync between the two systems.
    // The middleware runs before this controller and returns 423 if locked.

    if (!user.IsActive) {
      await SystemLogService.log({
        type: 'AUTH_FAILURE', entityType: 'USER', entityId: user.Id,
        entityTitle: email, user: user.Id,
        description: 'Deactivated account login attempt',
        metadata: { ip: clientIp, reason: 'account_deactivated' }
      });
      return res.status(403).json({ success: false, message: GENERIC_BLOCK });
    }

    const isMatch = await bcrypt.compare(password, user.Password);
    if (!isMatch) {
      console.warn(`[AUTH_FAILURE] Password mismatch. Email: ${email} | IP: ${clientIp}`);

      await SystemLogService.log({
        type: 'AUTH_FAILURE', entityType: 'USER', entityId: user.Id,
        entityTitle: email, user: user.Id,
        description: 'Password mismatch',
        metadata: { ip: clientIp, reason: 'password_mismatch', endpoint: 'login' }
      });

      // Track failure in Redis for progressive delay and lockout
      const failCount = await recordFailedAttempt(email, clientIp);
      console.warn(`[LOGIN] Progressive failure count for ${email}: ${failCount}/${5}`);

      return res.status(401).json({ success: false, message: GENERIC_BLOCK });
    }

    // Success — clear all failure counters in Redis
    await recordSuccessfulLogin(email);

    // Update last seen
    await pool.request()
      .input('id', sql.VarChar, user.Id)
      .query('UPDATE Users SET LastSeen = dbo.GetEnvDate() WHERE Id = @id');

    // SECURITY (Bug 8 fix): Check seller association — consistent with requestOtp
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
      await SystemLogService.log({
        type: 'AUTH_FAILURE', entityType: 'USER', entityId: user.Id,
        entityTitle: email, user: user.Id,
        description: `Login blocked: no active seller associated (${email})`,
        metadata: { ip: clientIp }
      });
      return res.status(403).json({ success: false, message: GENERIC_BLOCK });
    }

    // Track force password reset (don't block login — wizard handles it)
    const needsPasswordReset = !!(user.ForcePasswordReset) || (user.PasswordExpiresAt && new Date(user.PasswordExpiresAt) < new Date());

    // Check trusted device — skip OTP if trusted
    const fingerprint = trustedDeviceService.generateFingerprint(req, clientIp);
    const isTrustedDevice = await trustedDeviceService.isTrusted(user.Id, fingerprint);

    if (isTrustedDevice) {
      // Direct login from trusted device
      const { accessToken, refreshToken } = generateTokens(user.Id, fingerprint);
      await pool.request().input('id', sql.VarChar, user.Id).input('token', sql.NVarChar, refreshToken)
        .query('UPDATE Users SET RefreshToken = @token WHERE Id = @id');
      const resolvedUser = await getResolvedUserResponse(user, pool);
      await SystemLogService.log({
        type: 'AUTH_SUCCESS', entityType: 'USER', entityId: user.Id,
        entityTitle: resolvedUser.FirstName + ' ' + resolvedUser.LastName, user: user.Id,
        description: 'User logged in (trusted device)',
        metadata: { ip: clientIp, method: 'trusted_device' }
      });
      setRefreshCookie(res, refreshToken); // F2: additive cookie for browser sessions
      return res.json({ success: true, data: { user: resolvedUser, accessToken, refreshToken }, trustedDevice: true, requiresSetup: !!(user.IsFirstLogin) && !user.SetupCompletedAt, needsPasswordReset });
    }

    // OTP REQUIRED — Generate temp token and send OTP
    const tempToken = jwt.sign({ userId: user.Id, email: user.Email, step: 'LOGIN_PASSWORD_VERIFIED', purpose: 'OTP_VERIFICATION' }, config.jwt.secret, { expiresIn: '10m' });

    try {
      const otpResult = await otpService.sendOtp(user.Id, user.Email, 'LOGIN', { ipAddress: clientIp, userAgent: req.headers['user-agent'] });
      return res.json({ success: true, requiresOtp: true, tempToken, destination: otpResult.destination, expiresIn: otpResult.expiresIn, message: `Verification code sent to ${otpResult.destination}` });
    } catch (otpError) {
      return res.status(429).json({ success: false, message: otpError.message || 'Failed to send verification code' });
    }
  } catch (error) {
    // SECURITY (Bug 17 fix): Don't leak internal error details to client
    console.error('[AUTH] Login error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    // F2 dual-mode: token comes from the JSON body (mobile/back-compat) OR
    // from the httpOnly `retailops_rt` cookie (browser sessions). Body wins.
    // When a cookie was used, routes/authRoutes.js has already enforced the
    // Origin/Referer allowlist CSRF guard before this controller runs.
    const refreshToken = (req.body && req.body.refreshToken) || req.cookieRefreshToken || null;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Token required' });

    // SECURITY: consult revocation list before verifying (mirrors authenticate).
    if (await tokenBlacklist.isBlacklisted(refreshToken)) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // SECURITY: verify with the dedicated refresh secret (access-secret tokens
    // must never refresh a session). Falls back to JWT_SECRET only when
    // JWT_REFRESH_SECRET is unset (config/env.js).
    // SECURITY (RB1): algorithm pinning.
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret, { algorithms: ['HS256'] });

    // SECURITY: token-type pinning — only refresh tokens may mint new pairs.
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // SECURITY: honor per-user invalidation cutoff.
    if (await tokenBlacklist.isUserBlacklisted(decoded.userId, decoded.iat)) {
      return res.status(401).json({ success: false, message: 'Session invalidated' });
    }

    const pool = await getPool();

    const result = await pool.request().input('id', sql.VarChar, decoded.userId).query('SELECT * FROM Users WHERE Id = @id');
    const user = result.recordset[0];

    if (!user || user.RefreshToken !== refreshToken) return res.status(401).json({ success: false, message: 'Invalid token' });
    if (!user.IsActive) return res.status(403).json({ success: false, message: 'Deactivated' });

    // SECURITY (Bug 18 fix): Check if account is locked
    if (user.LockUntil && new Date(user.LockUntil) > new Date()) {
      return res.status(423).json({ success: false, message: 'Account locked' });
    }

    // SECURITY (Bug 5 fix): Preserve device fingerprint binding during token rotation
    const fingerprint = decoded.fp || null;
    const tokens = generateTokens(user.Id, fingerprint);
    await pool.request()
      .input('id', sql.VarChar, user.Id)
      .input('token', sql.NVarChar, tokens.refreshToken)
      .query('UPDATE Users SET RefreshToken = @token WHERE Id = @id');

    // F2: rotate the cookie alongside the rotated DB token.
    setRefreshCookie(res, tokens.refreshToken);

    res.json({ success: true, data: tokens });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

exports.logout = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.VarChar, req.userId).query('UPDATE Users SET RefreshToken = NULL WHERE Id = @id');

    // F2: expire the refresh cookie so the browser session cannot mint new
    // access tokens after logout.
    clearRefreshCookie(res);

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      await tokenBlacklist.blacklist(authHeader.split(' ')[1]);
    }
    
    // Log Logout
    if (req.userId) {
      await SystemLogService.log({
        type: 'AUTH_LOGOUT',
        entityType: 'USER',
        entityId: req.userId,
        entityTitle: 'User Session',
        user: req.userId,
        description: 'User logged out',
        metadata: { ip: getClientIp(req) }
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
    // SECURITY: SELECT * includes Password hash / RefreshToken / lockout
    // counters — strip credential material before responding.
    res.json({ success: true, data: sanitizeUserRow(result.recordset[0]) });
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

    const clientIp = getClientIp(req);
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
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    if (!tempToken || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token, OTP, and new password are required' });
    }

    // SECURITY: enforce documented password policy on the new password.
    if (!assertPasswordPolicy(res, newPassword)) return;

    let decoded;
    try {
      // SECURITY (RB1): algorithm pinning.
      decoded = jwt.verify(tempToken, config.jwt.secret, { algorithms: ['HS256'] });
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

    // SECURITY (Bug 7 fix): Use transaction to prevent password history race condition
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();

      // Check password history within transaction
      const historyResult = await transaction.request()
        .input('id', sql.VarChar, decoded.userId)
        .query('SELECT TOP 5 PasswordHash FROM PasswordHistory WHERE UserId = @id ORDER BY ChangedAt DESC');
      for (const row of historyResult.recordset) {
        if (await bcrypt.compare(newPassword, row.PasswordHash)) {
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Cannot reuse last 5 passwords' });
        }
      }

      const hashed = await bcrypt.hash(newPassword, 12);

      const histId = require('crypto').randomBytes(12).toString('hex');
      await transaction.request()
        .input('id', sql.VarChar, decoded.userId)
        .input('hash', sql.NVarChar, user.Password)
        .input('hid', sql.VarChar, histId)
        .query('INSERT INTO PasswordHistory (Id, UserId, PasswordHash, ChangedAt) VALUES (@hid, @id, @hash, dbo.GetEnvDate())');

      await transaction.request()
        .input('id', sql.VarChar, decoded.userId)
        .input('pw', sql.NVarChar, hashed)
        .query(`UPDATE Users SET Password = @pw, ForcePasswordReset = 0, 
                PasswordChangedAt = dbo.GetEnvDate(), 
                PasswordExpiresAt = DATEADD(day, 90, dbo.GetEnvDate()),
                RefreshToken = NULL, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id`);

      // SECURITY (Bug 14 fix): Invalidate any existing password reset tokens for this user
      await transaction.request()
        .input('userId', sql.VarChar, decoded.userId)
        .query(`UPDATE PasswordResets SET UsedAt = dbo.GetEnvDate() WHERE UserId = @userId AND UsedAt IS NULL`);

      await transaction.commit();
    } catch (txError) {
      try { await transaction.rollback(); } catch (_) {}
      throw txError;
    }

    await tokenBlacklist.blacklistUser(decoded.userId);

    // F2: the refresh token was nulled in DB above — expire the cookie too.
    clearRefreshCookie(res);

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

    // SECURITY: enforce documented password policy on the new password.
    if (!assertPasswordPolicy(res, newPassword)) return;

    // SECURITY (Bug 7 fix): Use transaction to prevent password history race condition
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();

      // Check password history within transaction
      const historyResult = await transaction.request()
        .input('id', sql.VarChar, req.userId)
        .query('SELECT TOP 5 PasswordHash FROM PasswordHistory WHERE UserId = @id ORDER BY ChangedAt DESC');
      for (const row of historyResult.recordset) {
        if (await bcrypt.compare(newPassword, row.PasswordHash)) {
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Cannot reuse last 5 passwords' });
        }
      }

      const hashed = await bcrypt.hash(newPassword, 12);
      
      const histId = require('crypto').randomBytes(12).toString('hex');
      await transaction.request()
        .input('id', sql.VarChar, req.userId)
        .input('hash', sql.NVarChar, user.Password)
        .input('hid', sql.VarChar, histId)
        .query('INSERT INTO PasswordHistory (Id, UserId, PasswordHash, ChangedAt) VALUES (@hid, @id, @hash, dbo.GetEnvDate())');

      await transaction.request()
        .input('id', sql.VarChar, req.userId)
        .input('pw', sql.NVarChar, hashed)
        .query(`UPDATE Users SET Password = @pw, ForcePasswordReset = 0, 
                PasswordChangedAt = dbo.GetEnvDate(), 
                PasswordExpiresAt = DATEADD(day, 90, dbo.GetEnvDate()),
                RefreshToken = NULL, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id`);

      // SECURITY (Bug 14 fix): Invalidate any existing password reset tokens for this user
      await transaction.request()
        .input('userId', sql.VarChar, req.userId)
        .query(`UPDATE PasswordResets SET UsedAt = dbo.GetEnvDate() WHERE UserId = @userId AND UsedAt IS NULL`);

      await transaction.commit();
    } catch (txError) {
      try { await transaction.rollback(); } catch (_) {}
      throw txError;
    }

    await tokenBlacklist.blacklistUser(req.userId);

    // F2: the refresh token was nulled in DB above — expire the cookie too.
    clearRefreshCookie(res);

    res.json({ success: true, message: 'Password changed. Please login again.' });
  } catch (error) {
    console.error('[AUTH] Change password error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { tempToken, otp, trustDevice } = req.body;
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    if (!tempToken || !otp) return res.status(400).json({ success: false, message: 'Token and OTP are required' });

    let decoded;
    try {
      // SECURITY (RB1): algorithm pinning.
      decoded = jwt.verify(tempToken, config.jwt.secret, { algorithms: ['HS256'] });
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Session expired. Please login again.', code: 'SESSION_EXPIRED' });
    }

    if (decoded.purpose !== 'OTP_VERIFICATION' || decoded.step !== 'LOGIN_PASSWORD_VERIFIED') {
      return res.status(401).json({ success: false, message: 'Invalid session token' });
    }

    const pool = await getPool();
    const result = await pool.request().input('id', sql.VarChar, decoded.userId).query('SELECT * FROM Users WHERE Id = @id AND IsActive = 1');
    const user = result.recordset[0];
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // Verify OTP
    await otpService.verifyOtp(user.Id, otp, 'LOGIN', { ipAddress: clientIp, userAgent });

    // Trust device if requested
    const fingerprint = trustedDeviceService.generateFingerprint(req, clientIp);
    if (trustDevice) {
      await trustedDeviceService.trust(user.Id, fingerprint, { ipAddress: clientIp, userAgent });
    }

    // Complete login — generate tokens
    const { accessToken, refreshToken } = generateTokens(user.Id, fingerprint);
    await pool.request().input('id', sql.VarChar, user.Id).input('token', sql.NVarChar, refreshToken)
      .query('UPDATE Users SET RefreshToken = @token WHERE Id = @id');

    const resolvedUser = await getResolvedUserResponse(user, pool);
    await SystemLogService.log({
      type: 'AUTH_SUCCESS', entityType: 'USER', entityId: user.Id,
      entityTitle: resolvedUser.FirstName + ' ' + resolvedUser.LastName, user: user.Id,
      description: 'User logged in (OTP verified)',
      metadata: { ip: clientIp, method: 'otp', trustDevice: !!trustDevice }
    });

    const needsPasswordReset = !!(user.ForcePasswordReset) || (user.PasswordExpiresAt && new Date(user.PasswordExpiresAt) < new Date());
    setRefreshCookie(res, refreshToken); // F2: additive cookie for browser sessions
    res.json({ success: true, data: { user: resolvedUser, accessToken, refreshToken }, requiresSetup: !!(user.IsFirstLogin) && !user.SetupCompletedAt, needsPasswordReset });
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
    // SECURITY (RB1): algorithm pinning.
    try { decoded = jwt.verify(tempToken, config.jwt.secret, { algorithms: ['HS256'] }); } catch (e) { return res.status(401).json({ success: false, message: 'Session expired' }); }

    // SECURITY: validate token purpose (Bug 2 fix - differentiate login vs password change)
    if (decoded.purpose !== 'OTP_VERIFICATION' || decoded.step !== 'LOGIN_PASSWORD_VERIFIED') {
      return res.status(401).json({ success: false, message: 'Invalid session token' });
    }

    const pool = await getPool();
    const result = await pool.request().input('id', sql.VarChar, decoded.userId).query('SELECT Email FROM Users WHERE Id = @id AND IsActive = 1');
    const user = result.recordset[0];
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    const otpResult = await otpService.resendOtp(decoded.userId, user.Email, 'LOGIN', { ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] });

    res.json({ success: true, destination: otpResult.destination, expiresIn: otpResult.expiresIn, message: `New code sent to ${otpResult.destination}` });
  } catch (error) {
    // SECURITY (Bug 17 fix): Don't leak internal error details to client
    console.error('[AUTH] Resend OTP error:', error.message, error.stack);
    res.status(429).json({ success: false, message: 'Failed to resend code' });
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
      // SECURITY (Contract C): the token travels in the URL FRAGMENT
      // (#token=...), which browsers never send to servers — it stays out of
      // access logs, proxies, Referer headers and browser history sync.
      // BACKWARD COMPAT: the frontend reset page also accepts ?token= query
      // links during the transition window; token generation/validation is
      // unchanged.
      const resetUrl = `${config.brand?.dashboardUrl || process.env.DASHBOARD_URL || 'https://data.brandcentral.in'}/reset-password#token=${result.token}`;
      const ipAddress = getClientIp(req);
      
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
    // Contract C: the frontend extracts the token from the URL fragment
    // (#token=...) and forwards it here; legacy clients may still send it as
    // ?token= (query) or in the JSON body — accept all three shapes.
    const token = req.query.token || (req.body && req.body.token);
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

    // SECURITY: enforce the documented password policy (min length 12 +
    // zxcvbn score >= 3) — previously only a length<8 check existed here.
    if (!assertPasswordPolicy(res, newPassword)) return;

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
