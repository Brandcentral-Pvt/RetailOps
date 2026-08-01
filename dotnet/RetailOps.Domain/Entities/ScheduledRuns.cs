using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class ScheduledRuns
{
    public string Id { get; set; } = null!;

    public DateTime StartTime { get; set; }

    public DateTime? EndTime { get; set; }

    public string Status { get; set; } = null!;

    public string? Details { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
