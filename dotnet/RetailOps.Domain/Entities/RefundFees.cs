using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class RefundFees
{
    public string Id { get; set; } = null!;

    public string? Category { get; set; }

    public decimal? MinPrice { get; set; }

    public decimal? MaxPrice { get; set; }

    public decimal? Basic { get; set; }

    public decimal? Standard { get; set; }

    public decimal? Advanced { get; set; }

    public decimal? Premium { get; set; }

    public DateTime? CreatedAt { get; set; }
}
