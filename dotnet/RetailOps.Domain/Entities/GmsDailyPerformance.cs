using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class GmsDailyPerformance
{
    public string Id { get; set; } = null!;

    public string Asin { get; set; } = null!;

    public DateOnly Date { get; set; }

    public string? Brand { get; set; }

    public string? StoreCode { get; set; }

    public decimal? OrderedRevenue { get; set; }

    public int? OrderedUnits { get; set; }

    public decimal? ShippedRevenue { get; set; }

    public decimal? ShippedCOGS { get; set; }

    public int? ShippedUnits { get; set; }

    public int? CustomerReturns { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
