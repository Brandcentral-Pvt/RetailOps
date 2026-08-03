using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class KeyResults
{
    public string Id { get; set; } = null!;

    public string ObjectiveId { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public string? OwnerId { get; set; }

    public string? Status { get; set; }

    public decimal? CurrentValue { get; set; }

    public decimal? TargetValue { get; set; }

    public string? Unit { get; set; }

    public decimal? Progress { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public string? MetricType { get; set; }

    public string? ResolvedAsins { get; set; }

    public decimal? AchievementPercent { get; set; }

    public decimal? ProjectedValue { get; set; }

    public decimal? DailyRunRateRequired { get; set; }

    public string? HealthStatus { get; set; }

    public virtual ICollection<Actions> Actions { get; set; } = new List<Actions>();

    public virtual Objectives Objective { get; set; } = null!;

    public virtual Users? Owner { get; set; }
}
