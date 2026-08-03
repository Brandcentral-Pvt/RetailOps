using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RetailOps.Application.Auth;
using RetailOps.Application.Common;
using RetailOps.Domain.Entities;
using RetailOps.Infrastructure.Common;
using RetailOps.Infrastructure.Configuration;
using RetailOps.Infrastructure.Data;
using RetailOps.Infrastructure.Security;

namespace RetailOps.Infrastructure.Auth;

public sealed class AuthService : IAuthService
{
    private readonly RetailOpsDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokenService;
    private readonly ITokenBlacklistService _tokenBlacklist;
    private readonly ILoginRateLimiter _rateLimiter;
    private readonly IOtpService _otpService;
    private readonly ITrustedDeviceService _trustedDeviceService;
    private readonly IPasswordResetService _passwordResetService;
    private readonly IEmailService _emailService;
    private readonly ISystemLogService _systemLog;
    private readonly IOptions<RetailOpsSettings> _settings;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        RetailOpsDbContext db,
        IPasswordHasher passwordHasher,
        ITokenService tokenService,
        ITokenBlacklistService tokenBlacklist,
        ILoginRateLimiter rateLimiter,
        IOtpService otpService,
        ITrustedDeviceService trustedDeviceService,
        IPasswordResetService passwordResetService,
        IEmailService emailService,
        ISystemLogService systemLog,
        IOptions<RetailOpsSettings> settings,
        ILogger<AuthService> logger)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
        _tokenBlacklist = tokenBlacklist;
        _rateLimiter = rateLimiter;
        _otpService = otpService;
        _trustedDeviceService = trustedDeviceService;
        _passwordResetService = passwordResetService;
        _emailService = emailService;
        _systemLog = systemLog;
        _settings = settings;
        _logger = logger;
    }

    public async Task<AuthResult> LoginAsync(LoginRequest request, RequestContext ctx, CancellationToken ct = default)
    {
        var email = request.Email ?? string.Empty;
        var clientIp = ctx.ClientIp;

        if (await _rateLimiter.IsIpBlockedAsync(clientIp, ct))
        {
            return AuthResult.Fail(AuthErrors.GenericBlock, 429);
        }

        var lockCheck = await _rateLimiter.CheckEmailAsync(email, clientIp, ct);
        if (lockCheck.IsLocked)
        {
            return AuthResult.Fail(AuthErrors.GenericBlock, 423);
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

        if (user is null)
        {
            _logger.LogWarning("[AUTH_FAILURE] Account not found. Email: {Email} | IP: {Ip}", email, clientIp);
            await _systemLog.LogAsync(new SystemLogEntry(
                "AUTH_FAILURE", "USER", null, email, null,
                $"Failed login attempt: User not found ({email})",
                new { ip = clientIp, email }), ct);
            await _rateLimiter.RecordFailedAttemptAsync(email, clientIp, ct);
            return AuthResult.Fail(AuthErrors.GenericBlock, 401);
        }

        if (user.LockUntil is not null && user.LockUntil > EnvTime.Now())
        {
            await _systemLog.LogAsync(new SystemLogEntry(
                "AUTH_FAILURE", "USER", user.Id, email, user.Id,
                $"Locked login attempt: {email}",
                new { ip = clientIp }), ct);
            return AuthResult.Fail(AuthErrors.GenericBlock, 423);
        }

        if (user.IsActive != true)
        {
            await _systemLog.LogAsync(new SystemLogEntry(
                "AUTH_FAILURE", "USER", user.Id, email, user.Id,
                $"Deactivated account login attempt: {email}",
                new { ip = clientIp }), ct);
            return AuthResult.Fail(AuthErrors.GenericBlock, 403);
        }

        var isMatch = _passwordHasher.Verify(request.Password ?? string.Empty, user.Password);
        if (!isMatch)
        {
            var attempts = (user.LoginAttempts ?? 0) + 1;
            DateTime? lockUntil = null;
            if (attempts >= 5) lockUntil = EnvTime.Now().AddMinutes(15);

            user.LoginAttempts = attempts;
            user.LockUntil = lockUntil;
            await _db.SaveChangesAsync(ct);

            _logger.LogWarning("[AUTH_FAILURE] Password mismatch. Email: {Email} | IP: {Ip} | Attempt: {Attempt}", email, clientIp, attempts);
            await _systemLog.LogAsync(new SystemLogEntry(
                "AUTH_FAILURE", "USER", user.Id, email, user.Id,
                $"Password mismatch. Attempt: {attempts}",
                new { ip = clientIp, attempts }), ct);

            await _rateLimiter.RecordFailedAttemptAsync(email, clientIp, ct);
            return AuthResult.Fail(AuthErrors.GenericBlock, 401);
        }

        await _rateLimiter.RecordSuccessfulLoginAsync(email, ct);
        user.LoginAttempts = 0;
        user.LockUntil = null;
        user.LastSeen = EnvTime.Now();
        await _db.SaveChangesAsync(ct);

        var needsPasswordReset = user.ForcePasswordReset == true ||
            (user.PasswordExpiresAt is not null && user.PasswordExpiresAt < EnvTime.Now());

        var fingerprint = DeviceFingerprint.From(ctx.UserAgent, clientIp);
        var isTrustedDevice = await _trustedDeviceService.IsTrustedAsync(user.Id, fingerprint, ct);

        if (isTrustedDevice)
        {
            var tokens = _tokenService.GenerateTokens(user.Id, fingerprint);
            user.RefreshToken = tokens.RefreshToken;
            await _db.SaveChangesAsync(ct);

            var resolvedUser = await BuildResolvedUserAsync(user, ct);
            await _systemLog.LogAsync(new SystemLogEntry(
                "AUTH_SUCCESS", "USER", user.Id, $"{user.FirstName} {user.LastName}".Trim(), user.Id,
                $"{user.FirstName} logged in (trusted device)",
                new { ip = clientIp }), ct);

            return AuthResult.Ok(new
            {
                success = true,
                data = new { user = resolvedUser, accessToken = tokens.AccessToken, refreshToken = tokens.RefreshToken },
                trustedDevice = true,
                requiresSetup = user.IsFirstLogin == true && user.SetupCompletedAt is null,
                needsPasswordReset
            });
        }

        var tempToken = _tokenService.GenerateTempToken(user.Id, user.Email, "OTP_VERIFICATION", "PASSWORD_VERIFIED");

        try
        {
            var otpResult = await _otpService.SendOtpAsync(user.Id, user.Email, "LOGIN",
                new OtpMetadata(clientIp, ctx.UserAgent, null), ct);
            return AuthResult.Ok(new
            {
                success = true,
                requiresOtp = true,
                tempToken,
                destination = otpResult.Destination,
                expiresIn = otpResult.ExpiresIn,
                message = $"Verification code sent to {otpResult.Destination}"
            });
        }
        catch (InvalidOperationException otpError)
        {
            return AuthResult.Fail(otpError.Message, 429);
        }
    }

    public async Task<AuthResult> RequestOtpAsync(RequestOtpRequest request, RequestContext ctx, CancellationToken ct = default)
    {
        var email = request.Email ?? string.Empty;
        if (string.IsNullOrWhiteSpace(email))
        {
            return AuthResult.Fail("Email is required", 400);
        }

        var normalized = email.ToLowerInvariant().Trim();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == normalized, ct);

        if (user is null)
        {
            return AuthResult.Fail("No account found with this email", 404);
        }

        if (user.IsActive != true)
        {
            return AuthResult.Fail("Account is deactivated", 403);
        }

        var hasActiveSeller = await _db.Users
            .Where(u => u.Id == user.Id)
            .SelectMany(u => u.Seller)
            .AnyAsync(s => s.IsActive == true, ct);

        if (!hasActiveSeller)
        {
            return AuthResult.Fail("No seller account associated with this email. Please contact your administrator.", 403);
        }

        var tempToken = _tokenService.GenerateTempToken(user.Id, user.Email, "OTP_VERIFICATION", "PASSWORD_VERIFIED");

        try
        {
            var otpResult = await _otpService.SendOtpAsync(user.Id, user.Email, "LOGIN",
                new OtpMetadata(ctx.ClientIp, ctx.UserAgent, ctx.Platform ?? "web"), ct);
            return AuthResult.Ok(new
            {
                success = true,
                requiresOtp = true,
                tempToken,
                destination = otpResult.Destination,
                expiresIn = otpResult.ExpiresIn,
                message = $"Verification code sent to {otpResult.Destination}"
            });
        }
        catch (InvalidOperationException otpError)
        {
            return AuthResult.Fail(otpError.Message, 429);
        }
    }

    public async Task<AuthResult> VerifyOtpAsync(VerifyOtpRequest request, RequestContext ctx, CancellationToken ct = default)
    {
        var clientIp = ctx.ClientIp;
        var userAgent = ctx.UserAgent;

        if (string.IsNullOrEmpty(request.TempToken) || string.IsNullOrEmpty(request.Otp))
        {
            return AuthResult.Fail("Token and OTP are required", 400);
        }

        var decoded = _tokenService.ValidateTempToken(request.TempToken);
        if (decoded is null)
        {
            return AuthResult.Fail("Session expired. Please login again.", 401, new { code = "SESSION_EXPIRED" });
        }

        var purpose = TokenService.GetClaim(decoded, TokenService.PurposeClaim);
        var step = TokenService.GetClaim(decoded, TokenService.StepClaim);
        var userId = TokenService.GetUserId(decoded);
        if (purpose != "OTP_VERIFICATION" || step != "PASSWORD_VERIFIED" || userId is null)
        {
            return AuthResult.Fail("Invalid session token", 401);
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsActive == true, ct);
        if (user is null)
        {
            return AuthResult.Fail("User not found", 401);
        }

        try
        {
            await _otpService.VerifyOtpAsync(user.Id, request.Otp, "LOGIN",
                new OtpMetadata(clientIp, userAgent, null), ct);
        }
        catch (InvalidOperationException ex)
        {
            if (ex.Message.Contains("OTP"))
            {
                return AuthResult.Fail(ex.Message, 401);
            }
            return AuthResult.Fail("OTP verification failed", 500);
        }

        var fingerprint = DeviceFingerprint.From(userAgent, clientIp);
        if (request.TrustDevice == true)
        {
            await _trustedDeviceService.TrustAsync(user.Id, fingerprint, new DeviceMetadata(clientIp, userAgent), ct);
        }

        var tokens = _tokenService.GenerateTokens(user.Id, fingerprint);
        user.RefreshToken = tokens.RefreshToken;
        await _db.SaveChangesAsync(ct);

        var resolvedUser = await BuildResolvedUserAsync(user, ct);
        await _systemLog.LogAsync(new SystemLogEntry(
            "AUTH_SUCCESS", "USER", user.Id, $"{user.FirstName} {user.LastName}".Trim(), user.Id,
            $"{user.FirstName} logged in (OTP verified)",
            new { ip = clientIp }), ct);

        var needsPasswordReset = user.ForcePasswordReset == true ||
            (user.PasswordExpiresAt is not null && user.PasswordExpiresAt < EnvTime.Now());

        return AuthResult.Ok(new
        {
            success = true,
            data = new { user = resolvedUser, accessToken = tokens.AccessToken, refreshToken = tokens.RefreshToken },
            requiresSetup = user.IsFirstLogin == true && user.SetupCompletedAt is null,
            needsPasswordReset
        });
    }

    public async Task<AuthResult> ResendOtpAsync(ResendOtpRequest request, RequestContext ctx, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(request.TempToken))
        {
            return AuthResult.Fail("Token required", 400);
        }

        var decoded = _tokenService.ValidateTempToken(request.TempToken);
        if (decoded is null)
        {
            return AuthResult.Fail("Session expired", 401);
        }

        var userId = TokenService.GetUserId(decoded);
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsActive == true, ct);
        if (user is null)
        {
            return AuthResult.Fail("User not found", 401);
        }

        try
        {
            var otpResult = await _otpService.SendOtpAsync(user.Id, user.Email, "LOGIN",
                new OtpMetadata(ctx.ClientIp, ctx.UserAgent, null), ct);
            return AuthResult.Ok(new
            {
                success = true,
                destination = otpResult.Destination,
                expiresIn = otpResult.ExpiresIn,
                message = $"New code sent to {otpResult.Destination}"
            });
        }
        catch (InvalidOperationException ex)
        {
            return AuthResult.Fail(ex.Message, 429);
        }
    }

    public async Task<AuthResult> RefreshTokenAsync(RefreshTokenRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(request.RefreshToken))
        {
            return AuthResult.Fail("Token required", 400);
        }

        var decoded = _tokenService.ValidateRefreshToken(request.RefreshToken);
        if (decoded is null)
        {
            return AuthResult.Fail("Invalid token", 401);
        }

        var userId = TokenService.GetUserId(decoded);
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);

        if (user is null || user.RefreshToken != request.RefreshToken)
        {
            return AuthResult.Fail("Invalid token", 401);
        }
        if (user.IsActive != true)
        {
            return AuthResult.Fail("Deactivated", 403);
        }

        var tokens = _tokenService.GenerateTokens(user.Id, null);
        user.RefreshToken = tokens.RefreshToken;
        await _db.SaveChangesAsync(ct);

        return AuthResult.Ok(new { success = true, data = new { accessToken = tokens.AccessToken, refreshToken = tokens.RefreshToken } });
    }

    public async Task<AuthResult> LogoutAsync(string userId, string? accessToken, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is not null)
        {
            user.RefreshToken = null;
            await _db.SaveChangesAsync(ct);
        }

        if (!string.IsNullOrEmpty(accessToken))
        {
            await _tokenBlacklist.BlacklistAsync(accessToken, ct);
        }

        if (!string.IsNullOrEmpty(userId))
        {
            await _systemLog.LogAsync(new SystemLogEntry(
                "AUTH_LOGOUT", "USER", userId, "User Session", userId,
                "User logged out", null), ct);
        }

        return AuthResult.Ok(new { success = true });
    }

    public async Task<AuthResult> GetMeAsync(string userId, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            return new AuthResult { StatusCode = 404, Success = false, Payload = new { success = false } };
        }

        List<object> sellers = new();
        var assignedSellers = new List<string>();
        try
        {
            var sellerRows = await _db.Users
                .Where(u => u.Id == userId)
                .SelectMany(u => u.Seller)
                .Where(s => s.IsActive == true)
                .Select(s => new { s.Id, s.Name, s.Marketplace, s.SellerId, s.IsActive, s.Plan, s.PartnerTag, s.CreatedAt })
                .ToListAsync(ct);
            sellers = sellerRows.Cast<object>().ToList();
            assignedSellers = sellerRows.Select(s => s.Id).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AUTH] Failed to fetch sellers for user {UserId}", userId);
        }

        var resolvedUser = await BuildResolvedUserAsync(user, ct);
        resolvedUser["sellers"] = sellers;
        resolvedUser["assignedSellers"] = assignedSellers;

        return AuthResult.Ok(new { success = true, data = resolvedUser });
    }

    public async Task<AuthResult> UpdateProfileAsync(string userId, UpdateProfileRequest request, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            return new AuthResult { StatusCode = 500, Success = false, Payload = new { success = false } };
        }

        user.FirstName = request.FirstName;
        user.LastName = request.LastName;
        user.Phone = request.Phone;
        user.Preferences = request.Preferences is null ? null : JsonSerializer.Serialize(request.Preferences);
        user.UpdatedAt = EnvTime.Now();
        await _db.SaveChangesAsync(ct);

        var fresh = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        return AuthResult.Ok(new { success = true, data = BuildUserMap(fresh ?? user) });
    }

    public async Task<AuthResult> RequestPasswordChangeAsync(string userId, RequestPasswordChangeRequest request, RequestContext ctx, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsActive == true, ct);
        if (user is null)
        {
            return AuthResult.Fail("User not found", 404);
        }

        if (!_passwordHasher.Verify(request.CurrentPassword ?? string.Empty, user.Password))
        {
            return AuthResult.Fail("Current password is incorrect", 400);
        }

        var otpResult = await _otpService.SendOtpAsync(user.Id, user.Email, "PASSWORD_CHANGE",
            new OtpMetadata(ctx.ClientIp, ctx.UserAgent, "profile"), ct);

        var tempToken = _tokenService.GenerateTempToken(user.Id, user.Email, "PASSWORD_CHANGE", "PASSWORD_VERIFIED");

        return AuthResult.Ok(new
        {
            success = true,
            tempToken,
            destination = otpResult.Destination,
            expiresIn = otpResult.ExpiresIn,
            message = $"Verification code sent to {otpResult.Destination}"
        });
    }

    public async Task<AuthResult> ChangePasswordAsync(string userId, ChangePasswordRequest request, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            return AuthResult.Fail("Failed to change password", 500);
        }

        if (!_passwordHasher.Verify(request.CurrentPassword ?? string.Empty, user.Password))
        {
            return AuthResult.Fail("Current password incorrect", 400);
        }

        var reuse = await IsPasswordReusedAsync(userId, request.NewPassword ?? string.Empty, ct);
        if (reuse)
        {
            return AuthResult.Fail("Cannot reuse last 5 passwords", 400);
        }

        var hashed = _passwordHasher.Hash(request.NewPassword ?? string.Empty, 12);
        await InsertPasswordHistoryAsync(userId, user.Password, ct);
        ApplyPasswordChange(user, hashed);
        await _db.SaveChangesAsync(ct);

        await _tokenBlacklist.BlacklistUserAsync(userId, ct);

        return AuthResult.Ok(new { success = true, message = "Password changed. Please login again." });
    }

    public async Task<AuthResult> ChangePasswordWithOtpAsync(ChangePasswordWithOtpRequest request, RequestContext ctx, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(request.TempToken) || string.IsNullOrEmpty(request.Otp) || string.IsNullOrEmpty(request.NewPassword))
        {
            return AuthResult.Fail("Token, OTP, and new password are required", 400);
        }

        var decoded = _tokenService.ValidateTempToken(request.TempToken);
        if (decoded is null)
        {
            return AuthResult.Fail("Session expired. Please start again.", 401);
        }

        var purpose = TokenService.GetClaim(decoded, TokenService.PurposeClaim);
        var step = TokenService.GetClaim(decoded, TokenService.StepClaim);
        var userId = TokenService.GetUserId(decoded);
        if (purpose != "PASSWORD_CHANGE" || step != "PASSWORD_VERIFIED" || userId is null)
        {
            return AuthResult.Fail("Invalid session token", 401);
        }

        try
        {
            await _otpService.VerifyOtpAsync(userId, request.Otp, "PASSWORD_CHANGE",
                new OtpMetadata(ctx.ClientIp, ctx.UserAgent, null), ct);
        }
        catch (InvalidOperationException ex)
        {
            if (ex.Message.Contains("OTP"))
            {
                return AuthResult.Fail(ex.Message, 401);
            }
            return AuthResult.Fail("Failed to change password", 500);
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsActive == true, ct);
        if (user is null)
        {
            return AuthResult.Fail("User not found", 404);
        }

        var reuse = await IsPasswordReusedAsync(userId, request.NewPassword, ct);
        if (reuse)
        {
            return AuthResult.Fail("Cannot reuse last 5 passwords", 400);
        }

        var hashed = _passwordHasher.Hash(request.NewPassword ?? string.Empty, 12);
        await InsertPasswordHistoryAsync(userId, user.Password, ct);
        ApplyPasswordChange(user, hashed);
        await _db.SaveChangesAsync(ct);

        await _tokenBlacklist.BlacklistUserAsync(userId, ct);

        return AuthResult.Ok(new { success = true, message = "Password changed successfully. Please login again." });
    }

    public async Task<AuthResult> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct = default)
    {
        var email = request.Email ?? string.Empty;
        if (string.IsNullOrWhiteSpace(email))
        {
            return AuthResult.Fail("Email is required", 400);
        }

        var result = await _passwordResetService.GenerateResetTokenAsync(email, ct);

        if (result.Success)
        {
            var resetUrl = $"{_settings.Value.DashboardUrl.TrimEnd('/')}/reset-password?token={result.Token}";
            var ipAddress = "Unknown";

            var html = BuildPasswordResetHtml(result.FirstName ?? "there", resetUrl, 60, ipAddress);
            try
            {
                await _emailService.SendAsync(new EmailMessage(result.Email!, "Reset Your RetailOps Password", html), ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AUTH] Failed to send password reset email to {Email}", result.Email);
            }
        }

        return AuthResult.Ok(new { success = true, message = "If an account exists with this email, a reset link has been sent." });
    }

    public async Task<AuthResult> ValidateResetTokenAsync(string token, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return AuthResult.Fail("Token is required", 400);
        }

        var result = await _passwordResetService.ValidateResetTokenAsync(token, ct);
        if (!result.Valid)
        {
            return AuthResult.Fail(result.Message, 400, new { valid = false });
        }

        return AuthResult.Ok(new { success = true, valid = true, email = result.Email, firstName = result.FirstName });
    }

    public async Task<AuthResult> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(request.Token) || string.IsNullOrEmpty(request.NewPassword))
        {
            return AuthResult.Fail("Token and new password are required", 400);
        }

        if (request.NewPassword.Length < 8)
        {
            return AuthResult.Fail("Password must be at least 8 characters", 400);
        }

        var result = await _passwordResetService.ResetPasswordAsync(request.Token, request.NewPassword, ct);
        if (!result.Success)
        {
            return AuthResult.Fail(result.Message, 400);
        }

        return AuthResult.Ok(new { success = true, message = "Password reset successfully. You can now login with your new password." });
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private async Task<Dictionary<string, object?>> BuildResolvedUserAsync(Users user, CancellationToken ct)
    {
        var map = BuildUserMap(user);

        string roleName = "viewer";
        string roleDisplay = "Viewer";
        var permissions = new List<string>();

        if (!string.IsNullOrEmpty(user.RoleId))
        {
            var role = await _db.Roles
                .Where(r => r.Id == user.RoleId)
                .Select(r => new { r.Name, r.DisplayName })
                .FirstOrDefaultAsync(ct);
            if (role is not null)
            {
                roleName = role.Name;
                roleDisplay = role.DisplayName ?? role.Name;
            }

            permissions = await _db.Permissions
                .Where(p => p.Role.Any(r => r.Id == user.RoleId))
                .Select(p => p.Name)
                .ToListAsync(ct);
        }

        map["_id"] = user.Id;
        map["id"] = user.Id;
        map["role"] = new { Name = roleName, DisplayName = roleDisplay };
        map["permissions"] = permissions;
        return map;
    }

    private static Dictionary<string, object?> BuildUserMap(Users user) => new()
    {
        ["Id"] = user.Id,
        ["Email"] = user.Email,
        ["FirstName"] = user.FirstName,
        ["LastName"] = user.LastName,
        ["Phone"] = user.Phone,
        ["Avatar"] = user.Avatar,
        ["RoleId"] = user.RoleId,
        ["IsEmailVerified"] = user.IsEmailVerified,
        ["IsActive"] = user.IsActive,
        ["IsOnline"] = user.IsOnline,
        ["LastSeen"] = user.LastSeen,
        ["Preferences"] = user.Preferences,
        ["LoginAttempts"] = user.LoginAttempts,
        ["LockUntil"] = user.LockUntil,
        ["CreatedAt"] = user.CreatedAt,
        ["UpdatedAt"] = user.UpdatedAt,
        ["CurrentTeam"] = user.CurrentTeam,
        ["CometChatUid"] = user.CometChatUid,
        ["ExtraPermissions"] = user.ExtraPermissions,
        ["ExcludedPermissions"] = user.ExcludedPermissions,
        ["PasswordChangedAt"] = user.PasswordChangedAt,
        ["PasswordExpiresAt"] = user.PasswordExpiresAt,
        ["LastOtpSentAt"] = user.LastOtpSentAt,
        ["OtpSentCountToday"] = user.OtpSentCountToday,
        ["OtpResetDate"] = user.OtpResetDate,
        ["IsFirstLogin"] = user.IsFirstLogin,
        ["FirstLoginAt"] = user.FirstLoginAt,
        ["SetupCompletedAt"] = user.SetupCompletedAt,
        ["SecurityPolicyAccepted"] = user.SecurityPolicyAccepted,
        ["ForcePasswordReset"] = user.ForcePasswordReset
    };

    private async Task<bool> IsPasswordReusedAsync(string userId, string newPassword, CancellationToken ct)
    {
        var history = await _db.PasswordHistory
            .Where(h => h.UserId == userId)
            .OrderByDescending(h => h.ChangedAt)
            .Take(5)
            .Select(h => h.PasswordHash)
            .ToListAsync(ct);

        foreach (var hash in history)
        {
            if (_passwordHasher.Verify(newPassword, hash))
            {
                return true;
            }
        }
        return false;
    }

    private async Task InsertPasswordHistoryAsync(string userId, string oldPasswordHash, CancellationToken ct)
    {
        _db.PasswordHistory.Add(new PasswordHistory
        {
            Id = IdGenerator.New(),
            UserId = userId,
            PasswordHash = oldPasswordHash,
            ChangedAt = EnvTime.Now()
        });
        await _db.SaveChangesAsync(ct);
    }

    private static void ApplyPasswordChange(Users user, string hashed)
    {
        user.Password = hashed;
        user.ForcePasswordReset = false;
        user.PasswordChangedAt = EnvTime.Now();
        user.PasswordExpiresAt = EnvTime.Now().AddDays(90);
        user.RefreshToken = null;
        user.UpdatedAt = EnvTime.Now();
    }

    private static string BuildPasswordResetHtml(string userName, string resetUrl, int expiresInMinutes, string ipAddress) => $"""
        <!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
        <div style="max-width:440px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.1);border:1px solid #e2e8f0">
          <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:28px 24px;text-align:center">
            <h1 style="color:#fff;font-size:18px;font-weight:700;margin:0">Reset Your Password</h1>
            <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:6px 0 0">RetailOps Security</p>
          </div>
          <div style="padding:28px 24px">
            <p style="font-size:14px;color:#1e293b;margin:0 0 4px">Hi <strong>{userName}</strong>,</p>
            <p style="font-size:13px;color:#64748b;margin:0 0 20px">We received a request to reset your RetailOps password. Click the button below to set a new one. This link expires in <strong>{expiresInMinutes} minutes</strong>.</p>
            <div style="text-align:center;margin:0 0 20px">
              <a href="{resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600">Reset Password</a>
            </div>
            <p style="font-size:11px;color:#94a3b8;margin:0 0 16px;word-break:break-all">If the button doesn't work, copy this link: <span style="color:#667eea">{resetUrl}</span></p>
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
}
