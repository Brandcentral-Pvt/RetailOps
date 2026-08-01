using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class AsinHistory
{
    public long Id { get; set; }

    public string AsinId { get; set; } = null!;

    public DateOnly Date { get; set; }

    public decimal? Price { get; set; }

    public int? BSR { get; set; }

    public decimal? Rating { get; set; }

    public int? ReviewCount { get; set; }

    public bool? BuyBoxStatus { get; set; }

    public int? StockLevel { get; set; }

    public decimal? LQS { get; set; }

    public string? Source { get; set; }

    public int? SubBSR { get; set; }

    public virtual Asins Asin { get; set; } = null!;
}
