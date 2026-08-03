using Microsoft.EntityFrameworkCore;
using RetailOps.Application.Common;
using RetailOps.Domain.Entities;
using RetailOps.Infrastructure.Common;
using RetailOps.Infrastructure.Data;

namespace RetailOps.Infrastructure.Auth;

public sealed class TrustedDeviceService : ITrustedDeviceService
{
    private static readonly TimeSpan TrustDuration = TimeSpan.FromHours(12);
    private readonly RetailOpsDbContext _db;

    public TrustedDeviceService(RetailOpsDbContext db)
    {
        _db = db;
    }

    public async Task<bool> IsTrustedAsync(string userId, string fingerprint, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(fingerprint)) return false;

        var device = await _db.TrustedDevices
            .FirstOrDefaultAsync(d =>
                d.UserId == userId &&
                d.DeviceFingerprint == fingerprint &&
                d.IsRevoked != true &&
                d.ExpiresAt > EnvTime.Now(), ct);

        if (device is not null)
        {
            device.LastUsedAt = EnvTime.Now();
            await _db.SaveChangesAsync(ct);
            return true;
        }
        return false;
    }

    public async Task TrustAsync(string userId, string fingerprint, DeviceMetadata metadata, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(fingerprint)) return;

        var expiresAt = EnvTime.Now().Add(TrustDuration);
        var existing = await _db.TrustedDevices
            .FirstOrDefaultAsync(d => d.UserId == userId && d.DeviceFingerprint == fingerprint, ct);

        if (existing is not null)
        {
            existing.ExpiresAt = expiresAt;
            existing.IsRevoked = false;
            existing.LastUsedAt = EnvTime.Now();
        }
        else
        {
            _db.TrustedDevices.Add(new TrustedDevices
            {
                UserId = userId,
                DeviceFingerprint = fingerprint,
                DeviceName = ParseDeviceName(metadata.UserAgent),
                IpAddress = metadata.IpAddress,
                ExpiresAt = expiresAt,
                CreatedAt = EnvTime.Now(),
                IsRevoked = false
            });
        }
        await _db.SaveChangesAsync(ct);
    }

    public async Task RevokeAllAsync(string userId, CancellationToken ct = default)
    {
        var devices = await _db.TrustedDevices
            .Where(d => d.UserId == userId && d.IsRevoked != true)
            .ToListAsync(ct);
        foreach (var device in devices)
        {
            device.IsRevoked = true;
        }
        if (devices.Count > 0) await _db.SaveChangesAsync(ct);
    }

    private static string ParseDeviceName(string? ua)
    {
        if (string.IsNullOrEmpty(ua)) return "Unknown Device";

        var browser = "Browser";
        var os = "OS";
        if (ua.Contains("Chrome")) browser = "Chrome";
        else if (ua.Contains("Firefox")) browser = "Firefox";
        else if (ua.Contains("Safari")) browser = "Safari";
        else if (ua.Contains("Edge")) browser = "Edge";

        if (ua.Contains("Windows")) os = "Windows";
        else if (ua.Contains("Mac")) os = "macOS";
        else if (ua.Contains("Linux")) os = "Linux";
        else if (ua.Contains("Android")) os = "Android";
        else if (ua.Contains("iPhone")) os = "iPhone";

        return $"{browser} on {os}";
    }
}
