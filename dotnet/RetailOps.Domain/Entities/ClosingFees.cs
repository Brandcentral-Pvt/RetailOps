using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class ClosingFees
{
    public string Id { get; set; } = null!;

    public string? Category { get; set; }

    public string? SellerType { get; set; }

    public decimal? MinPrice { get; set; }

    public decimal? MaxPrice { get; set; }

    public decimal? Fee { get; set; }

    public DateTime? CreatedAt { get; set; }
}
