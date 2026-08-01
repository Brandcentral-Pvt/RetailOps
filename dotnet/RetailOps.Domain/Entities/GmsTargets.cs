using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class GmsTargets
{
    public string Id { get; set; } = null!;

    public string SellerId { get; set; } = null!;

    public string? BrandManager { get; set; }

    public string TargetType { get; set; } = null!;

    public int Year { get; set; }

    public int? Month { get; set; }

    public decimal TotalTargetValue { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public string GoalType { get; set; } = null!;

    public string? UserId { get; set; }

    public virtual ICollection<GmsTargetBreakdowns> GmsTargetBreakdowns { get; set; } = new List<GmsTargetBreakdowns>();

    public virtual Users? User { get; set; }
}
