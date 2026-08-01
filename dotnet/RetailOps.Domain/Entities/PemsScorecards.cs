using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class PemsScorecards
{
    public string Id { get; set; } = null!;

    public string EntityType { get; set; } = null!;

    public string EntityId { get; set; } = null!;

    public string? EntityName { get; set; }

    public string Period { get; set; } = null!;

    public int? TotalTasks { get; set; }

    public int? CompletedTasks { get; set; }

    public int? RejectedTasks { get; set; }

    public decimal? AvgAchievementPct { get; set; }

    public decimal? AvgVariance { get; set; }

    public decimal? SLACompliancePct { get; set; }

    public decimal? AvgQualityScore { get; set; }

    public decimal? CompletionRatePct { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
