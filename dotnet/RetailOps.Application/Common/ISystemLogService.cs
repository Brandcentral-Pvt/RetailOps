namespace RetailOps.Application.Common;

public sealed record SystemLogEntry(
    string Type,
    string EntityType,
    string? EntityId,
    string? EntityTitle,
    string? User,
    string? Description,
    object? Metadata);

public interface ISystemLogService
{
    Task LogAsync(SystemLogEntry entry, CancellationToken cancellationToken = default);
}
