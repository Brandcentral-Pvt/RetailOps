'use strict';
const {buildInClause}=require('../utils/sqlHelpers');
const STATUS_SQL="CASE WHEN UPPER(Status) IN ('APPROVED','COMPLETED') THEN 'COMPLETED' WHEN UPPER(Status) IN ('CANCELLED') THEN 'CANCELLED' WHEN UPPER(Status) IN ('ASSIGNED','PENDING') THEN 'PENDING' WHEN UPPER(Status) IN ('DRAFT','TODO') THEN 'TODO' WHEN UPPER(Status) IN ('ACCEPTED','IN_PROGRESS','REWORK','REJECTED') THEN 'IN_PROGRESS' WHEN UPPER(Status) IN ('SUBMITTED','RESUBMITTED','UNDER_REVIEW','REVIEW','IN_REVIEW','ESCALATED') THEN 'IN_REVIEW' ELSE 'OTHER' END";
const emptyTaskSummary=()=>({total:0,overdue:0,slaBreached:0,slaAtRisk:0,counts:{},source:'PemsTaskInstances',sampleLimitPerStatus:5,asOf:new Date().toISOString()});
async function readTaskSnapshot({pool,sql,scope}){
 if(scope.empty)return {instances:[],summary:emptyTaskSummary()};
 const request=pool.request();
 const scopeSql=scope.unrestricted?'':' AND SellerId IN ('+buildInClause(request,'taskSeller',scope.sellerIds)+')';
 request.input('asOf',sql.DateTime2,new Date());
 const r=await request.query(`
 SET NOCOUNT ON;
 SELECT Id,Title,Status,Priority,SellerId,SellerName,AssignedTo,DueDate,CreatedAt,SLAStatus,
 ${STATUS_SQL} AS DashboardStatus INTO #DashboardTasks
 FROM dbo.PemsTaskInstances WHERE 1=1 ${scopeSql};
 SELECT DashboardStatus,COUNT_BIG(*) AS Total,
 COUNT_BIG(CASE WHEN DashboardStatus NOT IN ('COMPLETED','CANCELLED') AND DueDate<@asOf THEN 1 END) AS Overdue,
 COUNT_BIG(CASE WHEN SLAStatus='BREACHED' AND DashboardStatus NOT IN ('COMPLETED','CANCELLED') THEN 1 END) AS Breached,
 COUNT_BIG(CASE WHEN SLAStatus='AT_RISK' AND DashboardStatus NOT IN ('COMPLETED','CANCELLED') THEN 1 END) AS AtRisk
 FROM #DashboardTasks GROUP BY DashboardStatus;
 ;WITH Samples AS (
 SELECT *,ROW_NUMBER() OVER(PARTITION BY DashboardStatus ORDER BY CASE WHEN DueDate IS NULL THEN 1 ELSE 0 END,DueDate,CreatedAt DESC,Id) AS rn FROM #DashboardTasks
 ) SELECT Id,Title,Status,Priority,SellerId,SellerName,AssignedTo,DueDate,CreatedAt,SLAStatus,DashboardStatus FROM Samples WHERE rn<=5 ORDER BY DashboardStatus,rn;
 DROP TABLE #DashboardTasks;
 `);
 if(r.recordsets?.length!==2)throw Error('Unexpected task snapshot result');
 const summary=emptyTaskSummary();
 for(const row of r.recordsets[0]){
  const n=Number(row.Total);
  summary.counts[row.DashboardStatus]=n;
  summary.total+=n;summary.overdue+=Number(row.Overdue);summary.slaBreached+=Number(row.Breached);summary.slaAtRisk+=Number(row.AtRisk);
 }
 return {instances:r.recordsets[1],summary};
}
module.exports={readTaskSnapshot,emptyTaskSummary,STATUS_SQL};
