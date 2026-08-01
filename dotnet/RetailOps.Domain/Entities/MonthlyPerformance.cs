using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class MonthlyPerformance
{
    public string Id { get; set; } = null!;

    public string Asin { get; set; } = null!;

    public DateOnly Month { get; set; }

    public int? OrderedUnits { get; set; }

    public decimal? OrderedRevenue { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
