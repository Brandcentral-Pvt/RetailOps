using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using RetailOps.Application.Common;
using RetailOps.Infrastructure.Data;

namespace RetailOps.Infrastructure.Security;

public sealed class TokenBlacklistService : ITokenBlacklistService, IDisposable
{
    private static readonly TimeSpan UserBlacklistDuration = TimeSpan.FromHours(24);

    private readonly RetailOpsDbContext _db;
    private readonly ConcurrentDictionary<string, DateTime> _tokenBlacklist = new();
    private readonly ConcurrentDictionary<string, DateTime> _userBlacklist = new();
    private readonly Timer _cleanupTimer;
    private bool _disposed;

    public TokenBlacklistService(RetailOpsDbContext db)
    {
        _db = db;
        _cleanupTimer = new Timer(_ => Cleanup(), null, TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(5));
    }

    public Task<bool> IsBlacklistedAsync(string token, CancellationToken ct = default)
    {
        if (_tokenBlacklist.TryGetValue(token, out var expiry))
        {
            if (DateTime.UtcNow < expiry) return Task.FromResult(true);
            _tokenBlacklist.TryRemove(token, out _);
        }
        return Task.FromResult(false);
    }

    public Task<bool> BlacklistAsync(string token, CancellationToken ct = default)
    {
        var principal = JwtTokenReader.Read(token);
        var expiresAt = principal?.FindFirst("exp")?.Value;
        if (expiresAt is null) return Task.FromResult(false);

        var ttl = DateTimeOffset.FromUnixTimeSeconds(long.Parse(expiresAt)) - DateTimeOffset.UtcNow;
        if (ttl <= TimeSpan.Zero) return Task.FromResult(false);

        _tokenBlacklist[token] = DateTime.UtcNow.Add(ttl);
        return Task.FromResult(true);
    }

    public async Task<bool> BlacklistUserAsync(string userId, CancellationToken ct = default)
    {
        _userBlacklist[userId] = DateTime.UtcNow.Add(UserBlacklistDuration);

        await _db.Users
            .Where(u => u.Id == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.RefreshToken, (string?)null), ct);
        return true;
    }

    public Task<bool> IsUserBlacklistedAsync(string userId, long? tokenIssuedAtUnixSeconds, CancellationToken ct = default)
    {
        if (!_userBlacklist.TryGetValue(userId, out var blacklistedAt)) return Task.FromResult(false);
        if (tokenIssuedAtUnixSeconds is null) return Task.FromResult(true);
        return Task.FromResult(DateTimeOffset.FromUnixTimeSeconds(tokenIssuedAtUnixSeconds.Value).UtcDateTime < blacklistedAt);
    }

    private void Cleanup()
    {
        var now = DateTime.UtcNow;
        foreach (var kvp in _tokenBlacklist)
        {
            if (now > kvp.Value) _tokenBlacklist.TryRemove(kvp.Key, out _);
        }
        foreach (var kvp in _userBlacklist)
        {
            if (now > kvp.Value) _userBlacklist.TryRemove(kvp.Key, out _);
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _cleanupTimer.Dispose();
        _disposed = true;
    }
}

public static class JwtTokenReader
{
    public static System.Security.Claims.ClaimsPrincipal? Read(string token)
    {
        try
        {
            var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
            return handler.ReadJwtToken(token) is { } jwt
                ? new System.Security.Claims.ClaimsPrincipal(
                    new System.Security.Claims.ClaimsIdentity(jwt.Claims, "jwt"))
                : null;
        }
        catch
        {
            return null;
        }
    }
}
