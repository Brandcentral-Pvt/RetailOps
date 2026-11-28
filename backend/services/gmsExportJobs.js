'use strict';
const {createReportExportJobs}=require('./reportExportJobs');
const {strictScope,AdsScopeError}=require('./adsCanonicalScope');
const {exportWindow}=require('../utils/gmsPhase1');
const {filterSpec,queryFacts,historyWindow}=require('./gmsAnalyticsService');
const {buildCompleteExport,buildDailyExport}=require('./gmsCompleteExport');
const {writeGmsExport,ensureActive}=require('./gmsExportWriter');
const err=(code,message,status=400)=>new AdsScopeError(code,message,status);
const permission=u=>Boolean(u.permissions?.includes('*')||u.permissions?.includes('gms_tracker_export'));
function validateFilters(input,format){
 const allowed=['exportLevel','exportDataType','exportFileType','exportDateType','exportBrandType','exportCustomDates','startDate','endDate','sellerIds','search'];
 if(Object.keys(input).some(k=>!allowed.includes(k)))throw err('invalid_export','Unsupported GMS export filter.');
 const filters={exportLevel:'asin',exportDataType:'daily',exportDateType:'all',exportBrandType:'all',...input,exportFileType:format};
 for(const [key,values] of Object.entries({exportLevel:['asin','seller'],exportDataType:['daily','weekly','monthly'],exportDateType:['all','current','custom'],exportBrandType:['all','current','custom']}))if(!values.includes(filters[key]))throw err('invalid_export','Invalid '+key+'.');
 try{exportWindow(filters);filterSpec(filters);}catch(e){throw err('invalid_export',e.message);}
 if(filters.exportBrandType==='custom'&&!filters.sellerIds?.length)throw err('invalid_export','Select at least one seller.');
 if(filters.sellerIds?.length>1000)throw err('scope_too_large','Select up to 1,000 sellers.',422);
 if(filters.sellerIds?.some(id=>id!==id.trim()||id.length>50||/[,\s*]/.test(id)||/^all$/i.test(id)))throw err('invalid_export','Invalid seller ID.');
 if(filters.exportBrandType==='all'&&filters.sellerIds!=null)throw err('invalid_export','All sellers cannot be combined with explicit seller IDs.');
 if(filters.exportBrandType==='current'&&filters.sellerIds==null)throw err('invalid_export','Current filters must include the resolved seller selection.');
 return filters;
}
function freezeScope(user,filters){
 // An explicitly empty selection must not be widened into all sellers.
 if(Array.isArray(filters.sellerIds)&&!filters.sellerIds.length)throw err('empty_scope','No sellers match the current GMS filters.',422);
 const scope=strictScope(user,filters.sellerIds);
 if(scope.empty)throw err('empty_scope','No authorized sellers match this export.',403);
 if(scope.sellerIds.length>1000)throw err('scope_too_large','Select up to 1,000 sellers.',422);
 return {global:scope.unrestricted,ids:scope.sellerIds};
}
function scopedFilters(user,filters,frozen){
 if(!permission(user))throw err('access_changed','GMS export permission is no longer available.',403);
 if(frozen.global){if(!strictScope(user).unrestricted)throw err('access_changed','Global export scope is no longer available.',403);return {...filters,sellerIds:null};}
 if(!Array.isArray(frozen.ids)||!frozen.ids.length)throw err('access_changed','Invalid stored export scope.',403);
 strictScope(user,frozen.ids);
 return {...filters,sellerIds:frozen.ids};
}
async function generate({pool,user,filters,signal,filePath,format,onStage}){
 const {exportLevel,exportDataType}=filters;
 const window=exportWindow(filters);
 const spec=filterSpec(filters);
 // GMS still materializes its financial matrix; bound the SQL result before
 // creating large JS aggregates. No partial file can be published.
 const MAX_FACTS=250000;
 const facts=await queryFacts(pool,user,format==='csv'?window:historyWindow(window),spec,{signal,maxRows:MAX_FACTS});
 ensureActive(signal);
 const {report,complete}=format==='csv'?buildDailyExport(facts,{window}):buildCompleteExport(facts,{window,level:exportLevel});
 ensureActive(signal);
 const {monthGroups}=report;
    // Build column definitions
    const columnDef = [];
    if (exportLevel === 'seller') {
        columnDef.push({ label: 'Seller (DB)', getValue: r => r.dbBrand });
        columnDef.push({ label: 'ASIN', getValue: () => '-' });
        columnDef.push({ label: 'Brand (Sheet)', getValue: r => r.brandsList?.length > 0 ? r.brandsList.join(', ') : '-' });
        columnDef.push({ label: 'Store Code', getValue: r => r.storeCodesList?.length > 0 ? r.storeCodesList.join(', ') : '-' });
    } else {
        columnDef.push({ label: 'Seller (DB)', getValue: r => r.dbBrand });
        columnDef.push({ label: 'ASIN', getValue: r => r.asin });
        columnDef.push({ label: 'Product Title', getValue: r => r.productTitle });
        columnDef.push({ label: 'Brand (Sheet)', getValue: r => r.brand });
        columnDef.push({ label: 'Store Code', getValue: r => r.storeCode });
    }

    columnDef.push({ label: 'Ordered Units', getValue:r=>r.orderedUnits ?? '-' });
    columnDef.push({ label: 'Period Revenue', getValue:r=>r.orderedRevenue ?? '-' });
    Object.values(monthGroups).forEach(month => {
        if (exportDataType === 'daily' || exportDataType === 'weekly') {
            Object.values(month.weeks).forEach(week => {
                if (exportDataType === 'daily') {
                    const sortedDays = [...week.days].sort();
                    sortedDays.forEach((dayStr) => {
                        const label = new Date(dayStr+'T00:00:00Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone:'UTC' });
                        columnDef.push({ label, getValue: r => r.dailyRev[dayStr] ?? '-' });
                        columnDef.push({ label: label+' DoD (%)',getValue:r=>r._dodTrends[dayStr]==null?'-':Number(r._dodTrends[dayStr].toFixed(1)) });
                    });
                }
                columnDef.push({ label: `${week.label} Total`, getValue: r => r.weeklyRev[week.key] ?? '-' });
                if (exportDataType !== 'monthly') {
                    columnDef.push({ label: `${week.label} WoW (%)`, getValue: r => { const t = r._wowTrends[week.key]; return t == null ? '-' : Number(t.toFixed(1)); } });
                }
            });
        }
        columnDef.push({ label: `${month.label} Total`, getValue: r => r.monthlyRev[month.key] ?? '-' });
        {
            columnDef.push({ label: `${month.label} MoM (%)`, getValue: r => { const t = r._momTrends[month.key]; return t == null ? '-' : Number(t.toFixed(1)); } });
        }
    });


 await onStage('writing');
 const stats=await writeGmsExport({filePath,format,report,complete,columns:columnDef,matrixFixedCount:exportLevel==='seller'?6:7,signal});
 await onStage('verifying');
 return {rawCount:stats.rowCount,entityCount:report.matrixRows.length};
}
module.exports=createReportExportJobs({kind:'gms',permission,freezeScope,scopedFilters,validateFilters,generate,migration:require('../migrations/106_gms_export_jobs')});
