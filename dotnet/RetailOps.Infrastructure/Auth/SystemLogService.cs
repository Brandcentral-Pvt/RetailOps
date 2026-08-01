using System.Text.Json;
using Microsoft.Extensions.Logging;
using RetailOps.Application.Common;
using RetailOps.Domain.Entities;
using RetailOps.Infrastructure.Common;
using RetailOps.Infrastructure.Data;

namespace RetailOps.Infrastructure.Auth;

public sealed class SystemLogService : ISystemLogService
{
    private readonly RetailOpsDbContext _db;
    private readonly ILogger<SystemLogService> _logger;

    public SystemLogService(RetailOpsDbContext db, ILogger<SystemLogService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task LogAsync(SystemLogEntry entry, CancellationToken ct = default)
    {
        try
        {
            var userId = ExtractUserId(entry.User);

            _db.SystemLogs.Add(new SystemLogs
            {
                Id = IdGenerator.New(),
                Type = entry.Type,
                EntityType = entry.EntityType,
                EntityId = entry.EntityId,
                EntityTitle = entry.EntityTitle,
                UserId = userId,
                Description = entry.Description,
                Metadata = entry.Metadata is null ? null : JsonSerializer.Serialize(entry.Metadata),
                CreatedAt = EnvTime.Now()
            });
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create system log");
        }
    }

    private static string? ExtractUserId(object? user)
    {
        if (user is null) return null;
        if (user is string s) return s;
        return user.ToString();
    }
}
