using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using RetailOps.Domain.Entities;

namespace RetailOps.Infrastructure.Data;

public partial class RetailOpsDbContext : DbContext
{
    public RetailOpsDbContext()
    {
    }

    public RetailOpsDbContext(DbContextOptions<RetailOpsDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<ActionHistory> ActionHistory { get; set; }

    public virtual DbSet<Actions> Actions { get; set; }

    public virtual DbSet<AdsPerformance> AdsPerformance { get; set; }

    public virtual DbSet<AlertRules> AlertRules { get; set; }

    public virtual DbSet<Alerts> Alerts { get; set; }

    public virtual DbSet<ApiKeys> ApiKeys { get; set; }

    public virtual DbSet<AsinHistory> AsinHistory { get; set; }

    public virtual DbSet<AsinWeekHistory> AsinWeekHistory { get; set; }

    public virtual DbSet<Asins> Asins { get; set; }

    public virtual DbSet<Asins_Backup_DealBadge> Asins_Backup_DealBadge { get; set; }

    public virtual DbSet<BrandExecutionRegistry> BrandExecutionRegistry { get; set; }

    public virtual DbSet<CalculatorAsins> CalculatorAsins { get; set; }

    public virtual DbSet<CallLogs> CallLogs { get; set; }

    public virtual DbSet<CategoryMaps> CategoryMaps { get; set; }

    public virtual DbSet<ClosingFees> ClosingFees { get; set; }

    public virtual DbSet<ConversationParticipants> ConversationParticipants { get; set; }

    public virtual DbSet<Conversations> Conversations { get; set; }

    public virtual DbSet<Downloads> Downloads { get; set; }

    public virtual DbSet<Files> Files { get; set; }

    public virtual DbSet<GmsDailyPerformance> GmsDailyPerformance { get; set; }

    public virtual DbSet<GmsTargetBreakdowns> GmsTargetBreakdowns { get; set; }

    public virtual DbSet<GmsTargets> GmsTargets { get; set; }

    public virtual DbSet<GoalTemplates> GoalTemplates { get; set; }

    public virtual DbSet<Goals> Goals { get; set; }

    public virtual DbSet<KeyResults> KeyResults { get; set; }

    public virtual DbSet<MessageReactions> MessageReactions { get; set; }

    public virtual DbSet<MessageStatus> MessageStatus { get; set; }

    public virtual DbSet<Messages> Messages { get; set; }

    public virtual DbSet<MonthlyPerformance> MonthlyPerformance { get; set; }

    public virtual DbSet<NodeMaps> NodeMaps { get; set; }

    public virtual DbSet<Notifications> Notifications { get; set; }

    public virtual DbSet<Objectives> Objectives { get; set; }

    public virtual DbSet<OctoTasks> OctoTasks { get; set; }

    public virtual DbSet<Orders> Orders { get; set; }

    public virtual DbSet<OtpAuditLog> OtpAuditLog { get; set; }

    public virtual DbSet<OtpVerifications> OtpVerifications { get; set; }

    public virtual DbSet<PasswordHistory> PasswordHistory { get; set; }

    public virtual DbSet<PasswordResets> PasswordResets { get; set; }

    public virtual DbSet<PemsActivities> PemsActivities { get; set; }

    public virtual DbSet<PemsAssignmentRules> PemsAssignmentRules { get; set; }

    public virtual DbSet<PemsEscalationRules> PemsEscalationRules { get; set; }

    public virtual DbSet<PemsEvidence> PemsEvidence { get; set; }

    public virtual DbSet<PemsNotifications> PemsNotifications { get; set; }

    public virtual DbSet<PemsScorecards> PemsScorecards { get; set; }

    public virtual DbSet<PemsSubTasks> PemsSubTasks { get; set; }

    public virtual DbSet<PemsTaskAuditLogs> PemsTaskAuditLogs { get; set; }

    public virtual DbSet<PemsTaskEvents> PemsTaskEvents { get; set; }

    public virtual DbSet<PemsTaskInstances> PemsTaskInstances { get; set; }

    public virtual DbSet<PemsTaskReviews> PemsTaskReviews { get; set; }

    public virtual DbSet<PemsTaskTemplates> PemsTaskTemplates { get; set; }

    public virtual DbSet<Permissions> Permissions { get; set; }

    public virtual DbSet<PredefinedTags> PredefinedTags { get; set; }

    public virtual DbSet<ReferralFees> ReferralFees { get; set; }

    public virtual DbSet<RefundFees> RefundFees { get; set; }

    public virtual DbSet<RevenueCalculators> RevenueCalculators { get; set; }

    public virtual DbSet<Roles> Roles { get; set; }

    public virtual DbSet<RulesetExecutionLogs> RulesetExecutionLogs { get; set; }

    public virtual DbSet<Rulesets> Rulesets { get; set; }

    public virtual DbSet<ScheduledRuns> ScheduledRuns { get; set; }

    public virtual DbSet<Sellers> Sellers { get; set; }

    public virtual DbSet<SetupWizardProgress> SetupWizardProgress { get; set; }

    public virtual DbSet<ShippingFees> ShippingFees { get; set; }

    public virtual DbSet<StorageFees> StorageFees { get; set; }

    public virtual DbSet<SubBsrHistory> SubBsrHistory { get; set; }

    public virtual DbSet<SystemLogs> SystemLogs { get; set; }

    public virtual DbSet<SystemSettings> SystemSettings { get; set; }

    public virtual DbSet<TagsHistory> TagsHistory { get; set; }

    public virtual DbSet<TaskTemplates> TaskTemplates { get; set; }

    public virtual DbSet<Tasks> Tasks { get; set; }

    public virtual DbSet<TeamMembers> TeamMembers { get; set; }

    public virtual DbSet<Teams> Teams { get; set; }

    public virtual DbSet<TrustedDevices> TrustedDevices { get; set; }

    public virtual DbSet<Users> Users { get; set; }

    public virtual DbSet<WebhookLogs> WebhookLogs { get; set; }

    public virtual DbSet<Webhooks> Webhooks { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        if (!optionsBuilder.IsConfigured)
        {
            optionsBuilder.UseSqlServer(ConnectionStringResolver.Resolve());
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ActionHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__ActionHi__3214EC072B60335F");

            entity.Property(e => e.ActionId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ChangedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.ChangedBy)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.StatusFrom).HasMaxLength(50);
            entity.Property(e => e.StatusTo).HasMaxLength(50);

            entity.HasOne(d => d.Action).WithMany(p => p.ActionHistory)
                .HasForeignKey(d => d.ActionId)
                .HasConstraintName("FK_ActionHistory_Action");

            entity.HasOne(d => d.ChangedByNavigation).WithMany(p => p.ActionHistory)
                .HasForeignKey(d => d.ChangedBy)
                .HasConstraintName("FK_ActionHistory_User");
        });

        modelBuilder.Entity<Actions>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Actions__3214EC07287D79A8");

            entity.HasIndex(e => e.AssignedTo, "IX_Actions_AssignedTo");

            entity.HasIndex(e => e.SellerId, "IX_Actions_SellerId");

            entity.HasIndex(e => e.Status, "IX_Actions_Status");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.AsinId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.AssignedTo)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.AutoGeneratedSource).HasMaxLength(100);
            entity.Property(e => e.Category)
                .HasMaxLength(100)
                .HasDefaultValue("GENERAL");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.GoalId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.IsAIGenerated).HasDefaultValue(false);
            entity.Property(e => e.KeyResultId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ObjectiveId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Priority).HasMaxLength(50);
            entity.Property(e => e.SellerId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Source).HasMaxLength(100);
            entity.Property(e => e.SourceId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Status).HasMaxLength(50);
            entity.Property(e => e.SubTaskProgress).HasMaxLength(50);
            entity.Property(e => e.TimeLimit).HasDefaultValue(60);
            entity.Property(e => e.Title).HasMaxLength(255);
            entity.Property(e => e.Type).HasMaxLength(50);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");

            entity.HasOne(d => d.AssignedToNavigation).WithMany(p => p.ActionsAssignedToNavigation)
                .HasForeignKey(d => d.AssignedTo)
                .HasConstraintName("FK_Actions_AssignedTo");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.ActionsCreatedByNavigation)
                .HasForeignKey(d => d.CreatedBy)
                .HasConstraintName("FK_Actions_CreatedBy");

            entity.HasOne(d => d.Goal).WithMany(p => p.Actions)
                .HasForeignKey(d => d.GoalId)
                .HasConstraintName("FK_Actions_Goal");

            entity.HasOne(d => d.KeyResult).WithMany(p => p.Actions)
                .HasForeignKey(d => d.KeyResultId)
                .HasConstraintName("FK_Actions_KeyResult");

            entity.HasOne(d => d.Objective).WithMany(p => p.Actions)
                .HasForeignKey(d => d.ObjectiveId)
                .HasConstraintName("FK_Actions_Objective");

            entity.HasOne(d => d.Seller).WithMany(p => p.Actions)
                .HasForeignKey(d => d.SellerId)
                .HasConstraintName("FK_Actions_Seller");
        });

        modelBuilder.Entity<AdsPerformance>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__AdsPerfo__3214EC076A788DD8");

            entity.HasIndex(e => new { e.Asin, e.Date }, "IX_AdsPerformance_Asin_Date");

            entity.HasIndex(e => new { e.Asin, e.Date, e.ReportType }, "IX_AdsPerformance_Asin_Date_ReportType");

            entity.HasIndex(e => new { e.Asin, e.Month, e.ReportType }, "IX_AdsPerformance_Asin_Month_ReportType");

            entity.HasIndex(e => new { e.Date, e.ReportType }, "IX_AdsPerformance_Date_ReportType").IsDescending(true, false);

            entity.HasIndex(e => new { e.ReportType, e.Date }, "IX_AdsPerformance_ReportType_Date");

            entity.Property(e => e.ACoS)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.AdSales)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.AdSalesPerc)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.AdSpend)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.AdvertisedSku)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.Aov)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Asin)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.AvgSpend)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.BrowserSessions).HasDefaultValue(0);
            entity.Property(e => e.BuyBoxPercentage)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.CPC)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.CTR)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.Clicks).HasDefaultValue(0);
            entity.Property(e => e.ConversionRate)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.Conversions).HasDefaultValue(0);
            entity.Property(e => e.DailyBudget)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Impressions).HasDefaultValue(0);
            entity.Property(e => e.MaxSpend)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.MobileAppSessions).HasDefaultValue(0);
            entity.Property(e => e.Orders).HasDefaultValue(0);
            entity.Property(e => e.OrganicOrders).HasDefaultValue(0);
            entity.Property(e => e.OrganicSales)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.PageViews).HasDefaultValue(0);
            entity.Property(e => e.ReportType)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.RoAS)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.SameSkuOrders).HasDefaultValue(0);
            entity.Property(e => e.SameSkuSales)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Sessions).HasDefaultValue(0);
            entity.Property(e => e.TosIs)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.TotalAcos)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TotalBudget)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TotalSales)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TotalUnits).HasDefaultValue(0);
            entity.Property(e => e.UploadedAt).HasDefaultValueSql("(getdate())");
        });

        modelBuilder.Entity<AlertRules>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__AlertRul__3214EC0705241C86");

            entity.HasIndex(e => e.IsActive, "IX_AlertRules_IsActive");

            entity.HasIndex(e => e.Type, "IX_AlertRules_Type");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.Name).HasMaxLength(255);
            entity.Property(e => e.SellerId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Severity).HasMaxLength(20);
            entity.Property(e => e.Type).HasMaxLength(50);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.AlertRules)
                .HasForeignKey(d => d.CreatedBy)
                .HasConstraintName("FK_AlertRules_CreatedBy");
        });

        modelBuilder.Entity<Alerts>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Alerts__3214EC07B06FE52B");

            entity.HasIndex(e => e.Acknowledged, "IX_Alerts_Acknowledged");

            entity.HasIndex(e => e.AsinId, "IX_Alerts_AsinId");

            entity.HasIndex(e => e.CreatedAt, "IX_Alerts_CreatedAt").IsDescending();

            entity.HasIndex(e => e.IsResolved, "IX_Alerts_IsResolved");

            entity.HasIndex(e => e.RuleId, "IX_Alerts_RuleId");

            entity.HasIndex(e => e.SellerId, "IX_Alerts_SellerId");

            entity.HasIndex(e => new { e.SellerId, e.CreatedAt }, "IX_Alerts_SellerId_CreatedAt").IsDescending(false, true);

            entity.HasIndex(e => new { e.Severity, e.CreatedAt }, "IX_Alerts_Severity_CreatedAt").IsDescending(false, true);

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Acknowledged).HasDefaultValue(false);
            entity.Property(e => e.AcknowledgedBy).HasMaxLength(255);
            entity.Property(e => e.AsinId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.IsResolved).HasDefaultValue(false);
            entity.Property(e => e.ResolvedBy)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.RuleId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.SellerId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Severity).HasMaxLength(20);
            entity.Property(e => e.Title).HasMaxLength(255);
            entity.Property(e => e.Type).HasMaxLength(50);

            entity.HasOne(d => d.Asin).WithMany(p => p.Alerts)
                .HasForeignKey(d => d.AsinId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("FK_Alerts_Asin");

            entity.HasOne(d => d.ResolvedByNavigation).WithMany(p => p.Alerts)
                .HasForeignKey(d => d.ResolvedBy)
                .HasConstraintName("FK_Alerts_ResolvedBy");

            entity.HasOne(d => d.Seller).WithMany(p => p.Alerts)
                .HasForeignKey(d => d.SellerId)
                .HasConstraintName("FK_Alerts_Seller");
        });

        modelBuilder.Entity<ApiKeys>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__ApiKeys__3214EC07E964FA3A");

            entity.HasIndex(e => e.Key, "IX_ApiKeys_Key");

            entity.HasIndex(e => e.OwnerId, "IX_ApiKeys_OwnerId");

            entity.HasIndex(e => e.ServiceId, "IX_ApiKeys_ServiceId").IsUnique();

            entity.HasIndex(e => e.Key, "UQ__ApiKeys__C41E028988D13C21").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Category)
                .HasMaxLength(50)
                .HasDefaultValue("Other");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.Key).HasMaxLength(255);
            entity.Property(e => e.Name).HasMaxLength(255);
            entity.Property(e => e.OwnerId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ServiceId)
                .HasMaxLength(100)
                .HasDefaultValue("");

            entity.HasOne(d => d.Owner).WithMany(p => p.ApiKeys)
                .HasForeignKey(d => d.OwnerId)
                .HasConstraintName("FK_ApiKeys_Owner");
        });

        modelBuilder.Entity<AsinHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__AsinHist__3214EC0760DE700E");

            entity.HasIndex(e => new { e.AsinId, e.Date }, "IX_AsinHistory_AsinId_Date");

            entity.Property(e => e.AsinId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.LQS).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.Price).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Rating).HasColumnType("decimal(3, 2)");
            entity.Property(e => e.Source).HasMaxLength(20);

            entity.HasOne(d => d.Asin).WithMany(p => p.AsinHistory)
                .HasForeignKey(d => d.AsinId)
                .HasConstraintName("FK_AsinHistory_Asin");
        });

        modelBuilder.Entity<AsinWeekHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__AsinWeek__3214EC075148E6B4");

            entity.Property(e => e.AsinId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.AvgPrice).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.AvgRating).HasColumnType("decimal(3, 2)");

            entity.HasOne(d => d.Asin).WithMany(p => p.AsinWeekHistory)
                .HasForeignKey(d => d.AsinId)
                .HasConstraintName("FK_AsinWeekHistory_Asin");
        });

        modelBuilder.Entity<Asins>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Asins__3214EC07E865982A");

            entity.HasIndex(e => e.BSR, "IX_Asins_BSR").HasFilter("([BSR]>(0))");

            entity.HasIndex(e => e.Brand, "IX_Asins_Brand");

            entity.HasIndex(e => e.BuyBoxStatus, "IX_Asins_BuyBoxStatus").HasFilter("([BuyBoxStatus]=(1))");

            entity.HasIndex(e => e.Category, "IX_Asins_Category");

            entity.HasIndex(e => e.CurrentPrice, "IX_Asins_CurrentPrice");

            entity.HasIndex(e => e.SellerId, "IX_Asins_SellerId");

            entity.HasIndex(e => new { e.SellerId, e.Status }, "IX_Asins_SellerId_Status");

            entity.HasIndex(e => e.Sku, "IX_Asins_Sku");

            entity.HasIndex(e => e.Status, "IX_Asins_Status");

            entity.HasIndex(e => new { e.AsinCode, e.SellerId }, "UC_Asin_Seller").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Ads).HasDefaultValue(false);
            entity.Property(e => e.AplusModuleCount).HasDefaultValue(0);
            entity.Property(e => e.AsinCode)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.AspDifference).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.AvailabilityStatus).HasMaxLength(100);
            entity.Property(e => e.Brand).HasMaxLength(255);
            entity.Property(e => e.BsrTrend).HasMaxLength(50);
            entity.Property(e => e.BulletGrade).HasMaxLength(10);
            entity.Property(e => e.BulletScore).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.BuyBoxSellerId).HasMaxLength(255);
            entity.Property(e => e.BuyBoxWin).HasDefaultValue(false);
            entity.Property(e => e.Category).HasMaxLength(255);
            entity.Property(e => e.CategoryPath).HasMaxLength(500);
            entity.Property(e => e.CdqGrade).HasMaxLength(10);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.CurrentPrice).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.CustomerReturns).HasDefaultValue(0);
            entity.Property(e => e.DealAccessType).HasMaxLength(50);
            entity.Property(e => e.DealBadge).HasMaxLength(100);
            entity.Property(e => e.DealEndTime).HasColumnType("datetime");
            entity.Property(e => e.DealPercentClaimed).HasMaxLength(20);
            entity.Property(e => e.DealStartTime).HasColumnType("datetime");
            entity.Property(e => e.DealType).HasMaxLength(50);
            entity.Property(e => e.DescriptionGrade).HasMaxLength(10);
            entity.Property(e => e.DescriptionScore).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.DiscountPercentage).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.HasAplus).HasDefaultValue(false);
            entity.Property(e => e.HasDeal).HasDefaultValue(false);
            entity.Property(e => e.ImageGrade).HasMaxLength(10);
            entity.Property(e => e.ImageScore).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.LQS).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.LQSGrade).HasMaxLength(5);
            entity.Property(e => e.LastLiveSyncAt).HasColumnType("datetime");
            entity.Property(e => e.LastOctoparseSyncAt).HasColumnType("datetime");
            entity.Property(e => e.LastSyncSource).HasMaxLength(20);
            entity.Property(e => e.LossPerReturn)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.LqsScore).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.Manufacturer).HasMaxLength(255);
            entity.Property(e => e.Marketplace).HasMaxLength(100);
            entity.Property(e => e.Mrp).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.OrderedRevenue)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.OrderedUnits).HasDefaultValue(0);
            entity.Property(e => e.ParentAsin).HasMaxLength(100);
            entity.Property(e => e.PriceDispute).HasDefaultValue(false);
            entity.Property(e => e.PriceType).HasMaxLength(50);
            entity.Property(e => e.Rating).HasColumnType("decimal(3, 2)");
            entity.Property(e => e.RatingTrend).HasMaxLength(50);
            entity.Property(e => e.ScrapeStatus).HasMaxLength(50);
            entity.Property(e => e.ScrapedAsin).HasMaxLength(255);
            entity.Property(e => e.SecondAsp).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.SellerExternalId).HasMaxLength(100);
            entity.Property(e => e.SellerId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ShippedCOGS)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.ShippedRevenue)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.ShippedUnits).HasDefaultValue(0);
            entity.Property(e => e.Sku).HasMaxLength(100);
            entity.Property(e => e.SoldBy).HasMaxLength(255);
            entity.Property(e => e.SoldBySec).HasMaxLength(255);
            entity.Property(e => e.StapleLevel)
                .HasMaxLength(50)
                .HasDefaultValue("Standard");
            entity.Property(e => e.Status).HasMaxLength(50);
            entity.Property(e => e.SubBSRCategory).HasMaxLength(255);
            entity.Property(e => e.TitleGrade).HasMaxLength(10);
            entity.Property(e => e.TitleScore).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.UploadedPrice).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Weight)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 3)");

            entity.HasOne(d => d.Seller).WithMany(p => p.Asins)
                .HasForeignKey(d => d.SellerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Asins_Seller");
        });

        modelBuilder.Entity<Asins_Backup_DealBadge>(entity =>
        {
            entity.HasNoKey();

            entity.Property(e => e.DealBadge).HasMaxLength(100);
            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
        });

        modelBuilder.Entity<BrandExecutionRegistry>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__BrandExe__3214EC07879B79EA");

            entity.HasIndex(e => new { e.CycleId, e.BrandId }, "IX_BrandExecutionRegistry_CycleId_BrandId");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.BrandId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.CycleId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.RetryCount).HasDefaultValue(0);
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.TaskId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Tier)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");
        });

        modelBuilder.Entity<CalculatorAsins>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Calculat__3214EC0787116018");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.AsinCode)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Category).HasMaxLength(255);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Price).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.StapleLevel).HasMaxLength(50);
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasDefaultValue("pending");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Weight).HasColumnType("decimal(18, 3)");
        });

        modelBuilder.Entity<CallLogs>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__CallLogs__3214EC07DB85F592");

            entity.HasIndex(e => e.CallerId, "IX_CallLogs_CallerId");

            entity.HasIndex(e => e.ConversationId, "IX_CallLogs_ConversationId");

            entity.HasIndex(e => e.CreatedAt, "IX_CallLogs_CreatedAt").IsDescending();

            entity.HasIndex(e => e.ReceiverId, "IX_CallLogs_ReceiverId");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CallerId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ConversationId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.ReceiverId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.Type).HasMaxLength(20);

            entity.HasOne(d => d.Caller).WithMany(p => p.CallLogsCaller)
                .HasForeignKey(d => d.CallerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CallLogs_Caller");

            entity.HasOne(d => d.Conversation).WithMany(p => p.CallLogs)
                .HasForeignKey(d => d.ConversationId)
                .HasConstraintName("FK_CallLogs_Conversation");

            entity.HasOne(d => d.Receiver).WithMany(p => p.CallLogsReceiver)
                .HasForeignKey(d => d.ReceiverId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CallLogs_Receiver");
        });

        modelBuilder.Entity<CategoryMaps>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Category__3214EC0721DB1691");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.FeeCategory).HasMaxLength(255);
            entity.Property(e => e.KeepaCategory).HasMaxLength(255);
        });

        modelBuilder.Entity<ClosingFees>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__ClosingF__3214EC07300CE110");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Category).HasMaxLength(255);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Fee).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.MaxPrice).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.MinPrice).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.SellerType)
                .HasMaxLength(10)
                .HasDefaultValue("FC");
        });

        modelBuilder.Entity<ConversationParticipants>(entity =>
        {
            entity.HasKey(e => new { e.ConversationId, e.UserId }).HasName("PK__Conversa__112854B30818DDD3");

            entity.Property(e => e.ConversationId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.UserId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.JoinedAt).HasDefaultValueSql("(getdate())");

            entity.HasOne(d => d.Conversation).WithMany(p => p.ConversationParticipants)
                .HasForeignKey(d => d.ConversationId)
                .HasConstraintName("FK_ConvParticipants_Conv");

            entity.HasOne(d => d.User).WithMany(p => p.ConversationParticipants)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_ConvParticipants_User");
        });

        modelBuilder.Entity<Conversations>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Conversa__3214EC07E19CF117");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.LastMessageId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Title).HasMaxLength(255);
            entity.Property(e => e.Type)
                .HasMaxLength(20)
                .HasDefaultValue("DIRECT");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");
        });

        modelBuilder.Entity<Downloads>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Download__3214EC074D9197FB");

            entity.HasIndex(e => e.Status, "IX_Downloads_Status");

            entity.HasIndex(e => e.UserId, "IX_Downloads_UserId");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.DownloadCount).HasDefaultValue(0);
            entity.Property(e => e.FileName).HasMaxLength(255);
            entity.Property(e => e.FilePath).HasMaxLength(500);
            entity.Property(e => e.Format)
                .HasMaxLength(10)
                .HasDefaultValue("csv");
            entity.Property(e => e.Progress).HasDefaultValue(0);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("processing");
            entity.Property(e => e.UserId)
                .HasMaxLength(24)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Files>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Files__3214EC07D56EDD96");

            entity.HasIndex(e => e.Folder, "IX_Files_Folder");

            entity.HasIndex(e => new { e.RelatedTo, e.RelatedId }, "IX_Files_Related");

            entity.HasIndex(e => e.Starred, "IX_Files_Starred");

            entity.HasIndex(e => e.Trashed, "IX_Files_Trashed");

            entity.HasIndex(e => e.UploadedBy, "IX_Files_UploadedBy");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.FileName).HasMaxLength(255);
            entity.Property(e => e.Folder).HasMaxLength(255);
            entity.Property(e => e.MimeType).HasMaxLength(100);
            entity.Property(e => e.OriginalName).HasMaxLength(255);
            entity.Property(e => e.RelatedId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.RelatedTo).HasMaxLength(100);
            entity.Property(e => e.Starred).HasDefaultValue(false);
            entity.Property(e => e.StorageProvider)
                .HasMaxLength(50)
                .HasDefaultValue("local");
            entity.Property(e => e.Trashed).HasDefaultValue(false);
            entity.Property(e => e.UploadedBy)
                .HasMaxLength(24)
                .IsUnicode(false);

            entity.HasOne(d => d.UploadedByNavigation).WithMany(p => p.Files)
                .HasForeignKey(d => d.UploadedBy)
                .HasConstraintName("FK_Files_UploadedBy");
        });

        modelBuilder.Entity<GmsDailyPerformance>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__GmsDaily__3214EC07B28A5C4C");

            entity.HasIndex(e => e.Asin, "IX_GmsDailyPerformance_Asin");

            entity.HasIndex(e => new { e.Asin, e.Date }, "IX_GmsDailyPerformance_AsinDate").IsDescending(false, true);

            entity.HasIndex(e => new { e.Asin, e.Date }, "IX_GmsDailyPerformance_Asin_Date");

            entity.HasIndex(e => e.Date, "IX_GmsDailyPerformance_Date").IsDescending();

            entity.HasIndex(e => new { e.Asin, e.Date }, "UC_GmsDailyPerformance_Asin_Date").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Asin)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Brand).HasMaxLength(255);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.CustomerReturns).HasDefaultValue(0);
            entity.Property(e => e.OrderedRevenue)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.OrderedUnits).HasDefaultValue(0);
            entity.Property(e => e.ShippedCOGS)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.ShippedRevenue)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.ShippedUnits).HasDefaultValue(0);
            entity.Property(e => e.StoreCode).HasMaxLength(50);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");
        });

        modelBuilder.Entity<GmsTargetBreakdowns>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__GmsTarge__3214EC075110300A");

            entity.HasIndex(e => e.SpecificDate, "IX_GmsTargetBreakdowns_Date");

            entity.HasIndex(e => new { e.PeriodType, e.PeriodValue }, "IX_GmsTargetBreakdowns_Period");

            entity.HasIndex(e => e.SpecificDate, "IX_GmsTargetBreakdowns_SpecificDate_Covering");

            entity.HasIndex(e => e.TargetId, "IX_GmsTargetBreakdowns_TargetId");

            entity.HasIndex(e => new { e.TargetId, e.PeriodType, e.PeriodValue }, "IX_GmsTargetBreakdowns_TargetId_Period");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.AchievedValue).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.PercentageContribution).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.PeriodType)
                .HasMaxLength(10)
                .IsUnicode(false);
            entity.Property(e => e.TargetId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.TargetValue).HasColumnType("decimal(18, 2)");

            entity.HasOne(d => d.Target).WithMany(p => p.GmsTargetBreakdowns)
                .HasForeignKey(d => d.TargetId)
                .HasConstraintName("FK__GmsTarget__Targe__056ECC6A");
        });

        modelBuilder.Entity<GmsTargets>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__GmsTarge__3214EC07D81D8E0A");

            entity.HasIndex(e => e.CreatedAt, "IX_GmsTargets_CreatedAt_Desc").IsDescending();

            entity.HasIndex(e => e.SellerId, "IX_GmsTargets_SellerId");

            entity.HasIndex(e => e.SellerId, "IX_GmsTargets_SellerId_Enriched");

            entity.HasIndex(e => new { e.SellerId, e.TargetType, e.Year }, "IX_GmsTargets_SellerId_Type_Year");

            entity.HasIndex(e => new { e.TargetType, e.Year }, "IX_GmsTargets_TargetType_Year");

            entity.HasIndex(e => e.TargetType, "IX_GmsTargets_Type");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.BrandManager).HasMaxLength(100);
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.GoalType)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasDefaultValue("GMS");
            entity.Property(e => e.SellerId).HasMaxLength(100);
            entity.Property(e => e.TargetType)
                .HasMaxLength(10)
                .IsUnicode(false);
            entity.Property(e => e.TotalTargetValue).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.UserId)
                .HasMaxLength(24)
                .IsUnicode(false);

            entity.HasOne(d => d.User).WithMany(p => p.GmsTargets)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_GmsTargets_User");
        });

        modelBuilder.Entity<GoalTemplates>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__GoalTemp__3214EC07A686E3D7");

            entity.HasIndex(e => e.OwnerId, "IX_GoalTemplates_OwnerId");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Goals).HasDefaultValue("[]");
            entity.Property(e => e.Name).HasMaxLength(255);
            entity.Property(e => e.OwnerId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");

            entity.HasOne(d => d.Owner).WithMany(p => p.GoalTemplates)
                .HasForeignKey(d => d.OwnerId)
                .HasConstraintName("FK_GoalTemplates_Owner");
        });

        modelBuilder.Entity<Goals>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Goals__3214EC07E7D260E8");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.OwnerId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Progress).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.Status).HasMaxLength(50);
            entity.Property(e => e.Title).HasMaxLength(255);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");

            entity.HasOne(d => d.Owner).WithMany(p => p.Goals)
                .HasForeignKey(d => d.OwnerId)
                .HasConstraintName("FK_Goals_Owner");
        });

        modelBuilder.Entity<KeyResults>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__KeyResul__3214EC074F286A0D");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.AchievementPercent)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.CurrentValue).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.DailyRunRateRequired)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.HealthStatus)
                .HasMaxLength(50)
                .HasDefaultValue("ON_TRACK");
            entity.Property(e => e.MetricType).HasMaxLength(50);
            entity.Property(e => e.ObjectiveId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.OwnerId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Progress).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.ProjectedValue)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.Status).HasMaxLength(50);
            entity.Property(e => e.TargetValue).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Title).HasMaxLength(255);
            entity.Property(e => e.Unit).HasMaxLength(50);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");

            entity.HasOne(d => d.Objective).WithMany(p => p.KeyResults)
                .HasForeignKey(d => d.ObjectiveId)
                .HasConstraintName("FK_KeyResults_Objective");

            entity.HasOne(d => d.Owner).WithMany(p => p.KeyResults)
                .HasForeignKey(d => d.OwnerId)
                .HasConstraintName("FK_KeyResults_Owner");
        });

        modelBuilder.Entity<MessageReactions>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__MessageR__3214EC072B28FBC0");

            entity.HasIndex(e => e.MessageId, "IX_MessageReactions_MessageId");

            entity.HasIndex(e => e.UserId, "IX_MessageReactions_UserId");

            entity.HasIndex(e => new { e.MessageId, e.UserId, e.Emoji }, "UC_Message_User_Emoji").IsUnique();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Emoji).HasMaxLength(20);
            entity.Property(e => e.MessageId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.UserId)
                .HasMaxLength(24)
                .IsUnicode(false);

            entity.HasOne(d => d.Message).WithMany(p => p.MessageReactions)
                .HasForeignKey(d => d.MessageId)
                .HasConstraintName("FK_MessageReactions_Message");

            entity.HasOne(d => d.User).WithMany(p => p.MessageReactions)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_MessageReactions_User");
        });

        modelBuilder.Entity<MessageStatus>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__MessageS__3214EC07B2E4C717");

            entity.HasIndex(e => e.MessageId, "IX_MessageStatus_MessageId");

            entity.HasIndex(e => e.UserId, "IX_MessageStatus_UserId");

            entity.HasIndex(e => new { e.MessageId, e.UserId }, "UC_Message_User").IsUnique();

            entity.Property(e => e.IsRead).HasDefaultValue(true);
            entity.Property(e => e.MessageId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ReadAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.UserId)
                .HasMaxLength(24)
                .IsUnicode(false);

            entity.HasOne(d => d.Message).WithMany(p => p.MessageStatus)
                .HasForeignKey(d => d.MessageId)
                .HasConstraintName("FK_MessageStatus_Message");

            entity.HasOne(d => d.User).WithMany(p => p.MessageStatus)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_MessageStatus_User");
        });

        modelBuilder.Entity<Messages>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Messages__3214EC074CB52458");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ConversationId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.ReplyToId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.SenderId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Type)
                .HasMaxLength(20)
                .HasDefaultValue("TEXT");

            entity.HasOne(d => d.Conversation).WithMany(p => p.Messages)
                .HasForeignKey(d => d.ConversationId)
                .HasConstraintName("FK_Messages_Conv");

            entity.HasOne(d => d.Sender).WithMany(p => p.Messages)
                .HasForeignKey(d => d.SenderId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Messages_Sender");
        });

        modelBuilder.Entity<MonthlyPerformance>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__MonthlyP__3214EC07A663066E");

            entity.HasIndex(e => new { e.Asin, e.Month }, "IX_MonthlyPerformance_Asin_Month");

            entity.HasIndex(e => new { e.Asin, e.Month }, "UC_MonthlyPerformance_Asin_Month").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Asin)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.OrderedRevenue)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.OrderedUnits).HasDefaultValue(0);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");
        });

        modelBuilder.Entity<NodeMaps>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__NodeMaps__3214EC07686B109A");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Category).HasMaxLength(255);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.NodeId).HasMaxLength(100);
        });

        modelBuilder.Entity<Notifications>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Notifica__3214EC078265A8E6");

            entity.HasIndex(e => e.CreatedAt, "IX_Notifications_CreatedAt").IsDescending();

            entity.HasIndex(e => e.IsRead, "IX_Notifications_IsRead");

            entity.HasIndex(e => e.RecipientId, "IX_Notifications_RecipientId");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.IsRead).HasDefaultValue(false);
            entity.Property(e => e.RecipientId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ReferenceId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ReferenceModel).HasMaxLength(100);
            entity.Property(e => e.Type).HasMaxLength(50);

            entity.HasOne(d => d.Recipient).WithMany(p => p.Notifications)
                .HasForeignKey(d => d.RecipientId)
                .HasConstraintName("FK_Notifications_Recipient");
        });

        modelBuilder.Entity<Objectives>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Objectiv__3214EC075EE57CD1");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.AutoGenerateWeekly).HasDefaultValue(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.GoalId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.OwnerId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Progress).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.SellerId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Status).HasMaxLength(50);
            entity.Property(e => e.Title).HasMaxLength(255);
            entity.Property(e => e.Type).HasMaxLength(50);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");

            entity.HasOne(d => d.Goal).WithMany(p => p.Objectives)
                .HasForeignKey(d => d.GoalId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_Objectives_Goal");

            entity.HasOne(d => d.Owner).WithMany(p => p.Objectives)
                .HasForeignKey(d => d.OwnerId)
                .HasConstraintName("FK_Objectives_Owner");
        });

        modelBuilder.Entity<OctoTasks>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__OctoTask__3214EC0743810DB4");

            entity.HasIndex(e => e.TaskId, "UQ__OctoTask__7C6949B0D3BE4419").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.GroupName).HasMaxLength(255);
            entity.Property(e => e.IsAssigned).HasDefaultValue(false);
            entity.Property(e => e.SellerId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.TaskId).HasMaxLength(100);
            entity.Property(e => e.TaskName).HasMaxLength(255);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");

            entity.HasOne(d => d.Seller).WithMany(p => p.OctoTasks)
                .HasForeignKey(d => d.SellerId)
                .HasConstraintName("FK_OctoTasks_Seller");
        });

        modelBuilder.Entity<Orders>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Orders__3214EC07FF85A536");

            entity.HasIndex(e => new { e.Asin, e.Date }, "UC_Order_Asin_Date").IsUnique();

            entity.Property(e => e.Asin)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Currency)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasDefaultValue("INR");
            entity.Property(e => e.Marketplace)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasDefaultValue("amazon.in");
            entity.Property(e => e.Returns).HasDefaultValue(0);
            entity.Property(e => e.Revenue)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Sku)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.Source)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasDefaultValue("sp-api");
            entity.Property(e => e.Units).HasDefaultValue(0);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");
        });

        modelBuilder.Entity<OtpAuditLog>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__OtpAudit__3214EC073DCBB33F");

            entity.Property(e => e.Action).HasMaxLength(50);
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.Email).HasMaxLength(255);
            entity.Property(e => e.IpAddress).HasMaxLength(45);
            entity.Property(e => e.Reason).HasMaxLength(255);
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.UserAgent).HasMaxLength(500);
            entity.Property(e => e.UserId).HasMaxLength(50);
        });

        modelBuilder.Entity<OtpVerifications>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__OtpVerif__3214EC073EA746AC");

            entity.Property(e => e.Attempts).HasDefaultValue(0);
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.Email).HasMaxLength(255);
            entity.Property(e => e.ExpiresAt).HasColumnType("datetime");
            entity.Property(e => e.IpAddress).HasMaxLength(45);
            entity.Property(e => e.IsUsed).HasDefaultValue(false);
            entity.Property(e => e.MaxAttempts).HasDefaultValue(3);
            entity.Property(e => e.OtpHash).HasMaxLength(255);
            entity.Property(e => e.Purpose).HasMaxLength(50);
            entity.Property(e => e.UsedAt).HasColumnType("datetime");
            entity.Property(e => e.UserAgent).HasMaxLength(500);
            entity.Property(e => e.UserId).HasMaxLength(50);
        });

        modelBuilder.Entity<PasswordHistory>(entity =>
        {
            entity.HasIndex(e => new { e.UserId, e.ChangedAt }, "IX_PasswordHistory_UserId").IsDescending(false, true);

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ChangedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.PasswordHash).HasMaxLength(255);
            entity.Property(e => e.UserId)
                .HasMaxLength(24)
                .IsUnicode(false);
        });

        modelBuilder.Entity<PasswordResets>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Password__3214EC078D39615B");

            entity.HasIndex(e => e.Token, "IX_PasswordResets_Token");

            entity.Property(e => e.Id).HasMaxLength(50);
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getutcdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.ExpiresAt).HasColumnType("datetime");
            entity.Property(e => e.Token).HasMaxLength(255);
            entity.Property(e => e.UsedAt).HasColumnType("datetime");
            entity.Property(e => e.UserId).HasMaxLength(50);
        });

        modelBuilder.Entity<PemsActivities>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__PemsActi__3214EC075A5DAA5B");

            entity.HasIndex(e => e.TaskInstanceId, "IX_PemsActivity_Instance");

            entity.HasIndex(e => e.SubTaskId, "IX_PemsActivity_SubTask");

            entity.Property(e => e.Id)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.CompletedBy)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.ExpectedOutput).HasMaxLength(500);
            entity.Property(e => e.IsMandatory).HasDefaultValue(true);
            entity.Property(e => e.StepNo).HasDefaultValue(1);
            entity.Property(e => e.SubTaskId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.TaskInstanceId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Title).HasMaxLength(300);

            entity.HasOne(d => d.SubTask).WithMany(p => p.PemsActivities)
                .HasForeignKey(d => d.SubTaskId)
                .HasConstraintName("FK_PemsActivity_SubTask");

            entity.HasOne(d => d.TaskInstance).WithMany(p => p.PemsActivities)
                .HasForeignKey(d => d.TaskInstanceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_PemsActivity_Instance");
        });

        modelBuilder.Entity<PemsAssignmentRules>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__PemsAssi__3214EC07FA789DD2");

            entity.Property(e => e.Id)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.ApprovalLevel)
                .HasMaxLength(20)
                .HasDefaultValue("single");
            entity.Property(e => e.AssignmentMode)
                .HasMaxLength(20)
                .HasDefaultValue("manual");
            entity.Property(e => e.AutoAssignStrategy)
                .HasMaxLength(30)
                .HasDefaultValue("lowest_workload");
            entity.Property(e => e.BackupReviewerId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.EscalationHours).HasDefaultValue(24);
            entity.Property(e => e.EscalationReviewerId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.ReviewerId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.TemplateId)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.HasOne(d => d.Template).WithMany(p => p.PemsAssignmentRules)
                .HasForeignKey(d => d.TemplateId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_AssignRule_Template");
        });

        modelBuilder.Entity<PemsEscalationRules>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__PemsEsca__3214EC07B3A13190");

            entity.Property(e => e.Id)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Channel)
                .HasMaxLength(20)
                .HasDefaultValue("in_app");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.Name).HasMaxLength(200);
            entity.Property(e => e.NotifyRole)
                .HasMaxLength(50)
                .HasDefaultValue("assignee");
            entity.Property(e => e.TriggerHoursBefore).HasDefaultValue(24);
        });

        modelBuilder.Entity<PemsEvidence>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__PemsEvid__3214EC0785A958CA");

            entity.HasIndex(e => e.TaskInstanceId, "IX_PemsEvidence_Instance");

            entity.Property(e => e.Id)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.ActivityId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.FileName).HasMaxLength(500);
            entity.Property(e => e.FileSize).HasDefaultValue(0L);
            entity.Property(e => e.FileType)
                .HasMaxLength(20)
                .HasDefaultValue("FILE");
            entity.Property(e => e.FileUrl).HasMaxLength(1000);
            entity.Property(e => e.MimeType).HasMaxLength(100);
            entity.Property(e => e.SubTaskId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.TaskInstanceId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.UploadedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.UploadedBy)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.UploadedByName).HasMaxLength(200);

            entity.HasOne(d => d.TaskInstance).WithMany(p => p.PemsEvidence)
                .HasForeignKey(d => d.TaskInstanceId)
                .HasConstraintName("FK_PemsEvidence_Instance");
        });

        modelBuilder.Entity<PemsNotifications>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__PemsNoti__3214EC072FD7BDD6");

            entity.HasIndex(e => new { e.UserId, e.IsRead, e.CreatedAt }, "IX_PemsNotif_User").IsDescending(false, false, true);

            entity.Property(e => e.Id)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.ActionUrl).HasMaxLength(500);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.TaskInstanceId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Title).HasMaxLength(300);
            entity.Property(e => e.Type).HasMaxLength(50);
            entity.Property(e => e.UserId)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.HasOne(d => d.TaskInstance).WithMany(p => p.PemsNotifications)
                .HasForeignKey(d => d.TaskInstanceId)
                .HasConstraintName("FK_PemsNotif_Instance");
        });

        modelBuilder.Entity<PemsScorecards>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__PemsScor__3214EC07A0B05F44");

            entity.HasIndex(e => new { e.EntityType, e.EntityId, e.Period }, "IX_PemsScorecard_Entity");

            entity.Property(e => e.Id)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.AvgAchievementPct)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(7, 2)");
            entity.Property(e => e.AvgQualityScore)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(3, 2)");
            entity.Property(e => e.AvgVariance)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.CompletedTasks).HasDefaultValue(0);
            entity.Property(e => e.CompletionRatePct)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(5, 2)");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.EntityId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.EntityName).HasMaxLength(200);
            entity.Property(e => e.EntityType).HasMaxLength(20);
            entity.Property(e => e.Period).HasMaxLength(20);
            entity.Property(e => e.RejectedTasks).HasDefaultValue(0);
            entity.Property(e => e.SLACompliancePct)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(5, 2)");
            entity.Property(e => e.TotalTasks).HasDefaultValue(0);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
        });

        modelBuilder.Entity<PemsSubTasks>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__PemsSubT__3214EC07F7DCB79F");

            entity.HasIndex(e => e.TaskInstanceId, "IX_PemsSubTask_Instance");

            entity.Property(e => e.Id)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.ExpectedOutput).HasMaxLength(500);
            entity.Property(e => e.IsMandatory).HasDefaultValue(true);
            entity.Property(e => e.OwnerType)
                .HasMaxLength(50)
                .HasDefaultValue("Brand Manager");
            entity.Property(e => e.SortOrder).HasDefaultValue(0);
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValue("PENDING");
            entity.Property(e => e.SubTaskCode)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.TaskInstanceId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Title).HasMaxLength(300);
            entity.Property(e => e.WeightagePct)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(5, 2)");

            entity.HasOne(d => d.TaskInstance).WithMany(p => p.PemsSubTasks)
                .HasForeignKey(d => d.TaskInstanceId)
                .HasConstraintName("FK_PemsSubTask_Instance");
        });

        modelBuilder.Entity<PemsTaskAuditLogs>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__PemsTask__3214EC07D76E8FC8");

            entity.HasIndex(e => e.CreatedAt, "IX_PemsAudit_CreatedAt");

            entity.HasIndex(e => e.TaskInstanceId, "IX_PemsAudit_Instance");

            entity.Property(e => e.Id)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Action).HasMaxLength(50);
            entity.Property(e => e.ActorId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.ActorName).HasMaxLength(200);
            entity.Property(e => e.ActorRole).HasMaxLength(50);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.FromStatus).HasMaxLength(30);
            entity.Property(e => e.TaskInstanceId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.ToStatus).HasMaxLength(30);

            entity.HasOne(d => d.TaskInstance).WithMany(p => p.PemsTaskAuditLogs)
                .HasForeignKey(d => d.TaskInstanceId)
                .HasConstraintName("FK_PemsAudit_Instance");
        });

        modelBuilder.Entity<PemsTaskEvents>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__PemsTask__3214EC078C733255");

            entity.HasIndex(e => e.CreatedAt, "IX_PemsTaskEvents_CreatedAt").IsDescending();

            entity.HasIndex(e => new { e.TaskInstanceId, e.Version }, "IX_PemsTaskEvents_TaskId");

            entity.HasIndex(e => e.EventType, "IX_PemsTaskEvents_Type");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ActorId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ActorName).HasMaxLength(255);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.EventType)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.FromStatus)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.TaskInstanceId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ToStatus)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Version).HasDefaultValue(1);
        });

        modelBuilder.Entity<PemsTaskInstances>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__PemsTask__3214EC07B919547C");

            entity.HasIndex(e => e.AssignedTo, "IX_PemsInstance_AssignedTo");

            entity.HasIndex(e => e.Department, "IX_PemsInstance_Department");

            entity.HasIndex(e => e.DueDate, "IX_PemsInstance_DueDate");

            entity.HasIndex(e => e.ReviewerId, "IX_PemsInstance_Reviewer");

            entity.HasIndex(e => e.SellerId, "IX_PemsInstance_Seller");

            entity.HasIndex(e => e.Status, "IX_PemsInstance_Status");

            entity.HasIndex(e => e.TemplateId, "IX_PemsInstance_Template");

            entity.HasIndex(e => e.InstanceCode, "UQ__PemsTask__5850F4DD20F74A53").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Achievement)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.AchievementPct)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(7, 2)");
            entity.Property(e => e.ActivityCount).HasDefaultValue(0);
            entity.Property(e => e.ApprovalLevel)
                .HasMaxLength(20)
                .HasDefaultValue("single");
            entity.Property(e => e.ApproverCount).HasDefaultValue(0);
            entity.Property(e => e.AssignedTo)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.AssigneeName).HasMaxLength(200);
            entity.Property(e => e.BackupReviewerId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.CompletedSubTasks).HasDefaultValue(0);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.Department)
                .HasMaxLength(50)
                .HasDefaultValue("Operations");
            entity.Property(e => e.Frequency)
                .HasMaxLength(20)
                .HasDefaultValue("ONE_TIME");
            entity.Property(e => e.InstanceCode)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.Priority)
                .HasMaxLength(20)
                .HasDefaultValue("MEDIUM");
            entity.Property(e => e.ProgressPct)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(5, 2)");
            entity.Property(e => e.RequiredApprovals).HasDefaultValue(1);
            entity.Property(e => e.ReviewStatus)
                .HasMaxLength(30)
                .HasDefaultValue("NOT_REVIEWED");
            entity.Property(e => e.ReviewerId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.ReviewerName).HasMaxLength(200);
            entity.Property(e => e.ReworkCount).HasDefaultValue(0);
            entity.Property(e => e.SLAHours).HasDefaultValue(48);
            entity.Property(e => e.SLAStatus)
                .HasMaxLength(20)
                .HasDefaultValue("WITHIN_SLA");
            entity.Property(e => e.SellerId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.SellerName).HasMaxLength(200);
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValue("DRAFT");
            entity.Property(e => e.SubTaskCount).HasDefaultValue(0);
            entity.Property(e => e.Target)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TemplateId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Title).HasMaxLength(500);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.Variance)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.WeightedProgressPct)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(5, 2)");

            entity.HasOne(d => d.Template).WithMany(p => p.PemsTaskInstances)
                .HasForeignKey(d => d.TemplateId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_PemsInstance_Template");
        });

        modelBuilder.Entity<PemsTaskReviews>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__PemsTask__3214EC079D51712A");

            entity.HasIndex(e => e.TaskInstanceId, "IX_PemsReview_Instance");

            entity.Property(e => e.Id)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.Decision).HasMaxLength(20);
            entity.Property(e => e.ReviewerId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.ReviewerName).HasMaxLength(200);
            entity.Property(e => e.TaskInstanceId)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.HasOne(d => d.TaskInstance).WithMany(p => p.PemsTaskReviews)
                .HasForeignKey(d => d.TaskInstanceId)
                .HasConstraintName("FK_PemsReview_Instance");
        });

        modelBuilder.Entity<PemsTaskTemplates>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__PemsTask__3214EC07120C182A");

            entity.HasIndex(e => e.TaskCode, "UQ__PemsTask__251D0699DC7469D1").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.AssigneeRole)
                .HasMaxLength(50)
                .HasDefaultValue("brand_manager");
            entity.Property(e => e.Category)
                .HasMaxLength(50)
                .HasDefaultValue("GENERAL");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.CriticalityScore).HasDefaultValue(5);
            entity.Property(e => e.CustomCron).HasMaxLength(100);
            entity.Property(e => e.DefaultTarget)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Department)
                .HasMaxLength(50)
                .HasDefaultValue("OPERATIONS");
            entity.Property(e => e.EscalationHours).HasDefaultValue(24);
            entity.Property(e => e.EstimatedExecutionMinutes).HasDefaultValue(60);
            entity.Property(e => e.ExecutionComplexity)
                .HasMaxLength(20)
                .HasDefaultValue("MEDIUM");
            entity.Property(e => e.ExpectedOutput).HasMaxLength(500);
            entity.Property(e => e.Frequency)
                .HasMaxLength(20)
                .HasDefaultValue("ONE_TIME");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.Name).HasMaxLength(200);
            entity.Property(e => e.Priority)
                .HasMaxLength(20)
                .HasDefaultValue("MEDIUM");
            entity.Property(e => e.ReviewRequired).HasDefaultValue(true);
            entity.Property(e => e.ReviewerId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.SLAHours).HasDefaultValue(48);
            entity.Property(e => e.TATHours).HasDefaultValue(24);
            entity.Property(e => e.TargetType)
                .HasMaxLength(20)
                .HasDefaultValue("NUMERIC");
            entity.Property(e => e.TaskCode)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.TemplateOwnerId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.TemplateVersion).HasDefaultValue(1);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
        });

        modelBuilder.Entity<Permissions>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Permissi__3214EC0719FE7E46");

            entity.HasIndex(e => e.Name, "UQ__Permissi__737584F68A2BABE0").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Action).HasMaxLength(100);
            entity.Property(e => e.Category).HasMaxLength(100);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.DisplayName).HasMaxLength(255);
            entity.Property(e => e.Name).HasMaxLength(100);
        });

        modelBuilder.Entity<PredefinedTags>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Predefin__3214EC07014B7D42");

            entity.HasIndex(e => e.Category, "IX_PredefinedTags_Category");

            entity.HasIndex(e => e.Name, "UQ__Predefin__737584F61CEA3C04").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Category)
                .HasMaxLength(50)
                .HasDefaultValue("General");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Name).HasMaxLength(80);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");
        });

        modelBuilder.Entity<ReferralFees>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Referral__3214EC07794EB59E");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Category).HasMaxLength(255);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
        });

        modelBuilder.Entity<RefundFees>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__RefundFe__3214EC079677E585");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Advanced).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Basic).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Category).HasMaxLength(255);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.MaxPrice).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.MinPrice).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Premium).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Standard).HasColumnType("decimal(18, 2)");
        });

        modelBuilder.Entity<RevenueCalculators>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__RevenueC__3214EC070F6EC82A");

            entity.HasIndex(e => e.AsinId, "IX_RevenueCalculators_AsinId");

            entity.HasIndex(e => e.SellerId, "IX_RevenueCalculators_SellerId");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.AsinId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CalculatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.ClosingFee)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.FbaFee)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.Margin)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.Name).HasMaxLength(255);
            entity.Property(e => e.NetRevenue)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.ReferralFee)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.SellerId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ShippingFee)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.StorageFee)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.Tax)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");
            entity.Property(e => e.TotalFees)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 4)");

            entity.HasOne(d => d.Asin).WithMany(p => p.RevenueCalculators)
                .HasForeignKey(d => d.AsinId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_RevenueCalculators_Asin");

            entity.HasOne(d => d.Seller).WithMany(p => p.RevenueCalculators)
                .HasForeignKey(d => d.SellerId)
                .HasConstraintName("FK_RevenueCalculators_Seller");
        });

        modelBuilder.Entity<Roles>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Roles__3214EC072535B5AB");

            entity.HasIndex(e => e.Name, "UQ__Roles__737584F63318B529").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Color)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("#4F46E5");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.DisplayName).HasMaxLength(255);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.IsSystem).HasDefaultValue(false);
            entity.Property(e => e.Level).HasDefaultValue(0);
            entity.Property(e => e.Name).HasMaxLength(100);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");

            entity.HasMany(d => d.Permission).WithMany(p => p.Role)
                .UsingEntity<Dictionary<string, object>>(
                    "RolePermissions",
                    r => r.HasOne<Permissions>().WithMany()
                        .HasForeignKey("PermissionId")
                        .HasConstraintName("FK_RolePermissions_Permission"),
                    l => l.HasOne<Roles>().WithMany()
                        .HasForeignKey("RoleId")
                        .HasConstraintName("FK_RolePermissions_Role"),
                    j =>
                    {
                        j.HasKey("RoleId", "PermissionId").HasName("PK__RolePerm__6400A1A86EFB6A5B");
                        j.HasIndex(new[] { "PermissionId" }, "IX_RolePermissions_Permission");
                        j.HasIndex(new[] { "RoleId" }, "IX_RolePermissions_Role");
                        j.IndexerProperty<string>("RoleId")
                            .HasMaxLength(24)
                            .IsUnicode(false);
                        j.IndexerProperty<string>("PermissionId")
                            .HasMaxLength(24)
                            .IsUnicode(false);
                    });
        });

        modelBuilder.Entity<RulesetExecutionLogs>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__RulesetE__3214EC07A374E43C");

            entity.HasIndex(e => e.ExecutedAt, "IX_RulesetExecutionLogs_ExecutedAt").IsDescending();

            entity.HasIndex(e => e.RulesetId, "IX_RulesetExecutionLogs_RulesetId");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ActionedCount).HasDefaultValue(0);
            entity.Property(e => e.ExecutedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.MatchedCount).HasDefaultValue(0);
            entity.Property(e => e.RulesetId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Status).HasMaxLength(50);
            entity.Property(e => e.TriggeredBy).HasMaxLength(100);

            entity.HasOne(d => d.Ruleset).WithMany(p => p.RulesetExecutionLogs)
                .HasForeignKey(d => d.RulesetId)
                .HasConstraintName("FK_RulesetExecutionLogs_Ruleset");
        });

        modelBuilder.Entity<Rulesets>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Rulesets__3214EC0755292951");

            entity.HasIndex(e => e.CreatedBy, "IX_Rulesets_CreatedBy");

            entity.HasIndex(e => e.IsActive, "IX_Rulesets_IsActive");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.ConflictResolution)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasDefaultValue("first");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.EmailAddress).HasMaxLength(255);
            entity.Property(e => e.EmailOnAction).HasDefaultValue(false);
            entity.Property(e => e.EmailOnRun).HasDefaultValue(false);
            entity.Property(e => e.ExcludeDays)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasDefaultValue("Latest day");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.IsAutomated).HasDefaultValue(false);
            entity.Property(e => e.Name).HasMaxLength(255);
            entity.Property(e => e.RunFrequency)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasDefaultValue("Daily");
            entity.Property(e => e.RunTime)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasDefaultValue("08 AM");
            entity.Property(e => e.SellerId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.TotalRunCount).HasDefaultValue(0);
            entity.Property(e => e.Type)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasDefaultValue("ASIN");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.UsingDataFrom)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasDefaultValue("Last 14 days");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Rulesets)
                .HasForeignKey(d => d.CreatedBy)
                .HasConstraintName("FK_Rulesets_CreatedBy");
        });

        modelBuilder.Entity<ScheduledRuns>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Schedule__3214EC07C11D8FC5");

            entity.Property(e => e.Id)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");
        });

        modelBuilder.Entity<Sellers>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Sellers__3214EC07EDB0EF2A");

            entity.HasIndex(e => new { e.Id, e.IsActive }, "IX_Sellers_Id_IsActive");

            entity.HasIndex(e => e.IsActive, "IX_Sellers_IsActive");

            entity.HasIndex(e => e.KeepaSellerId, "IX_Sellers_KeepaSellerId");

            entity.HasIndex(e => e.Marketplace, "IX_Sellers_Marketplace");

            entity.HasIndex(e => e.Plan, "IX_Sellers_Plan");

            entity.HasIndex(e => e.SellerId, "IX_Sellers_SellerId");

            entity.HasIndex(e => e.Name, "UQ__Sellers__737584F6367CCC2C").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CometChatUid).HasMaxLength(100);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Email)
                .HasMaxLength(200)
                .HasDefaultValue("");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.IsPriority).HasDefaultValue(false);
            entity.Property(e => e.KeepaAsinCount).HasDefaultValue(0);
            entity.Property(e => e.KeepaSellerId).HasMaxLength(100);
            entity.Property(e => e.LastLiveSyncAt).HasColumnType("datetime");
            entity.Property(e => e.LiveSyncClientId).HasMaxLength(255);
            entity.Property(e => e.LiveSyncClientSecret).HasMaxLength(500);
            entity.Property(e => e.LiveSyncEnabled).HasDefaultValue(false);
            entity.Property(e => e.Marketplace).HasMaxLength(100);
            entity.Property(e => e.Name).HasMaxLength(255);
            entity.Property(e => e.OctoparseId).HasMaxLength(100);
            entity.Property(e => e.PartnerTag).HasMaxLength(100);
            entity.Property(e => e.Plan)
                .HasMaxLength(50)
                .HasDefaultValue("Starter");
            entity.Property(e => e.ScrapeLimit).HasDefaultValue(100);
            entity.Property(e => e.ScrapeUsed).HasDefaultValue(0);
            entity.Property(e => e.SellerId).HasMaxLength(100);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");
        });

        modelBuilder.Entity<SetupWizardProgress>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__SetupWiz__3214EC075D75BC10");

            entity.Property(e => e.CompletedAt).HasColumnType("datetime");
            entity.Property(e => e.StartedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.StepName).HasMaxLength(50);
            entity.Property(e => e.UserId).HasMaxLength(50);
        });

        modelBuilder.Entity<ShippingFees>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Shipping__3214EC07122FB9F7");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Fee).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.IncrementalFee).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.IncrementalStep).HasColumnType("decimal(18, 3)");
            entity.Property(e => e.PickAndPackFee).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.SizeType).HasMaxLength(50);
            entity.Property(e => e.UseIncremental).HasDefaultValue(false);
            entity.Property(e => e.WeightMax).HasColumnType("decimal(18, 3)");
            entity.Property(e => e.WeightMin).HasColumnType("decimal(18, 3)");
        });

        modelBuilder.Entity<StorageFees>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__StorageF__3214EC071438C59B");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Month).HasMaxLength(20);
            entity.Property(e => e.Rate).HasColumnType("decimal(18, 2)");
        });

        modelBuilder.Entity<SubBsrHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__SubBsrHi__3214EC0755561C8A");

            entity.HasIndex(e => new { e.AsinId, e.Date }, "IX_SubBsrHistory_AsinId_Date");

            entity.Property(e => e.AsinId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");

            entity.HasOne(d => d.Asin).WithMany(p => p.SubBsrHistory)
                .HasForeignKey(d => d.AsinId)
                .HasConstraintName("FK_SubBsrHistory_Asins");
        });

        modelBuilder.Entity<SystemLogs>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__SystemLo__3214EC07E6671D72");

            entity.HasIndex(e => e.CreatedAt, "IX_SystemLogs_CreatedAt").IsDescending();

            entity.HasIndex(e => e.UserId, "IX_SystemLogs_UserId");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.EntityId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.EntityTitle).HasMaxLength(255);
            entity.Property(e => e.EntityType).HasMaxLength(100);
            entity.Property(e => e.Severity)
                .HasMaxLength(20)
                .HasDefaultValue("INFO");
            entity.Property(e => e.Type).HasMaxLength(50);
            entity.Property(e => e.UserId)
                .HasMaxLength(24)
                .IsUnicode(false);

            entity.HasOne(d => d.User).WithMany(p => p.SystemLogs)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_SystemLogs_User");
        });

        modelBuilder.Entity<SystemSettings>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__SystemSe__3214EC075BAB927E");

            entity.HasIndex(e => e.Key, "IX_SystemSettings_Key");

            entity.HasIndex(e => e.Key, "UQ__SystemSe__C41E02898FA18CD0").IsUnique();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.Key).HasMaxLength(100);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");
        });

        modelBuilder.Entity<TagsHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__TagsHist__3214EC07EFCA8623");

            entity.HasIndex(e => new { e.AsinId, e.CreatedAt }, "IX_TagsHistory_AsinId").IsDescending(false, true);

            entity.HasIndex(e => e.CreatedAt, "IX_TagsHistory_CreatedAt").IsDescending();

            entity.HasIndex(e => e.UserId, "IX_TagsHistory_UserId");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Action)
                .HasMaxLength(20)
                .HasDefaultValue("update");
            entity.Property(e => e.AsinId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Notes).HasMaxLength(500);
            entity.Property(e => e.Source).HasMaxLength(50);
            entity.Property(e => e.UserId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.UserName).HasMaxLength(255);

            entity.HasOne(d => d.Asin).WithMany(p => p.TagsHistory)
                .HasForeignKey(d => d.AsinId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_TagsHistory_Asin");
        });

        modelBuilder.Entity<TaskTemplates>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__TaskTemp__3214EC07B3A748D8");

            entity.HasIndex(e => e.Category, "IX_TaskTemplates_Category");

            entity.HasIndex(e => e.IsActive, "IX_TaskTemplates_IsActive");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Category)
                .HasMaxLength(100)
                .HasDefaultValue("GENERAL");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.Priority)
                .HasMaxLength(50)
                .HasDefaultValue("MEDIUM");
            entity.Property(e => e.TimeLimit).HasDefaultValue(60);
            entity.Property(e => e.Title).HasMaxLength(255);
            entity.Property(e => e.Type).HasMaxLength(100);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");
        });

        modelBuilder.Entity<Tasks>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Tasks__3214EC073942C128");

            entity.Property(e => e.Id)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.AsinCode).HasMaxLength(255);
            entity.Property(e => e.AsinId)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.AssignedTo)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.Category).HasMaxLength(100);
            entity.Property(e => e.CompletedAt).HasColumnType("datetime");
            entity.Property(e => e.CompletedBy)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.EffortEstimate).HasMaxLength(100);
            entity.Property(e => e.IsAIGenerated).HasDefaultValue(false);
            entity.Property(e => e.Priority).HasMaxLength(50);
            entity.Property(e => e.SellerId)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.SellerName).HasMaxLength(255);
            entity.Property(e => e.SourceRule).HasMaxLength(255);
            entity.Property(e => e.StartTime).HasColumnType("datetime");
            entity.Property(e => e.Status).HasMaxLength(50);
            entity.Property(e => e.Title).HasMaxLength(255);
            entity.Property(e => e.Type).HasMaxLength(100);
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
        });

        modelBuilder.Entity<TeamMembers>(entity =>
        {
            entity.HasKey(e => new { e.TeamId, e.UserId }).HasName("PK__TeamMemb__C3426B5D6EE2F000");

            entity.HasIndex(e => e.UserId, "IX_TeamMembers_User");

            entity.Property(e => e.TeamId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.UserId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Role)
                .HasMaxLength(50)
                .HasDefaultValue("member");

            entity.HasOne(d => d.Team).WithMany(p => p.TeamMembers)
                .HasForeignKey(d => d.TeamId)
                .HasConstraintName("FK_TeamMembers_Team");

            entity.HasOne(d => d.User).WithMany(p => p.TeamMembers)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_TeamMembers_User");
        });

        modelBuilder.Entity<Teams>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Teams__3214EC07C43699B1");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.ManagerId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Name).HasMaxLength(255);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");

            entity.HasOne(d => d.Manager).WithMany(p => p.Teams)
                .HasForeignKey(d => d.ManagerId)
                .HasConstraintName("FK_Teams_Manager");
        });

        modelBuilder.Entity<TrustedDevices>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__TrustedD__3214EC0702893C54");

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.DeviceFingerprint).HasMaxLength(255);
            entity.Property(e => e.DeviceName).HasMaxLength(100);
            entity.Property(e => e.ExpiresAt).HasColumnType("datetime");
            entity.Property(e => e.IpAddress).HasMaxLength(45);
            entity.Property(e => e.IsRevoked).HasDefaultValue(false);
            entity.Property(e => e.LastUsedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.UserId).HasMaxLength(50);
        });

        modelBuilder.Entity<Users>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Users__3214EC07E34E7E07");

            entity.HasIndex(e => e.CurrentTeam, "IX_Users_CurrentTeam");

            entity.HasIndex(e => e.Email, "IX_Users_Email").IsUnique();

            entity.HasIndex(e => new { e.FirstName, e.LastName }, "IX_Users_FullName");

            entity.HasIndex(e => e.IsActive, "IX_Users_IsActive");

            entity.HasIndex(e => e.RoleId, "IX_Users_RoleId");

            entity.HasIndex(e => e.Email, "UQ__Users__A9D1053414472069").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CometChatUid).HasMaxLength(100);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.CurrentTeam)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Email).HasMaxLength(255);
            entity.Property(e => e.FirstLoginAt).HasColumnType("datetime");
            entity.Property(e => e.FirstName).HasMaxLength(100);
            entity.Property(e => e.ForcePasswordReset).HasDefaultValue(false);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.IsEmailVerified).HasDefaultValue(false);
            entity.Property(e => e.IsFirstLogin).HasDefaultValue(true);
            entity.Property(e => e.IsOnline).HasDefaultValue(false);
            entity.Property(e => e.LastName).HasMaxLength(100);
            entity.Property(e => e.LastOtpSentAt).HasColumnType("datetime");
            entity.Property(e => e.LoginAttempts).HasDefaultValue(0);
            entity.Property(e => e.OtpResetDate).HasDefaultValueSql("(CONVERT([date],getdate()))");
            entity.Property(e => e.OtpSentCountToday).HasDefaultValue(0);
            entity.Property(e => e.Password).HasMaxLength(255);
            entity.Property(e => e.PasswordChangedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.Phone).HasMaxLength(20);
            entity.Property(e => e.RoleId)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.SecurityPolicyAccepted).HasDefaultValue(false);
            entity.Property(e => e.SetupCompletedAt).HasColumnType("datetime");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getdate())");

            entity.HasOne(d => d.Role).WithMany(p => p.Users)
                .HasForeignKey(d => d.RoleId)
                .HasConstraintName("FK_Users_Role");

            entity.HasMany(d => d.BrandManager).WithMany(p => p.User)
                .UsingEntity<Dictionary<string, object>>(
                    "UserBrandManagers",
                    r => r.HasOne<Users>().WithMany()
                        .HasForeignKey("BrandManagerId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("FK_UserBrandManagers_BrandManager"),
                    l => l.HasOne<Users>().WithMany()
                        .HasForeignKey("UserId")
                        .HasConstraintName("FK_UserBrandManagers_User"),
                    j =>
                    {
                        j.HasKey("UserId", "BrandManagerId").HasName("PK__UserBran__A85CD43A29449898");
                        j.IndexerProperty<string>("UserId")
                            .HasMaxLength(24)
                            .IsUnicode(false);
                        j.IndexerProperty<string>("BrandManagerId")
                            .HasMaxLength(24)
                            .IsUnicode(false);
                    });

            entity.HasMany(d => d.Seller).WithMany(p => p.User)
                .UsingEntity<Dictionary<string, object>>(
                    "UserSellers",
                    r => r.HasOne<Sellers>().WithMany()
                        .HasForeignKey("SellerId")
                        .HasConstraintName("FK_UserSellers_Seller"),
                    l => l.HasOne<Users>().WithMany()
                        .HasForeignKey("UserId")
                        .HasConstraintName("FK_UserSellers_User"),
                    j =>
                    {
                        j.HasKey("UserId", "SellerId").HasName("PK__UserSell__1076F1F477182272");
                        j.HasIndex(new[] { "SellerId" }, "IX_UserSellers_SellerId");
                        j.HasIndex(new[] { "UserId" }, "IX_UserSellers_UserId");
                        j.IndexerProperty<string>("UserId")
                            .HasMaxLength(24)
                            .IsUnicode(false);
                        j.IndexerProperty<string>("SellerId")
                            .HasMaxLength(24)
                            .IsUnicode(false);
                    });

            entity.HasMany(d => d.Supervisor).WithMany(p => p.UserNavigation)
                .UsingEntity<Dictionary<string, object>>(
                    "UserSupervisors",
                    r => r.HasOne<Users>().WithMany()
                        .HasForeignKey("SupervisorId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("FK_UserSupervisors_Supervisor"),
                    l => l.HasOne<Users>().WithMany()
                        .HasForeignKey("UserId")
                        .HasConstraintName("FK_UserSupervisors_User"),
                    j =>
                    {
                        j.HasKey("UserId", "SupervisorId").HasName("PK__UserSupe__F17267905CA1DE7A");
                        j.HasIndex(new[] { "SupervisorId" }, "IX_UserSupervisors_Supervisor");
                        j.HasIndex(new[] { "UserId" }, "IX_UserSupervisors_User");
                        j.IndexerProperty<string>("UserId")
                            .HasMaxLength(24)
                            .IsUnicode(false);
                        j.IndexerProperty<string>("SupervisorId")
                            .HasMaxLength(24)
                            .IsUnicode(false);
                    });

            entity.HasMany(d => d.User).WithMany(p => p.BrandManager)
                .UsingEntity<Dictionary<string, object>>(
                    "UserBrandManagers",
                    r => r.HasOne<Users>().WithMany()
                        .HasForeignKey("UserId")
                        .HasConstraintName("FK_UserBrandManagers_User"),
                    l => l.HasOne<Users>().WithMany()
                        .HasForeignKey("BrandManagerId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("FK_UserBrandManagers_BrandManager"),
                    j =>
                    {
                        j.HasKey("UserId", "BrandManagerId").HasName("PK__UserBran__A85CD43A29449898");
                        j.IndexerProperty<string>("UserId")
                            .HasMaxLength(24)
                            .IsUnicode(false);
                        j.IndexerProperty<string>("BrandManagerId")
                            .HasMaxLength(24)
                            .IsUnicode(false);
                    });

            entity.HasMany(d => d.UserNavigation).WithMany(p => p.Supervisor)
                .UsingEntity<Dictionary<string, object>>(
                    "UserSupervisors",
                    r => r.HasOne<Users>().WithMany()
                        .HasForeignKey("UserId")
                        .HasConstraintName("FK_UserSupervisors_User"),
                    l => l.HasOne<Users>().WithMany()
                        .HasForeignKey("SupervisorId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("FK_UserSupervisors_Supervisor"),
                    j =>
                    {
                        j.HasKey("UserId", "SupervisorId").HasName("PK__UserSupe__F17267905CA1DE7A");
                        j.HasIndex(new[] { "SupervisorId" }, "IX_UserSupervisors_Supervisor");
                        j.HasIndex(new[] { "UserId" }, "IX_UserSupervisors_User");
                        j.IndexerProperty<string>("UserId")
                            .HasMaxLength(24)
                            .IsUnicode(false);
                        j.IndexerProperty<string>("SupervisorId")
                            .HasMaxLength(24)
                            .IsUnicode(false);
                    });
        });

        modelBuilder.Entity<WebhookLogs>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__WebhookL__3214EC0788A8F776");

            entity.HasIndex(e => e.CreatedAt, "IX_WebhookLogs_CreatedAt");

            entity.HasIndex(e => e.WebhookId, "IX_WebhookLogs_WebhookId");

            entity.Property(e => e.Id)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Attempt).HasDefaultValue(1);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.Event).HasMaxLength(100);
            entity.Property(e => e.Success).HasDefaultValue(false);
            entity.Property(e => e.WebhookId)
                .HasMaxLength(24)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Webhooks>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Webhooks__3214EC0729194E35");

            entity.HasIndex(e => e.IsActive, "IX_Webhooks_IsActive");

            entity.Property(e => e.Id)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(24)
                .IsUnicode(false);
            entity.Property(e => e.Events).HasDefaultValue("[\"*\"]");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.Name).HasMaxLength(255);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("([dbo].[GetEnvDate]())");
            entity.Property(e => e.Url).HasMaxLength(1000);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
