using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Asins
{
    public string Id { get; set; } = null!;

    public string AsinCode { get; set; } = null!;

    public string SellerId { get; set; } = null!;

    public string? Status { get; set; }

    public string? ScrapeStatus { get; set; }

    public string? Category { get; set; }

    public string? Brand { get; set; }

    public string? Title { get; set; }

    public string? ImageUrl { get; set; }

    public decimal? CurrentPrice { get; set; }

    public int? BSR { get; set; }

    public decimal? Rating { get; set; }

    public int? ReviewCount { get; set; }

    public decimal? LQS { get; set; }

    public string? LqsDetails { get; set; }

    public string? CdqComponents { get; set; }

    public string? FeePreview { get; set; }

    public bool? BuyBoxStatus { get; set; }

    public DateTime? LastScrapedAt { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public string? StapleLevel { get; set; }

    public decimal? Weight { get; set; }

    public decimal? LossPerReturn { get; set; }

    public string? Sku { get; set; }

    public string? SubBSRs { get; set; }

    public string? Images { get; set; }

    public int? ImagesCount { get; set; }

    public int? VideoCount { get; set; }

    public int? BulletPoints { get; set; }

    public string? BulletPointsText { get; set; }

    public int? StockLevel { get; set; }

    public string? SoldBy { get; set; }

    public bool? BuyBoxWin { get; set; }

    public string? BuyBoxSellerId { get; set; }

    public decimal? SecondAsp { get; set; }

    public string? SoldBySec { get; set; }

    public decimal? AspDifference { get; set; }

    public bool? HasAplus { get; set; }

    public string? AvailabilityStatus { get; set; }

    public DateTime? AplusAbsentSince { get; set; }

    public DateTime? AplusPresentSince { get; set; }

    public string? AllOffers { get; set; }

    public string? Tags { get; set; }

    public string? ParentAsin { get; set; }

    public decimal? UploadedPrice { get; set; }

    public DateTime? ReleaseDate { get; set; }

    public bool? PriceDispute { get; set; }

    public decimal? Mrp { get; set; }

    public string? DealBadge { get; set; }

    public string? BsrTrend { get; set; }

    public string? RatingTrend { get; set; }

    public decimal? DiscountPercentage { get; set; }

    public string? SubBsrCategories { get; set; }

    public decimal? LqsScore { get; set; }

    public string? LQSGrade { get; set; }

    public string? LqsIssues { get; set; }

    public decimal? TitleScore { get; set; }

    public decimal? BulletScore { get; set; }

    public decimal? ImageScore { get; set; }

    public decimal? DescriptionScore { get; set; }

    public bool? Ads { get; set; }

    public string? History { get; set; }

    public string? ProductDescription { get; set; }

    public string? TitleGrade { get; set; }

    public string? TitleIssues { get; set; }

    public string? TitleRecommendations { get; set; }

    public string? TitleDetails { get; set; }

    public string? BulletGrade { get; set; }

    public string? BulletIssues { get; set; }

    public string? BulletRecommendations { get; set; }

    public string? BulletDetails { get; set; }

    public string? ImageGrade { get; set; }

    public string? ImageIssues { get; set; }

    public string? ImageRecommendations { get; set; }

    public string? ImageDetails { get; set; }

    public string? DescriptionGrade { get; set; }

    public string? DescriptionIssues { get; set; }

    public string? DescriptionRecommendations { get; set; }

    public string? DescriptionDetails { get; set; }

    public string? PriceType { get; set; }

    public string? RatingBreakdown { get; set; }

    public string? Marketplace { get; set; }

    public int? Cdq { get; set; }

    public string? CdqGrade { get; set; }

    public string? ScrapedAsin { get; set; }

    public decimal? OrderedRevenue { get; set; }

    public int? OrderedUnits { get; set; }

    public decimal? ShippedRevenue { get; set; }

    public decimal? ShippedCOGS { get; set; }

    public int? ShippedUnits { get; set; }

    public int? CustomerReturns { get; set; }

    public string? SellerExternalId { get; set; }

    public string? CategoryPath { get; set; }

    public string? VariantImages { get; set; }

    public string? Dimensions { get; set; }

    public string? BuyBoxes { get; set; }

    public bool? HasDeal { get; set; }

    public string? DealType { get; set; }

    public DateTime? DealEndTime { get; set; }

    public string? AplusContent { get; set; }

    public int? AplusModuleCount { get; set; }

    public DateTime? LastLiveSyncAt { get; set; }

    public DateTime? LastOctoparseSyncAt { get; set; }

    public string? LastSyncSource { get; set; }

    public string? SubBSRCategory { get; set; }

    public int? SubBsr { get; set; }

    public string? Manufacturer { get; set; }

    public DateTime? DealStartTime { get; set; }

    public string? DealAccessType { get; set; }

    public string? DealPercentClaimed { get; set; }

    public virtual ICollection<Alerts> Alerts { get; set; } = new List<Alerts>();

    public virtual ICollection<AsinHistory> AsinHistory { get; set; } = new List<AsinHistory>();

    public virtual ICollection<AsinWeekHistory> AsinWeekHistory { get; set; } = new List<AsinWeekHistory>();

    public virtual ICollection<RevenueCalculators> RevenueCalculators { get; set; } = new List<RevenueCalculators>();

    public virtual Sellers Seller { get; set; } = null!;

    public virtual ICollection<SubBsrHistory> SubBsrHistory { get; set; } = new List<SubBsrHistory>();

    public virtual ICollection<TagsHistory> TagsHistory { get; set; } = new List<TagsHistory>();
}
