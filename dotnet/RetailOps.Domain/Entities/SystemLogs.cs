using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class SystemLogs
{
    public string Id { get; set; } = null!;

    public string? Type { get; set; }

    public string? EntityType { get; set; }

    public string? EntityId { get; set; }

    public string? EntityTitle { get; set; }

    public string? UserId { get; set; }

    public string? Description { get; set; }

    public string? Metadata { get; set; }

    public DateTime? CreatedAt { get; set; }

    public string? Severity { get; set; }

    public virtual Users? User { get; set; }
}
