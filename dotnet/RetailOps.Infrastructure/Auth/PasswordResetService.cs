using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RetailOps.Application.Common;
using RetailOps.Infrastructure.Common;
using RetailOps.Infrastructure.Data;

namespace RetailOps.Infrastructure.Auth;

public sealed class PasswordResetService : IPasswordResetService
{
    private const int TokenExpiryHours = 1;
    private const int TokenLength = 64;
    private const int BcryptCost = 12;

    private readonly RetailOpsDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ILogger<PasswordResetService> _logger;

    public PasswordResetService(
        RetailOpsDbContext db,
        IPasswordHasher passwordHasher,
        ILogger<PasswordResetService> logger)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _logger = logger;
    }

    public async Task<GenerateResetResult> GenerateResetTokenAsync(string email, CancellationToken ct = default)
    {
        var normalized = email.ToLowerInvariant().Trim();
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Email == normalized && u.IsActive == true, ct);

        if (user is null)
        {
            return new GenerateResetResult(false, null, null, null, null,
                "If an account exists with this email, a reset link has been sent.");
        }

        var token = SecurityTokenGenerator.CreateHexToken(TokenLength);
        var expiresAt = EnvTime.Now().AddHours(TokenExpiryHours);

        _db.PasswordResets.Add(new Domain.Entities.PasswordResets
        {
            Id = IdGenerator.New(),
            UserId = user.Id,
            Token = token,
            ExpiresAt = expiresAt,
            CreatedAt = EnvTime.Now()
        });
        await _db.SaveChangesAsync(ct);

        return new GenerateResetResult(true, token, user.Id, user.Email, user.FirstName, null);
    }

    public async Task<ValidateResetResult> ValidateResetTokenAsync(string token, CancellationToken ct = default)
    {
        var reset = await (from pr in _db.PasswordResets
                           join u in _db.Users on pr.UserId equals u.Id
                           where pr.Token == token && pr.UsedAt == null
                           select new { pr.ExpiresAt, pr.UserId, u.Email, u.FirstName })
            .FirstOrDefaultAsync(ct);

        if (reset is null)
        {
            return new ValidateResetResult(false, null, null, null, "Invalid or already used reset link.");
        }

        if (reset.ExpiresAt < EnvTime.Now())
        {
            return new ValidateResetResult(false, null, null, null, "Reset link has expired. Please request a new one.");
        }

        return new ValidateResetResult(true, reset.UserId, reset.Email, reset.FirstName, "Valid");
    }

    public async Task<ResetPasswordResult> ResetPasswordAsync(string token, string newPassword, CancellationToken ct = default)
    {
        var validation = await ValidateResetTokenAsync(token, ct);
        if (!validation.Valid)
        {
            return new ResetPasswordResult(false, validation.Message);
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == validation.UserId, ct);
        if (user is null)
        {
            return new ResetPasswordResult(false, "Invalid or already used reset link.");
        }

        user.Password = _passwordHasher.Hash(newPassword, BcryptCost);
        user.ForcePasswordReset = false;
        user.PasswordChangedAt = EnvTime.Now();
        user.PasswordExpiresAt = EnvTime.Now().AddDays(90);
        user.RefreshToken = null;
        user.UpdatedAt = EnvTime.Now();

        var resetRecord = await _db.PasswordResets.FirstOrDefaultAsync(pr => pr.Token == token, ct);
        if (resetRecord is not null)
        {
            resetRecord.UsedAt = EnvTime.Now();
        }

        await _db.SaveChangesAsync(ct);

        return new ResetPasswordResult(true, "Password reset successfully.");
    }
}
