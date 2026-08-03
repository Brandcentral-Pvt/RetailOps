using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class PemsTaskEvents
{
    public string Id { get; set; } = null!;

    public string TaskInstanceId { get; set; } = null!;

    public string EventType { get; set; } = null!;

    public string? FromStatus { get; set; }

    public string? ToStatus { get; set; }

    public string? ActorId { get; set; }

    public string? ActorName { get; set; }

    public string? Payload { get; set; }

    public int Version { get; set; }

    public DateTime? CreatedAt { get; set; }
}
