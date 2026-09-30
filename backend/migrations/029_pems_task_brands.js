/**
 * Migration 029: Multi-brand daily routines.
 *
 * One person usually looks after several brands (sellers). A routine such as "OOS monitoring" is done for every one
 * of them, but creating a task per brand would bury people (8 brands × 10 routines = 80 tasks a day). Instead the
 * routine stays ONE task per person and carries a brand checklist:
 *
 *   PemsTaskTemplates.BrandMode   'NONE' | 'CHECKLIST'
 *   PemsTaskBrands                one row per brand on a task instance, ticked off as it is covered
 */
module.exports = {
  up: async (pool) => {
    const q = (s) => pool.request().query(s);

    await q(`IF COL_LENGTH('dbo.PemsTaskTemplates','BrandMode') IS NULL
               ALTER TABLE dbo.PemsTaskTemplates ADD BrandMode VARCHAR(12) NOT NULL CONSTRAINT DF_PemsTpl_BrandMode DEFAULT 'NONE';`);

    await q(`IF OBJECT_ID(N'dbo.PemsTaskBrands', N'U') IS NULL
             BEGIN
               CREATE TABLE dbo.PemsTaskBrands (
                 Id VARCHAR(50) NOT NULL PRIMARY KEY,
                 TaskInstanceId VARCHAR(50) NOT NULL,
                 SellerId VARCHAR(50) NOT NULL,
                 SellerName NVARCHAR(200) NOT NULL DEFAULT '',
                 SortOrder INT NOT NULL DEFAULT 0,
                 IsCompleted BIT NOT NULL DEFAULT 0,
                 CompletedAt DATETIME2 NULL,
                 CompletedBy VARCHAR(50) NULL,
                 Note NVARCHAR(500) NULL,
                 CONSTRAINT FK_PemsTaskBrands_Instance FOREIGN KEY (TaskInstanceId) REFERENCES dbo.PemsTaskInstances(Id) ON DELETE CASCADE
               );
               CREATE UNIQUE INDEX UX_PemsTaskBrands_TaskSeller ON dbo.PemsTaskBrands(TaskInstanceId, SellerId);
             END`);

    console.log('[Migration 029] ✅ BrandMode + PemsTaskBrands');
  },
};
