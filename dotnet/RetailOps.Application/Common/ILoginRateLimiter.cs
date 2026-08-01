namespace RetailOps.Application.Common;

public static class AuthErrors
{
    public const string GenericBlock = "Unable to sign in. Please try again later.";
}

public interface ILoginRateLimiter
{
    Task<bool> IsIpBlockedAsync(string ip, CancellationToken ct = default);
    Task<LockCheckResult> CheckEmailAsync(string email, string clientIp, CancellationToken ct = default);
    Task<int> RecordFailedAttemptAsync(string email, string clientIp, CancellationToken ct = default);
    Task RecordSuccessfulLoginAsync(string email, CancellationToken ct = default);
}

public sealed record LockCheckResult(bool IsLocked, TimeSpan Remaining);
