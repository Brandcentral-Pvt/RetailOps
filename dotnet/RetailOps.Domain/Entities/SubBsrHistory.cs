using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class SubBsrHistory
{
    public long Id { get; set; }

    public string AsinId { get; set; } = null!;

    public DateOnly Date { get; set; }

    public int? SubBsrRank { get; set; }

    public string? SubBsrCategory { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual Asins Asin { get; set; } = null!;
}
