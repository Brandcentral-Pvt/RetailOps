using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class GmsTargetBreakdowns
{
    public string Id { get; set; } = null!;

    public string TargetId { get; set; } = null!;

    public string PeriodType { get; set; } = null!;

    public int PeriodValue { get; set; }

    public DateOnly? SpecificDate { get; set; }

    public decimal TargetValue { get; set; }

    public decimal? AchievedValue { get; set; }

    public DateTime? CreatedAt { get; set; }

    public decimal? PercentageContribution { get; set; }

    public virtual GmsTargets Target { get; set; } = null!;
}
