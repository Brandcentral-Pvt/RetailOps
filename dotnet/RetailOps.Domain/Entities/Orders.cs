using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Orders
{
    public long Id { get; set; }

    public string Asin { get; set; } = null!;

    public string? Sku { get; set; }

    public DateOnly Date { get; set; }

    public int? Units { get; set; }

    public decimal? Revenue { get; set; }

    public int? Returns { get; set; }

    public string? Currency { get; set; }

    public string? Marketplace { get; set; }

    public string? Source { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
