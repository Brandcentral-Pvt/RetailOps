const crypto = require('crypto');
const { sql, getPool } = require('../database/db');

class PasswordResetService {
  constructor() {
    this.TOKEN_EXPIRY_HOURS = 1;
    this.TOKEN_LENGTH = 64;
  }

  async generateResetToken(email) {
    const pool = await getPool();
    
    const userResult = await pool.request()
      .input('email', sql.NVarChar, email.toLowerCase().trim())
      .query('SELECT Id, Email, FirstName, LastName FROM Users WHERE Email = @email AND IsActive = 1');
    
    if (userResult.recordset.length === 0) {
      return { success: false, message: 'If an account exists with this email, a reset link has been sent.' };
    }

    const user = userResult.recordset[0];
    const token = crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
    const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await pool.request()
      .input('userId', sql.VarChar, user.Id)
      .input('token', sql.NVarChar, token)
      .input('expiresAt', sql.DateTime, expiresAt)
      .query(`
        INSERT INTO PasswordResets (Id, UserId, Token, ExpiresAt, CreatedAt)
        VALUES (NEWID(), @userId, @token, @expiresAt, dbo.GetEnvDate())
      `);

    return {
      success: true,
      token,
      user: { id: user.Id, email: user.Email, firstName: user.FirstName },
      expiresAt
    };
  }

  async validateResetToken(token) {
    const pool = await getPool();
    
    const result = await pool.request()
      .input('token', sql.NVarChar, token)
      .query(`
        SELECT pr.UserId, pr.ExpiresAt, u.Email, u.FirstName
        FROM PasswordResets pr
        JOIN Users u ON pr.UserId = u.Id
        WHERE pr.Token = @token AND pr.UsedAt IS NULL
      `);

    if (result.recordset.length === 0) {
      return { valid: false, message: 'Invalid or already used reset link.' };
    }

    const reset = result.recordset[0];
    
    if (new Date(reset.ExpiresAt) < new Date()) {
      return { valid: false, message: 'Reset link has expired. Please request a new one.' };
    }

    return {
      valid: true,
      userId: reset.UserId,
      email: reset.Email,
      firstName: reset.FirstName
    };
  }

  async resetPassword(token, newPassword) {
    const pool = await getPool();
    
    const validation = await this.validateResetToken(token);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await pool.request()
      .input('userId', sql.VarChar, validation.userId)
      .input('password', sql.NVarChar, hashedPassword)
      .query(`
        UPDATE Users SET 
          Password = @password,
          ForcePasswordReset = 0,
          PasswordChangedAt = dbo.GetEnvDate(),
          PasswordExpiresAt = DATEADD(day, 90, dbo.GetEnvDate()),
          RefreshToken = NULL,
          UpdatedAt = dbo.GetEnvDate()
        WHERE Id = @userId
      `);

    await pool.request()
      .input('token', sql.NVarChar, token)
      .query('UPDATE PasswordResets SET UsedAt = dbo.GetEnvDate() WHERE Token = @token');

    const tokenBlacklist = require('./tokenBlacklistService');
    await tokenBlacklist.blacklistUser(validation.userId);

    return { success: true, message: 'Password reset successfully.' };
  }
}

module.exports = new PasswordResetService();
