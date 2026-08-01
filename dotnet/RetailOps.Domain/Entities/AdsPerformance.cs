using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class AdsPerformance
{
    public long Id { get; set; }

    public string Asin { get; set; } = null!;

    public string? AdvertisedSku { get; set; }

    public DateOnly? Date { get; set; }

    public DateOnly? Month { get; set; }

    public string ReportType { get; set; } = null!;

    public decimal? AdSpend { get; set; }

    public decimal? AdSales { get; set; }

    public int? Impressions { get; set; }

    public int? Clicks { get; set; }

    public int? Orders { get; set; }

    public decimal? ACoS { get; set; }

    public decimal? RoAS { get; set; }

    public decimal? CTR { get; set; }

    public decimal? CPC { get; set; }

    public decimal? ConversionRate { get; set; }

    public decimal? OrganicSales { get; set; }

    public int? OrganicOrders { get; set; }

    public int? Sessions { get; set; }

    public DateTime? UploadedAt { get; set; }

    public int? Conversions { get; set; }

    public decimal? SameSkuSales { get; set; }

    public int? SameSkuOrders { get; set; }

    public decimal? DailyBudget { get; set; }

    public decimal? TotalBudget { get; set; }

    public decimal? MaxSpend { get; set; }

    public decimal? AvgSpend { get; set; }

    public decimal? TotalSales { get; set; }

    public decimal? TotalAcos { get; set; }

    public int? TotalUnits { get; set; }

    public int? PageViews { get; set; }

    public decimal? AdSalesPerc { get; set; }

    public decimal? TosIs { get; set; }

    public decimal? Aov { get; set; }

    public decimal? BuyBoxPercentage { get; set; }

    public int? BrowserSessions { get; set; }

    public int? MobileAppSessions { get; set; }
}
