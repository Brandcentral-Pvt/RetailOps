const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const rateLimit = require('express-rate-limit');
const { ipRateLimiter, accountLockoutCheck } = require('../middleware/loginRateLimiter');
// F2: dual-mode refresh-token cookie support (no new deps — tiny parser util).
const { parseRefreshCookie, requestOriginAllowed } = require('../utils/refreshCookie');

const otpLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 5, message: { success: false, message: 'Too many OTP requests, try again later' } });
const requestOtpLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 3, message: { success: false, message: 'Too many OTP requests, try again later' } });
// SECURITY: strict per-IP tier for token refresh (token-minting endpoint).
const refreshLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests, please try again later' } });

// F2 CSRF guard for cookie-based refresh: when the refresh token is supplied
// via the httpOnly `retailops_rt` cookie (browser flow), require the request's
// Origin/Referer to match FRONTEND_URL/DASHBOARD_URL origins — a cross-site
// page cannot silently replay the cookie. Requests carrying the token in the
// JSON body (mobile/back-compat) skip this guard entirely and are unaffected.
function cookieRefreshCsrfGuard(req, res, next) {
    const cookieToken = parseRefreshCookie(req);
    if (!cookieToken) return next(); // body/Bearer flow — untouched
    if (!requestOriginAllowed(req)) {
        console.warn('[AUTH] refresh-token rejected: cookie used without allowlisted Origin/Referer');
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    req.cookieRefreshToken = cookieToken; // controller falls back to this; body wins
    return next();
}

router.post('/register', (req, res) => res.status(403).json({ message: 'Registration is currently disabled' }));
router.post('/login',
    ipRateLimiter,           // Layer 1: IP rate limit — 10 req/min per IP
    validate('login'),       // Validate email + password format
    accountLockoutCheck,     // Layer 2+3: Check lockout + progressive delay
    authController.login
);
router.post('/request-otp',
    validate('requestOtp'),  // SECURITY: require email + password (2FA bypass fix)
    accountLockoutCheck,     // Layer 2+3: Check lockout + progressive delay (runs first so locked accounts don't consume rate limit slots)
    requestOtpLimiter,       // Endpoint-specific: 3 req / 5 min
    ipRateLimiter,           // Layer 1: IP rate limit — shared with /login
    authController.requestOtp
);
router.post('/verify-otp', otpLimiter, validate('verifyOtp'), authController.verifyOtp);
router.post('/resend-otp', otpLimiter, validate('resendOtp'), authController.resendOtp);
router.post('/refresh-token', refreshLimiter, cookieRefreshCsrfGuard, authController.refreshToken);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, authController.updateProfile);
router.post('/request-password-change', authenticate, authController.requestPasswordChange);
router.put('/change-password', authenticate, validate('changePassword'), authController.changePassword);
// SECURITY: schema was defined but never wired — OTP-gated password change
// now validates tempToken/otp shape and newPassword policy preconditions.
router.put('/change-password-with-otp', authenticate, validate('changePasswordWithOtp'), authController.changePasswordWithOtp);

// Password Reset (unauthenticated)
router.post('/forgot-password', authController.forgotPassword);
router.get('/validate-reset-token', authController.validateResetToken);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
