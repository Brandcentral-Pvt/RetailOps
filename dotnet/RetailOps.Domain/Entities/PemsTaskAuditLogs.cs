using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class PemsTaskAuditLogs
{
    public string Id { get; set; } = null!;

    public string TaskInstanceId { get; set; } = null!;

    public string Action { get; set; } = null!;

    public string? FromStatus { get; set; }

    public string? ToStatus { get; set; }

    public string? ActorId { get; set; }

    public string? ActorName { get; set; }

    public string? ActorRole { get; set; }

    public string? Details { get; set; }

    public string? Metadata { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual PemsTaskInstances TaskInstance { get; set; } = null!;
}
