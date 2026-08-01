using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class AsinWeekHistory
{
    public long Id { get; set; }

    public string AsinId { get; set; } = null!;

    public DateOnly WeekStartDate { get; set; }

    public decimal? AvgPrice { get; set; }

    public int? AvgBSR { get; set; }

    public decimal? AvgRating { get; set; }

    public int? TotalReviews { get; set; }

    public virtual Asins Asin { get; set; } = null!;
}
