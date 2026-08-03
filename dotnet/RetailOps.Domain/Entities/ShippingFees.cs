using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class ShippingFees
{
    public string Id { get; set; } = null!;

    public string? SizeType { get; set; }

    public decimal? WeightMin { get; set; }

    public decimal? WeightMax { get; set; }

    public decimal? Fee { get; set; }

    public decimal? PickAndPackFee { get; set; }

    public bool? UseIncremental { get; set; }

    public decimal? IncrementalStep { get; set; }

    public decimal? IncrementalFee { get; set; }

    public DateTime? CreatedAt { get; set; }
}
