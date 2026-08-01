namespace RetailOps.Application.Common;

public sealed record DeviceMetadata(string? IpAddress, string? UserAgent);

public interface ITrustedDeviceService
{
    Task<bool> IsTrustedAsync(string userId, string fingerprint, CancellationToken ct = default);
    Task TrustAsync(string userId, string fingerprint, DeviceMetadata metadata, CancellationToken ct = default);
    Task RevokeAllAsync(string userId, CancellationToken ct = default);
}

public interface ITokenBlacklistService
{
    Task<bool> IsBlacklistedAsync(string token, CancellationToken ct = default);
    Task<bool> BlacklistAsync(string token, CancellationToken ct = default);
    Task<bool> BlacklistUserAsync(string userId, CancellationToken ct = default);
    Task<bool> IsUserBlacklistedAsync(string userId, long? tokenIssuedAtUnixSeconds, CancellationToken ct = default);
}
