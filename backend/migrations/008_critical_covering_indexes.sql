-- Critical Covering Indexes for RetailOps Performance
-- Run this on production SQL Server to fix N+1 query performance
-- Created: 2026-09-03

-- ============================================================
-- 1. ASINS - Seller Dashboard Queries (Most Critical)
-- Covers: getAsins, getSellers enrichment, dashboard queries
-- ============================================================
CREATE INDEX IX_Asins_Seller_Status_Synced_Covering 
ON Asins(SellerId, Status, LastScrapedAt DESC) 
INCLUDE (AsinCode, Title, Price, Bsr, LqsScore, LqsGrade, ImagesCount, MainImageUrl, Category, Brand, Rating, ReviewCount, StockLevel, SoldBy, CurrentPrice, Mrp, SubBsr, SubBSRCategory, LQSGrade, TitleScore, BulletScore, ImageScore, DescriptionScore, LQSDetails, TitleIssues, BulletIssues, ImageIssues, DescriptionIssues);

-- For ASIN list with seller join (dashboard top ASINs)
CREATE INDEX IX_Asins_Seller_Active_Covering
ON Asins(SellerId, Status, CreatedAt DESC)
INCLUDE (AsinCode, Title, Price, Bsr, LqsScore, LqsGrade, Category, Sku, ImageUrl);

-- ============================================================
-- 2. SCHEDULED RUNS - Pipeline Monitoring
-- ============================================================
CREATE INDEX IX_ScheduledRunDetails_Run_Seller_Covering
ON ScheduledRunDetails(RunId, SellerId)
INCLUDE (Status, AsinsCount, ProcessedCount, ErrorMessage, StartTime, EndTime);

-- ============================================================
-- 3. PEMS TASKS - Task Management Queries
-- ============================================================
CREATE INDEX IX_PemsTaskInstances_Assignee_Due_Status_Covering
ON PemsTaskInstances(AssigneeId, DueDate, Status)
INCLUDE (TemplateId, Title, Priority, SlaHours, IsEscalated, ReviewerId, CreatedAt);

CREATE INDEX IX_PemsTaskInstances_Reviewer_Status_Covering
ON PemsTaskInstances(ReviewerId, Status)
INCLUDE (AssigneeId, Title, DueDate, Priority, SlaHours, IsEscalated, CreatedAt);

CREATE INDEX IX_PemsTaskInstances_Template_Status_Covering
ON PemsTaskInstances(TemplateId, Status)
INCLUDE (AssigneeId, ReviewerId, DueDate, Priority, SlaHours, IsEscalated, CreatedAt);

-- ============================================================
-- 4. ASIN HISTORY - Trend Queries (Partitioned by Month)
-- ============================================================
CREATE INDEX IX_AsinHistory_AsinId_Date_Covering
ON AsinHistory(AsinId, Date DESC)
INCLUDE (Price, BSR, Rating, ReviewCount, StockLevel, LQS);

-- ============================================================
-- 5. ASIN WEEK HISTORY - Weekly Trends
-- ============================================================
CREATE INDEX IX_AsinWeekHistory_AsinId_Week_Covering
ON AsinWeekHistory(AsinId, WeekStartDate DESC)
INCLUDE (AvgPrice, AvgBSR, AvgRating, TotalReviews, AvgLQS);

-- ============================================================
-- 6. ADS PERFORMANCE - Dashboard Ad Queries
-- ============================================================
CREATE INDEX IX_AdsPerformance_Asin_Date_Covering
ON AdsPerformance(Asin, Date DESC)
INCLUDE (AdSales, AdSpend, Orders, OrganicSales, Impressions, Clicks, ReportType);

-- ============================================================
-- 6. GMS DAILY PERFORMANCE - Revenue/Order Queries
-- ============================================================
CREATE INDEX IX_GmsDailyPerformance_Asin_Date_Covering
ON GmsDailyPerformance(Asin, Date DESC)
INCLUDE (OrderedUnits, OrderedRevenue, OrderedRevenue);

-- ============================================================
-- 7. SELLERS - Dashboard Seller Queries
-- ============================================================
CREATE INDEX IX_Sellers_Marketplace_Active_Covering
ON Sellers(Marketplace, IsActive)
INCLUDE (Name, Email, OctoparseId, SellerId, LastScrapedAt, CreatedAt);

-- ============================================================
-- 8. ACTIONS - PEMS Task Actions
-- ============================================================
CREATE INDEX IX_Actions_AssignedTo_Status_Covering
ON Actions(AssignedTo, Status)
INCLUDE (Title, Description, DueDate, Priority, SellerId, CreatedAt);

-- ============================================================
-- 9. ALERTS - Dashboard Alert Queries
-- ============================================================
CREATE INDEX IX_Alerts_SellerId_CreatedAt_Covering
ON Alerts(SellerId, CreatedAt DESC)
INCLUDE (Severity, Message);

-- ============================================================
-- 10. WEBHOOK LOGS - Debugging
-- ============================================================
CREATE INDEX IX_WebhookLogs_WebhookId_CreatedAt
ON WebhookLogs(WebhookId, CreatedAt DESC);

-- ============================================================
-- 11. ASIN TABLE - Category Distribution Queries
-- ============================================================
CREATE INDEX IX_Asins_Category_Seller_Covering
ON Asins(Category, SellerId)
INCLUDE (AsinCode, Title, Price, BSR, LQS, Status, Category, ImagesCount);

-- ============================================================
-- VERIFICATION QUERIES (Run after creating indexes)
-- ============================================================
-- Check index usage:
-- SELECT 
--     OBJECT_NAME(i.object_id) as TableName,
--     i.name as IndexName,
--     i.type_desc,
--     ds.user_seeks,
--     ds.user_scans,
--     ds.user_lookups,
--     ds.last_user_seek,
--     ds.last_user_scan
-- FROM sys.dm_db_index_usage_stats ds
-- JOIN sys.indexes i ON ds.object_id = i.object_id AND ds.index_id = i.index_id
-- WHERE ds.database_id = DB_ID()
-- AND i.name LIKE 'IX_%Covering%'
-- ORDER BY ds.user_seeks DESC;

PRINT 'Critical covering indexes created successfully!';