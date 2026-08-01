using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class BrandExecutionRegistry
{
    public string Id { get; set; } = null!;

    public string CycleId { get; set; } = null!;

    public string BrandId { get; set; } = null!;

    public string TaskId { get; set; } = null!;

    public string Tier { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateTime? StartedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public int? RetryCount { get; set; }

    public string? LastError { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
