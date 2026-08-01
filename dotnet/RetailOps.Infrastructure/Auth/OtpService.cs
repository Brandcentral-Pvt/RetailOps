using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RetailOps.Application.Common;
using RetailOps.Domain.Entities;
using RetailOps.Infrastructure.Common;
using RetailOps.Infrastructure.Data;

namespace RetailOps.Infrastructure.Auth;

public sealed partial class OtpService : IOtpService
{
    private const int OtpLength = 6;
    private static readonly TimeSpan OtpExpiry = TimeSpan.FromMinutes(5);
    private const int MaxAttempts = 3;
    private const int RateLimitSeconds = 60;
    private const int DailyLimit = 10;
    private const int BcryptCost = 10;

    private readonly RetailOpsDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IEmailService _emailService;
    private readonly ILogger<OtpService> _logger;

    [GeneratedRegex(@"^\d{6}$")]
    private static partial Regex OtpFormatRegex();

    public OtpService(
        RetailOpsDbContext db,
        IPasswordHasher passwordHasher,
        IEmailService emailService,
        ILogger<OtpService> logger)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<OtpSendResult> SendOtpAsync(string userId, string email, string purpose, OtpMetadata metadata, CancellationToken ct = default)
    {
        await CheckRateLimitAsync(userId, ct);
        await CheckDailyLimitAsync(userId, ct);
        await InvalidatePreviousOtpsAsync(userId, purpose, ct);

        var otp = GenerateOtp();
        var otpHash = _passwordHasher.Hash(otp, BcryptCost);
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new InvalidOperationException("User not found");

        var expiresAt = EnvTime.Now().Add(OtpExpiry);
        _db.OtpVerifications.Add(new OtpVerifications
        {
            UserId = userId,
            Email = email,
            OtpHash = otpHash,
            Purpose = purpose,
            IpAddress = metadata.IpAddress,
            UserAgent = metadata.UserAgent?[..Math.Min(metadata.UserAgent.Length, 500)],
            Attempts = 0,
            MaxAttempts = MaxAttempts,
            IsUsed = false,
            ExpiresAt = expiresAt,
            CreatedAt = EnvTime.Now()
        });
        await _db.SaveChangesAsync(ct);

        await UpdateOtpCounterAsync(userId, ct);
        await SendOtpEmailAsync(email, otp, user, purpose, metadata, ct);
        await AuditLogAsync(userId, email, "OTP_SENT", "SUCCESS", null, metadata, ct);

        return new OtpSendResult(true, (int)OtpExpiry.TotalSeconds, MaskEmail(email), MaxAttempts);
    }

    public async Task VerifyOtpAsync(string userId, string otp, string purpose, OtpMetadata metadata, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(otp) || !OtpFormatRegex().IsMatch(otp))
        {
            throw new InvalidOperationException("Invalid OTP format. Must be 6 digits.");
        }

        var otpRecord = await _db.OtpVerifications
            .Where(v => v.UserId == userId && v.Purpose == purpose && v.IsUsed == false && v.ExpiresAt > EnvTime.Now())
            .OrderByDescending(v => v.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (otpRecord is null)
        {
            await AuditLogAsync(userId, null, "OTP_VERIFY", "FAILED", "No valid OTP found or expired", metadata, ct);
            throw new InvalidOperationException("OTP expired or invalid. Please request a new one.");
        }

        if ((otpRecord.Attempts ?? 0) >= (otpRecord.MaxAttempts ?? MaxAttempts))
        {
            otpRecord.IsUsed = true;
            await _db.SaveChangesAsync(ct);
            await AuditLogAsync(userId, otpRecord.Email, "OTP_VERIFY", "FAILED", "Max attempts reached", metadata, ct);
            throw new InvalidOperationException("Too many incorrect attempts. Please request a new OTP.");
        }

        var isValid = _passwordHasher.Verify(otp, otpRecord.OtpHash);
        otpRecord.Attempts = (otpRecord.Attempts ?? 0) + 1;
        await _db.SaveChangesAsync(ct);

        if (!isValid)
        {
            var remaining = (otpRecord.MaxAttempts ?? MaxAttempts) - (otpRecord.Attempts ?? 0);
            await AuditLogAsync(userId, otpRecord.Email, "OTP_VERIFY", "FAILED", $"Invalid OTP, {remaining} attempts left", metadata, ct);
            throw new InvalidOperationException(
                remaining > 0
                    ? $"Invalid OTP. {remaining} attempt(s) remaining."
                    : "Invalid OTP. No more attempts. Please request a new OTP.");
        }

        otpRecord.IsUsed = true;
        otpRecord.UsedAt = EnvTime.Now();
        await _db.SaveChangesAsync(ct);
        await AuditLogAsync(userId, otpRecord.Email, "OTP_VERIFY", "SUCCESS", null, metadata, ct);
    }

    private static string GenerateOtp()
    {
        var min = (int)Math.Pow(10, OtpLength - 1);
        var max = (int)Math.Pow(10, OtpLength) - 1;
        return RandomNumberGenerator.GetInt32(min, max + 1).ToString();
    }

    private async Task CheckRateLimitAsync(string userId, CancellationToken ct)
    {
        var cutoff = EnvTime.Now().AddSeconds(-RateLimitSeconds);
        var last = await _db.OtpVerifications
            .Where(v => v.UserId == userId && v.CreatedAt > cutoff)
            .OrderByDescending(v => v.CreatedAt)
            .Select(v => v.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (last.HasValue)
        {
            var secondsSince = (int)(EnvTime.Now() - last.Value).TotalSeconds;
            var waitTime = RateLimitSeconds - secondsSince;
            if (waitTime > 0)
            {
                throw new InvalidOperationException($"Please wait {waitTime} seconds before requesting another OTP");
            }
        }
    }

    private async Task CheckDailyLimitAsync(string userId, CancellationToken ct)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return;

        var today = DateOnly.FromDateTime(EnvTime.Now());
        if (user.OtpResetDate != today)
        {
            user.OtpSentCountToday = 0;
            user.OtpResetDate = today;
            await _db.SaveChangesAsync(ct);
            return;
        }

        if ((user.OtpSentCountToday ?? 0) >= DailyLimit)
        {
            throw new InvalidOperationException($"Daily OTP limit of {DailyLimit} reached. Please try again tomorrow.");
        }
    }

    private async Task UpdateOtpCounterAsync(string userId, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return;
        user.LastOtpSentAt = EnvTime.Now();
        user.OtpSentCountToday = (user.OtpSentCountToday ?? 0) + 1;
        user.OtpResetDate ??= DateOnly.FromDateTime(EnvTime.Now());
        await _db.SaveChangesAsync(ct);
    }

    private async Task InvalidatePreviousOtpsAsync(string userId, string purpose, CancellationToken ct)
    {
        var open = await _db.OtpVerifications
            .Where(v => v.UserId == userId && v.Purpose == purpose && v.IsUsed == false)
            .ToListAsync(ct);
        foreach (var otp in open)
        {
            otp.IsUsed = true;
        }
        if (open.Count > 0) await _db.SaveChangesAsync(ct);
    }

    private async Task SendOtpEmailAsync(string email, string otp, Users user, string purpose, OtpMetadata metadata, CancellationToken ct)
    {
        var purposeText = purpose switch
        {
            "LOGIN" => "login to RetailOps",
            "PASSWORD_RESET" => "reset your password",
            _ => "continue"
        };

        var source = metadata.Source ?? "web";
        var isMobile = source == "mobile";

        string subject = isMobile
            ? $"[RetailOps App] Your Login Code: {otp[..3]}-{otp[3..]}"
            : $"[RetailOps] Your Verification Code: {otp[..3]}-{otp[3..]}";

        string html = isMobile
            ? BuildMobileOtpTemplate(otp, user.FirstName ?? "there", purposeText, metadata)
            : BuildWebOtpTemplate(user.FirstName ?? "there", otp, metadata.IpAddress ?? "Unknown");

        try
        {
            await _emailService.SendAsync(new EmailMessage(email, subject, html), ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Email delivery failed; OTP for {Email}: {Otp}", email, otp);
        }
    }

    private string BuildWebOtpTemplate(string userName, string code, string ipAddress) => $"""
        <!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
        <div style="max-width:440px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.1);border:1px solid #e2e8f0">
          <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:28px 24px;text-align:center">
            <h1 style="color:#fff;font-size:18px;font-weight:700;margin:0">RetailOps Verification</h1>
            <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:6px 0 0">Login security code</p>
          </div>
          <div style="padding:28px 24px">
            <p style="font-size:14px;color:#1e293b;margin:0 0 4px">Hi <strong>{userName}</strong>,</p>
            <p style="font-size:13px;color:#64748b;margin:0 0 20px">Use this code to complete your login:</p>
            <div style="background:#f8fafc;border:2px dashed #667eea50;border-radius:12px;padding:20px;text-align:center;margin:0 0 20px">
              <div style="font-size:38px;font-weight:800;letter-spacing:10px;color:#1e293b;font-family:Consolas,monospace">{code}</div>
            </div>
            <div style="text-align:center;margin:0 0 20px">
              <span style="display:inline-block;background:#fef3c7;border-radius:8px;padding:8px 16px;font-size:12px;color:#92400e;font-weight:600">Expires in 5 minutes</span>
            </div>
            <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;margin:0 0 16px">
              <p style="font-size:11px;color:#64748b;margin:0 0 6px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Request Info</p>
              <p style="font-size:12px;color:#475569;margin:0">IP: {ipAddress}</p>
            </div>
            <div style="background:#fef2f2;border-left:3px solid #ef4444;padding:10px 14px;border-radius:0 8px 8px 0">
              <p style="font-size:11px;color:#991b1b;margin:0;font-weight:500">Didn't request this? Ignore this email or contact support immediately.</p>
            </div>
          </div>
        </div></body></html>
        """;

    private string BuildMobileOtpTemplate(string otp, string userName, string purposeText, OtpMetadata metadata) => $"""
        <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
          <div style="max-width:420px;margin:40px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15)">
            <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px 24px;text-align:center">
              <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:16px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center">
                <span style="font-size:28px">&#128274;</span>
              </div>
              <h1 style="color:#fff;font-size:18px;font-weight:700;margin:0 0 4px">Mobile Login Code</h1>
              <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:0">RetailOps Mobile App</p>
            </div>
            <div style="padding:28px 24px">
              <p style="font-size:14px;color:#1e293b;margin:0 0 4px">Hi <strong>{userName}</strong>,</p>
              <p style="font-size:13px;color:#64748b;margin:0 0 20px">You requested to {purposeText} from your mobile app. Enter this code:</p>
              <div style="background:linear-gradient(135deg,#667eea10,#764ba210);border:2px solid #667eea30;border-radius:14px;padding:24px;text-align:center;margin:0 0 20px">
                <div style="font-size:40px;font-weight:800;letter-spacing:12px;color:#1e293b;font-family:Consolas,monospace;line-height:1">{otp}</div>
              </div>
              <div style="text-align:center;margin:0 0 20px">
                <div style="display:inline-block;background:#fef3c7;border-radius:8px;padding:8px 16px">
                  <span style="font-size:12px;color:#92400e;font-weight:600">Expires in 5 minutes</span>
                </div>
              </div>
              <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;margin:0 0 16px">
                <p style="font-size:11px;color:#64748b;margin:0 0 6px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">App Info</p>
                <p style="font-size:12px;color:#475569;margin:0">Platform: Mobile App &bull; IP: {metadata.IpAddress ?? "Unknown"}</p>
              </div>
              <div style="background:#fef2f2;border-left:3px solid #ef4444;padding:10px 14px;border-radius:0 8px 8px 0">
                <p style="font-size:11px;color:#991b1b;margin:0;font-weight:500">Didn't request this? Ignore this email or contact support immediately.</p>
              </div>
            </div>
            <div style="border-top:1px solid #f1f5f9;padding:14px 24px;text-align:center">
              <p style="font-size:10px;color:#94a3b8;margin:0">{EnvTime.Now():dd-MM-yyyy HH:mm} &bull; RetailOps Security</p>
            </div>
          </div></body></html>
        """;

    private static string MaskEmail(string email)
    {
        if (string.IsNullOrEmpty(email) || !email.Contains('@')) return "***@***";
        var parts = email.Split('@');
        var local = parts[0];
        var domain = parts[1];
        var maskedLocal = local.Length > 2
            ? $"{local[0]}{new string('*', Math.Min(local.Length - 2, 4))}{local[^1]}"
            : $"{local[0]}*";
        return $"{maskedLocal}@{domain}";
    }

    private async Task AuditLogAsync(string? userId, string? email, string action, string status, string? reason, OtpMetadata metadata, CancellationToken ct)
    {
        try
        {
            _db.OtpAuditLog.Add(new OtpAuditLog
            {
                UserId = userId ?? "system",
                Email = email ?? "unknown",
                Action = action,
                Status = status,
                Reason = reason,
                IpAddress = metadata.IpAddress,
                UserAgent = metadata.UserAgent?[..Math.Min(metadata.UserAgent.Length, 500)],
                CreatedAt = EnvTime.Now()
            });
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OTP audit log failed");
        }
    }
}
