using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using RetailOps.Application.Common;

namespace RetailOps.Infrastructure.Security;

public sealed class InMemoryLoginRateLimiter : ILoginRateLimiter
{
    private static readonly TimeSpan IpWindow = TimeSpan.FromMinutes(1);
    private const int IpMax = 10;
    private static readonly TimeSpan FailLockout = TimeSpan.FromMinutes(15);
    private const int FailThreshold = 5;
    private static readonly int[] ProgressiveDelaysMs = { 0, 1000, 2000, 4000, 8000, 16000 };

    private sealed record CounterEntry(long Count, DateTime ExpiresAt);
    private sealed record LockEntry(DateTime LockUntil, DateTime ExpiresAt);

    private readonly ConcurrentDictionary<string, CounterEntry> _ipCounts = new();
    private readonly ConcurrentDictionary<string, CounterEntry> _emailFailures = new();
    private readonly ConcurrentDictionary<string, LockEntry> _emailLocks = new();
    private readonly ILogger<InMemoryLoginRateLimiter> _logger;

    public InMemoryLoginRateLimiter(ILogger<InMemoryLoginRateLimiter> logger)
    {
        _logger = logger;
    }

    public Task<bool> IsIpBlockedAsync(string ip, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var key = $"rl:ip:{ip}";
        var entry = _ipCounts.AddOrUpdate(key,
            new CounterEntry(1, now.Add(IpWindow)),
            (_, existing) => existing.ExpiresAt > now
                ? new CounterEntry(existing.Count + 1, existing.ExpiresAt)
                : new CounterEntry(1, now.Add(IpWindow)));

        if (entry.Count > IpMax)
        {
            _logger.LogWarning("[RATE_LIMIT] IP {Ip} exceeded {Max} requests/min ({Count} counted)", ip, IpMax, entry.Count);
            return Task.FromResult(true);
        }
        return Task.FromResult(false);
    }

    public async Task<LockCheckResult> CheckEmailAsync(string email, string clientIp, CancellationToken ct = default)
    {
        var normalized = email.ToLowerInvariant().Trim();
        var now = DateTime.UtcNow;

        if (_emailLocks.TryGetValue(normalized, out var lockEntry))
        {
            if (lockEntry.LockUntil > now)
            {
                var remaining = lockEntry.LockUntil - now;
                _logger.LogWarning("[LOCKOUT] {Email} is locked. {Min}min remaining. IP: {Ip}",
                    normalized, Math.Ceiling(remaining.TotalMinutes), clientIp);
                return new LockCheckResult(true, remaining);
            }
            _emailLocks.TryRemove(normalized, out _);
        }

        if (_emailFailures.TryGetValue(normalized, out var failures) && failures.ExpiresAt > now)
        {
            var delayMs = ProgressiveDelaysMs[Math.Min((int)failures.Count, ProgressiveDelaysMs.Length - 1)];
            if (delayMs > 0)
            {
                _logger.LogInformation("[PROGRESSIVE_DELAY] {Email} attempt {Attempt}: waiting {Delay}ms",
                    normalized, failures.Count + 1, delayMs);
                await Task.Delay(delayMs, ct);
            }
        }

        return new LockCheckResult(false, TimeSpan.Zero);
    }

    public Task<int> RecordFailedAttemptAsync(string email, string clientIp, CancellationToken ct = default)
    {
        var normalized = email.ToLowerInvariant().Trim();
        var now = DateTime.UtcNow;
        var ttl = FailLockout.Add(TimeSpan.FromSeconds(60));

        var entry = _emailFailures.AddOrUpdate(normalized,
            new CounterEntry(1, now.Add(ttl)),
            (_, existing) => existing.ExpiresAt > now
                ? new CounterEntry(existing.Count + 1, existing.ExpiresAt)
                : new CounterEntry(1, now.Add(ttl)));

        var count = (int)entry.Count;
        _logger.LogWarning("[FAILED_ATTEMPT] {Email} — attempt {Count}/{Threshold} | IP: {Ip}",
            normalized, count, FailThreshold, clientIp);

        if (count >= FailThreshold)
        {
            var lockUntil = now.Add(FailLockout);
            _emailLocks[normalized] = new LockEntry(lockUntil, now.Add(ttl));
            _logger.LogWarning("[LOCKOUT] {Email} locked for 15 minutes. IP: {Ip}", normalized, clientIp);
        }

        return Task.FromResult(count);
    }

    public Task RecordSuccessfulLoginAsync(string email, CancellationToken ct = default)
    {
        var normalized = email.ToLowerInvariant().Trim();
        _emailFailures[normalized] = new CounterEntry(0, DateTime.UtcNow.Add(TimeSpan.FromSeconds(1)));
        _emailLocks[normalized] = new LockEntry(DateTime.UtcNow, DateTime.UtcNow.Add(TimeSpan.FromSeconds(1)));
        return Task.CompletedTask;
    }
}
