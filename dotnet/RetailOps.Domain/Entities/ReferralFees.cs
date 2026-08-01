using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class ReferralFees
{
    public string Id { get; set; } = null!;

    public string Category { get; set; } = null!;

    public string? Tiers { get; set; }

    public DateTime? CreatedAt { get; set; }
}
