using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class RevenueCalculators
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? AsinId { get; set; }

    public string SellerId { get; set; } = null!;

    public decimal? ReferralFee { get; set; }

    public decimal? ClosingFee { get; set; }

    public decimal? ShippingFee { get; set; }

    public decimal? FbaFee { get; set; }

    public decimal? StorageFee { get; set; }

    public decimal? Tax { get; set; }

    public decimal? TotalFees { get; set; }

    public decimal? NetRevenue { get; set; }

    public decimal? Margin { get; set; }

    public DateTime? CalculatedAt { get; set; }

    public virtual Asins? Asin { get; set; }

    public virtual Sellers Seller { get; set; } = null!;
}
