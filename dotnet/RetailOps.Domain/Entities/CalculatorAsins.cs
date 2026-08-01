using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class CalculatorAsins
{
    public string Id { get; set; } = null!;

    public string AsinCode { get; set; } = null!;

    public string? Title { get; set; }

    public string? Category { get; set; }

    public decimal? Price { get; set; }

    public decimal? Weight { get; set; }

    public string? StapleLevel { get; set; }

    public string? Status { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
