const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../database/db');

class TokenBlacklistService {
  constructor() {
    this.memoryBlacklist = new Map();
    this.userBlacklist = new Map();

    // Cleanup expired entries every 5 minutes
    this._cleanupTimer = setInterval(() => this._cleanupMemory(), 5 * 60 * 1000);
    if (this._cleanupTimer.unref) this._cleanupTimer.unref();
  }

  async blacklist(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded?.exp) return false;
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl <= 0) return false;

      this.memoryBlacklist.set(token, Date.now() + ttl * 1000);
      return true;
    } catch (error) {
      console.error('Blacklist error:', error.message);
      return false;
    }
  }

  async isBlacklisted(token) {
    try {
      const expiry = this.memoryBlacklist.get(token);
      if (!expiry) return false;
      if (Date.now() > expiry) { this.memoryBlacklist.delete(token); return false; }
      return true;
    } catch (error) {
      return false;
    }
  }

  async blacklistUser(userId) {
    const now = Date.now().toString();
    try {
      this.userBlacklist.set(userId, now);
      setTimeout(() => this.userBlacklist.delete(userId), 24 * 60 * 60 * 1000);

      const pool = await getPool();
      await pool.request()
        .input('userId', sql.VarChar, userId)
        .query('UPDATE Users SET RefreshToken = NULL WHERE Id = @userId');
      return true;
    } catch (error) {
      console.error('Blacklist user error:', error.message);
      return false;
    }
  }

  async isUserBlacklisted(userId, tokenIssuedAt) {
    try {
      const blacklistedAt = this.userBlacklist.get(userId);
      if (!blacklistedAt) return false;
      return (tokenIssuedAt || 0) * 1000 < parseInt(blacklistedAt);
    } catch (error) {
      return false;
    }
  }

  _cleanupMemory() {
    const now = Date.now();
    let cleaned = 0;
    for (const [token, expiry] of this.memoryBlacklist.entries()) {
      if (now > expiry) { this.memoryBlacklist.delete(token); cleaned++; }
    }
    if (cleaned > 0) console.log(`🧹 Cleaned ${cleaned} expired blacklist entries`);
  }
}

module.exports = new TokenBlacklistService();