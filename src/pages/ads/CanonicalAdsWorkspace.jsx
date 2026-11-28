import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Drawer, Empty, Input, Select, Segmented, Form, Radio, Flex, Skeleton, Spin, Table, Tabs, Tag, Typography } from 'antd';
import {AppstoreOutlined,BarChartOutlined,BulbOutlined,DashboardOutlined,DownloadOutlined,FilterOutlined,HistoryOutlined,ReloadOutlined,SafetyCertificateOutlined,UploadOutlined,WalletOutlined} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS } from '../../constants/permissions';
import { useDateRange } from '../../contexts/DateRangeContext';
import { usePageTitle } from '../../contexts/PageTitleContext';
import { apiClient } from '../../lib/api-client';
import AdsImportModal from '../../components/ads/AdsImportModal';
import ReportDateRangePicker from '../../components/common/ReportDateRangePicker';
import {AdsComparisonPanel,AdsOpportunityPanel,DeltaText} from './AdsPerformanceReview';
import AdsPortfolioPanel from './AdsPortfolioPanel';
import AdsReconciliationPanel from './AdsReconciliationPanel';
import AdsOverview from './AdsOverview';
import {AdsBudgetPanel,AdsProductDiagnosticPanel} from './AdsBudgetIntelligence';
import {adsCount,adsMoney,adsRate} from './adsNumberFormat.mjs';
import './canonicalAdsWorkspace.css';

const iso=value=>{
    if(!value)return undefined;
    const d=value instanceof Date?value:new Date(value);
    if(Number.isNaN(d.getTime()))return undefined;
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
};
const get=async(path,params,signal)=>(await apiClient.get('/ads/'+path,{params,signal})).data.data;
const errorText=e=>e?.response?.data?.message||e?.message||'Could not load advertising data.';
const amount=(value,currency)=>currency?adsMoney(value,currency):adsCount(value);
const ratioValue=(r,suffix='%')=>adsRate(r?.value,suffix);
const coverageLabel=m=>m?.status==='complete'?null:<Tag color={m?.status==='partial'?'gold':'default'}>{m?.status==='partial'?'Partial':m?.status==='incompatible_coverage'?'Unmatched coverage':'Unknown'}</Tag>;
const METRIC_COLUMNS=[['Spend','spend',true],['Ad sales','sales',true],['Total sales','totalSales',true],['Organic sales','organicSales',true],['Ad orders','orders'],['Total orders','totalOrders'],['Conversions','conversions'],['Clicks','clicks'],['Impressions','impressions']];
const RATIO_COLUMNS=[['ACoS','acos','%'],['TACoS','tacos','%'],['ROAS','roas','x'],['CVR','cvr','%']];
const VIEWS=[
 ['overview','Overview',DashboardOutlined],['products','Products',AppstoreOutlined],['portfolio','Portfolio',BarChartOutlined],
 ['opportunities','Opportunities',BulbOutlined],['budgets','Budgets',WalletOutlined],['quality','Data Quality',SafetyCertificateOutlined]
];
const PRESETS={
 performance:['totalSales','sales','spend','orders','totalOrders','clicks','acos','tacos','roas','cvr'],
 traffic:['impressions','clicks','conversions','orders','cvr'],
 efficiency:['spend','sales','totalSales','acos','tacos','roas','cvr'],
 all:[...METRIC_COLUMNS.map(x=>x[1]),...RATIO_COLUMNS.map(x=>x[1])]
};
const DEFAULT_SORT={performance:'totalSales',traffic:'clicks',efficiency:'spend',all:'totalSales'};
const Field=({label,htmlFor,children})=><div className="ads-filter-field">{htmlFor?<label htmlFor={htmlFor}>{label}</label>:<span>{label}</span>}{children}</div>;
function ViewNav({view,onChange}){
 return <nav className="ads-workspace-nav" aria-label="Ads workspace views">
  {VIEWS.map(([key,label,Icon])=><button type="button" key={key} aria-current={view===key?'page':undefined} data-testid={'ads-view-'+key} className={'ads-view-button'+(view===key?' active':'')} onClick={()=>onChange(key)}><Icon aria-hidden="true"/><span>{label}</span></button>)}
 </nav>;
}
function AdsExportDialog({open,onClose,initial,principal,onSubmit,busy,error}){
 const [draft,setDraft]=useState(initial);
 const [scope,setScope]=useState('current');
 const [dateMode,setDateMode]=useState('current');
 const [format,setFormat]=useState('xlsx');
 const change=(key,value)=>setDraft(old=>({...old,[key]:value}));
 const selectedSellers=Array.isArray(draft.sellerId)?draft.sellerId:draft.sellerId?[draft.sellerId]:[];
 const sellerId=selectedSellers.join(',')||undefined;
 const options=useQuery({queryKey:['ads-canonical',principal,'options',sellerId],queryFn:({signal})=>get('canonical-options',{sellerId},signal),enabled:open,staleTime:0,retry:false});
 const choices=options.data||{};
 const days=(Date.parse(draft.endDate)-Date.parse(draft.startDate))/86400000+1;
 const validDates=dateMode==='all'||days>=1&&days<=366;
 const select=(label,key,values)=><Form.Item label={label}><Select aria-label={'Export '+label} allowClear showSearch optionFilterProp="label" placeholder={'All '+label.toLowerCase()+'s'} value={draft[key]} options={values} onChange={v=>change(key,v)} disabled={busy}/></Form.Item>;
 const setScopeMode=value=>{
  setScope(value);
  setDraft(old=>({...old,sellerId:value==='current'?initial.sellerId:undefined,brand:value==='current'?initial.brand:undefined,category:value==='current'?initial.category:undefined,currency:value==='current'?initial.currency:undefined,marketplace:value==='current'?initial.marketplace:undefined,search:value==='current'?initial.search:undefined}));
 };
 const selectSeller=v=>setDraft(old=>({...old,sellerId:v,brand:undefined,category:undefined,currency:undefined,marketplace:undefined}));
 const submit=()=>{const filters={...draft,sellerId,search:draft.search?.trim()||undefined};if(dateMode==='all'){delete filters.startDate;delete filters.endDate;filters.allHistory=true;}if(format==='csv'){filters.groupBy='asin';filters.granularity='day';}onSubmit(filters,format);};
 return <Drawer title="Export advertising report" open={open} width="min(560px, 100vw)" onClose={()=>{if(!busy)onClose();}} keyboard={!busy} mask={{closable:!busy}}
 footer={<Flex justify="flex-end" gap={8}><Button disabled={busy} onClick={onClose}>Cancel</Button><Button type="primary" icon={<DownloadOutlined/>} loading={busy} disabled={busy||!validDates||(scope==='custom'&&!sellerId)||(format==='xlsx'&&draft.groupBy==='parent'&&choices.parentAvailable!==true)} onClick={submit}>Queue {format==='xlsx'?'Excel':'CSV'} export</Button></Flex>}>
 <Form layout="vertical" requiredMark={false} disabled={busy}>
 {error&&<Alert type="error" showIcon message={error} style={{marginBottom:16}}/>}
 <Form.Item label="Report format"><Radio.Group value={format} onChange={e=>setFormat(e.target.value)}><Flex vertical gap={8}><Radio value="xlsx">Excel: complete data and analytics</Radio><Radio value="csv">CSV: complete daily source records</Radio></Flex></Radio.Group></Form.Item>
 <Alert type="info" showIcon message={format==='xlsx'?'Complete workbook':'Complete source CSV'} description={format==='xlsx'?'All 63 source fields, comparisons, portfolio analysis, opportunities, reconciliation, seller-wide budgets and targets where applicable. All matching rows, not just the visible page.':'All 63 source fields plus owner and import lineage for every matching stored row. Choose Excel for analytical worksheets.'} style={{marginBottom:16}}/>
 {format==='xlsx'&&<><Form.Item label="Entity grouping"><Segmented block value={draft.groupBy} onChange={v=>change('groupBy',v)} options={[{label:'ASIN',value:'asin'},{label:'Parent ASIN',value:'parent',disabled:choices.parentAvailable!==true},{label:'Seller',value:'seller'}]}/></Form.Item>
 <Form.Item label="Trend detail"><Segmented block value={draft.granularity} onChange={v=>change('granularity',v)} options={[{label:'Daily',value:'day'},{label:'Weekly',value:'week'},{label:'Monthly',value:'month'}]}/></Form.Item></>}
 <Form.Item label="Report dates"><Radio.Group value={dateMode} onChange={e=>{setDateMode(e.target.value);if(e.target.value==='current')setDraft(old=>({...old,startDate:initial.startDate,endDate:initial.endDate}));}}><Flex vertical gap={8}><Radio value="current">Current report range ({initial.startDate||'Not selected'} to {initial.endDate||'Not selected'})</Radio><Radio value="custom">Custom dates</Radio><Radio value="all">All available history</Radio></Flex></Radio.Group></Form.Item>
 {dateMode==='custom'&&<Form.Item label="Custom reporting dates"><ReportDateRangePicker idPrefix="ads-export-range" ariaLabel="Export reporting dates" startDate={draft.startDate} endDate={draft.endDate} maxDays={366} onDateRangeChange={v=>setDraft(old=>({...old,startDate:iso(v.startDate),endDate:iso(v.endDate)}))}/></Form.Item>}
 {!validDates&&<Alert type="warning" message="Select a valid range of up to 366 days." showIcon/>}
 {dateMode==='all'&&<Alert type="warning" showIcon message="All available stored history" description="No preceding comparison period is defined. Select custom dates for equal-length comparisons and seller-wide monthly budget analytics."/>}
 <Form.Item label="Seller and filter scope"><Radio.Group value={scope} onChange={e=>setScopeMode(e.target.value)}><Flex vertical gap={8}><Radio value="current">Use current page filters</Radio><Radio value="all">All authorized sellers (no catalog filters)</Radio><Radio value="custom">Choose seller and filters</Radio></Flex></Radio.Group></Form.Item>
 {scope==='custom'&&<>
 <Form.Item label="Sellers" required><Select aria-label="Export seller" mode="multiple" allowClear maxTagCount="responsive" showSearch optionFilterProp="label" value={selectedSellers} onChange={selectSeller} options={(choices.sellers||[]).map(s=>({value:s.id,label:s.name||s.id}))} placeholder="Select one or more sellers" loading={options.isFetching}/></Form.Item>
 {select('Brand','brand',(choices.brands||[]).map(v=>({value:v,label:v})))}
 {select('Category','category',(choices.categories||[]).map(v=>({value:v,label:v})))}
 {select('Marketplace','marketplace',(choices.marketplaces||[]).map(v=>({value:v,label:v})))}
 {select('Currency','currency',(choices.currencies||[]).map(v=>({value:v,label:v})))}
 <Form.Item label="Product search"><Input aria-label="Export product search" value={draft.search||''} maxLength={120} allowClear onChange={e=>change('search',e.target.value)} placeholder="ASIN, SKU or title"/></Form.Item>
 </>}
 {scope==='current'&&<Typography.Paragraph type="secondary">{[['Seller',draft.sellerId],['Brand',draft.brand],['Category',draft.category],['Marketplace',draft.marketplace],['Currency',draft.currency],['Search',draft.search]].filter(([,v])=>v).map(([k,v])=>k+': '+v).join(' · ')||'No additional filters; all authorized sellers.'}</Typography.Paragraph>}
 {options.isError&&<Alert type="error" message={errorText(options.error)} action={<Button onClick={()=>options.refetch()}>Retry</Button>}/>}
 {choices.truncated&&<Alert type="warning" message="Filter options are capped. Select a seller to narrow catalog choices."/>}
 <Alert type="info" showIcon message="Background export" description="Up to 2 million stored daily records and 250,000 comparison entities per job. Follow progress in Download Center; files expire according to the configured retention policy. Oversized jobs fail explicitly without truncation."/>
 </Form></Drawer>;
}
const exportErrorText=async e=>{
 let detail=e?.response?.data;
 if(detail instanceof Blob){try{detail=JSON.parse(await detail.text());}catch{detail=null;}}
 return detail?.message||e.message||'Export failed.';
};
function ReportLoading(){return <div className="ads-report-loading" role="status" aria-label="Loading advertising report"><div className="ads-kpi-grid">{Array.from({length:8},(_,i)=><Card key={i} size="small"><Skeleton active title={{width:'55%'}} paragraph={{rows:2}}/></Card>)}</div><Card size="small"><Skeleton active paragraph={{rows:4}}/></Card></div>;}
const TrendTable=({series})=>series.length===0?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No historical records in this period"/>:<div className="ads-table-shell" data-testid="ads-trend-table"><Table tableLayout="fixed" size="small" rowKey={r=>JSON.stringify([r.currency,r.periodKey,r.bucket])} dataSource={series} pagination={{pageSize:10}} scroll={{x:760}}
    columns={[{title:'Period',dataIndex:'periodKey',width:100},{title:'Date / bucket',dataIndex:'bucket',width:125},{title:'Currency',dataIndex:'currency',width:90},
        {title:'Ad spend',width:120,render:(_,r)=>amount(r.totals.spend,r.currency)},{title:'Ad sales',width:120,render:(_,r)=>amount(r.totals.sales,r.currency)},
        {title:'Total sales',width:125,render:(_,r)=>amount(r.totals.totalSales,r.currency)},{title:'ACoS',width:90,render:(_,r)=>ratioValue(r.ratios.acos)}]}/></div>;

export default function CanonicalAdsWorkspace(){
    const {user}=useAuth();
    const queryClient=useQueryClient();
    const [view,setView]=useState('overview');
    const rootRef=useRef(null);
    const [overviewPreferences,setOverviewPreferences]=useState({metric:'sales_spend',period:'current',currency:null});
    const setOverviewPreference=(key,value)=>setOverviewPreferences(prev=>({...prev,[key]:value}));
    useEffect(()=>{const shell=rootRef.current?.closest('.routes-container');if(shell)shell.scrollTop=0;},[view]);
    const [preset,setPreset]=useState('performance');
    const [showPrior,setShowPrior]=useState(true);
    const [density,setDensity]=useState('compact');
    const [drillTab,setDrillTab]=useState('overview');
    const [importTab,setImportTab]=useState('upload');
    // Match requirePermission on the API: effective grants and wildcard only.
    // Global seller scope or a role label is not a permission grant.
    const permissions=Array.isArray(user?.permissions)?user.permissions:[];
    const hasPermission=permission=>permissions.includes('*')||permissions.includes(permission);
    const {startDate,endDate,updateDateRange}=useDateRange();
    const {setPageTitle}=usePageTitle();
    useEffect(()=>{setPageTitle('Ads Intelligence');},[setPageTitle]);
    const [seller,setSeller]=useState(undefined);
    const [brand,setBrand]=useState(undefined);
    const [category,setCategory]=useState(undefined);
    const [currency,setCurrency]=useState(undefined);
    const [marketplace,setMarketplace]=useState(undefined);
    const [groupBy,setGroupBy]=useState('asin');
    const [granularity,setGranularity]=useState('day');
    const [search,setSearch]=useState('');
    const [searchInput,setSearchInput]=useState('');
    const [sort,setSort]=useState({sortBy:'totalSales',sortOrder:'desc'});
    const [paging,setPaging]=useState({key:'',page:1,limit:50});
    const [drill,setDrill]=useState(null);
    const [requestedReview,setRequestedReview]=useState(null);
    const [requestedPortfolio,setRequestedPortfolio]=useState(null);
    const [requestedReconciliation,setRequestedReconciliation]=useState(null);
    const [portfolioGranularity,setPortfolioGranularity]=useState('week');
    const [importOpen,setImportOpen]=useState(false);
    const [exportConfig,setExportConfig]=useState(null);
    const exportRequest=useRef(null);
    const [exportBusy,setExportBusy]=useState(false);
    const exportLock=useRef(false);
    const [exportError,setExportError]=useState(null);
    // Include principal and current scope in the client cache key. No stale
    // placeholder data is used across filters, pages, or account changes.
    const principal=JSON.stringify([user?._id||user?.Id||user?.id,user?.role?.name||user?.role?.Name||user?.role,user?.assignedSellers,user?.permissions]);
    const enabled=!!user&&hasPermission(PERMISSIONS.ADSREPORT_VIEW);
    const options=useQuery({queryKey:['ads-canonical',principal,'options',seller],queryFn:({signal})=>get('canonical-options',{sellerId:seller},signal),enabled,staleTime:0,retry:false});
    const filters=useMemo(()=>({startDate:iso(startDate),endDate:iso(endDate),sellerId:seller,brand,category,currency,marketplace,groupBy,granularity,search:search||undefined,...sort}),[startDate,endDate,seller,brand,category,currency,marketplace,groupBy,granularity,search,sort]);
    const signature=JSON.stringify([principal,filters]);
    const page=paging.key===signature?paging.page:1,limit=paging.limit;
    const selectedDays=(Date.parse(filters.endDate)-Date.parse(filters.startDate))/86400000+1;
    const hasDates=!!filters.startDate&&!!filters.endDate&&selectedDays>=1&&selectedDays<=366;
    const reportView=view==='overview'||view==='products';
    const overviewFilters=useMemo(()=>({startDate:filters.startDate,endDate:filters.endDate,sellerId:seller,brand,category,currency,marketplace,search:search||undefined,groupBy,granularity}),[filters.startDate,filters.endDate,seller,brand,category,currency,marketplace,search,groupBy,granularity]);
    const overviewReport=useQuery({queryKey:['ads-canonical',principal,'overview',overviewFilters],queryFn:({signal})=>get('canonical-overview',overviewFilters,signal),enabled:enabled&&hasDates&&view==='overview',staleTime:0,retry:false,refetchOnWindowFocus:false});
    const productReport=useQuery({queryKey:['ads-canonical',principal,'report',filters,page,limit],queryFn:({signal})=>get('canonical-report',{...filters,page,limit},signal),enabled:enabled&&hasDates&&view==='products',staleTime:0,retry:false,refetchOnWindowFocus:false});
    const report=view==='overview'?overviewReport:productReport;
    const drillTarget=drill?.signature===signature?drill.row:null;
    const drillGrouping=drill?.groupBy||groupBy;
    const history=useQuery({queryKey:['ads-canonical',principal,'history',filters,drillGrouping,drillTarget?.key],queryFn:({signal})=>get('canonical-report',{...filters,groupBy:drillGrouping,granularity:'day',sellerId:drillTarget.sellerId,marketplace:drillTarget.marketplace,currency:drillTarget.currency,entityKey:drillTarget.entityKey,page:1},signal),enabled:enabled&&!!drillTarget,staleTime:0,retry:false});
    const reviewFilters={startDate:filters.startDate,endDate:filters.endDate,sellerId:seller,brand,category,currency,marketplace,search:search||undefined,groupBy:'asin'};
    const reviewSignature=JSON.stringify([principal,reviewFilters]);
    const reviewRequested=requestedReview===reviewSignature;
    const review=useQuery({queryKey:['ads-canonical',principal,'review',reviewFilters],queryFn:({signal})=>get('canonical-insights',reviewFilters,signal),enabled:enabled&&view==='opportunities'&&reviewRequested&&hasDates,staleTime:0,retry:false,refetchOnWindowFocus:false});
    const analyze=()=>{if(reviewRequested)review.refetch();else setRequestedReview(reviewSignature);};
    // Scope is independent of primary table grouping, pagination and sorting.
    const portfolioFilters={...reviewFilters,granularity:portfolioGranularity};
    const portfolioRequested=requestedPortfolio===reviewSignature;
    const portfolio=useQuery({queryKey:['ads-canonical',principal,'portfolio',portfolioFilters],queryFn:({signal})=>get('canonical-portfolio',portfolioFilters,signal),enabled:enabled&&view==='portfolio'&&portfolioRequested&&hasDates,staleTime:0,retry:false,refetchOnWindowFocus:false});
    const analyzePortfolio=()=>{if(portfolioRequested)portfolio.refetch();else setRequestedPortfolio(reviewSignature);};
    const reconciliationRequested=requestedReconciliation===reviewSignature;
    const reconciliation=useQuery({queryKey:['ads-canonical',principal,'reconciliation',reviewFilters],queryFn:({signal})=>get('canonical-reconciliation',reviewFilters,signal),enabled:enabled&&view==='quality'&&reconciliationRequested&&hasDates,staleTime:0,retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false});
    const reconcile=()=>{if(reconciliationRequested)reconciliation.refetch();else setRequestedReconciliation(reviewSignature);};
    const targetFilters={sellerId:seller,startDate:filters.startDate,endDate:filters.endDate,currency};
    const targetsApplicable=!brand&&!category&&!search&&!marketplace;
    const targets=useQuery({queryKey:['ads-canonical',principal,'budget',targetFilters],queryFn:({signal})=>get('canonical-budget',targetFilters,signal),enabled:enabled&&view==='budgets'&&targetsApplicable&&hasDates,staleTime:0,retry:false});
    const data=report.data;
    const openExport=()=>{setExportError(null);exportRequest.current=null;setExportConfig({principal,filters:{...filters}});};
    const exportReport=async(exportFilters,format)=>{
        if(exportLock.current||!hasPermission(PERMISSIONS.ADSREPORT_EXPORT))return;
        exportLock.current=true;setExportBusy(true);setExportError(null);
        try{
            const signature=JSON.stringify([principal,exportFilters,format]);
            if(exportRequest.current?.signature!==signature)exportRequest.current={signature,clientId:crypto.randomUUID()};
            const res=await apiClient.post('/ads/export-jobs',{clientId:exportRequest.current.clientId,format,filters:exportFilters});
            if(!res.data?.data?.id)throw Error('Export job was not acknowledged. Retry the same request.');
            setExportConfig(null);window.dispatchEvent(new Event('export-started'));exportRequest.current=null;
            
        }catch(e){setExportError(await exportErrorText(e));}
        finally{exportLock.current=false;setExportBusy(false);}
    };
    const imported=info=>{
        // Keep the completed modal visible. Move the report to the imported seller/date
        // and invalidate all affected local queries after the committed response.
        setView('overview');setSeller(info.sellerId||undefined);setBrand(undefined);setCategory(undefined);setCurrency(info.currency);setMarketplace(undefined);
        setSearch('');setSearchInput('');setDrill(null);setRequestedReview(null);setRequestedPortfolio(null);setRequestedReconciliation(null);setPaging({key:'',page:1,limit:50});
        const end=new Date(info.endDate+'T00:00:00'),start=new Date(info.startDate+'T00:00:00');
        const earliest=new Date(end);earliest.setDate(earliest.getDate()-365);
        updateDateRange({startDate:start<earliest?earliest:start,endDate:end,rangeType:'custom'});
        void queryClient.invalidateQueries({queryKey:['ads-canonical',principal]});
    };
    const openImport=tab=>{setImportTab(tab);setImportOpen(true);};
    const openDrill=(row,group)=>{setDrillTab('overview');setDrill({signature,row,groupBy:group});};
    const clearFilters=()=>{setSeller(undefined);setBrand(undefined);setCategory(undefined);setCurrency(undefined);setMarketplace(undefined);setSearch('');setSearchInput('');setDrill(null);setPaging({key:'',page:1,limit});setRequestedReview(null);setRequestedPortfolio(null);setRequestedReconciliation(null);};
    const applySearch=()=>setSearch(searchInput.trim());
    const selectPreset=value=>{setPreset(value);if(sort.sortBy!=='entityKey'&&!PRESETS[value].includes(sort.sortBy)){setSort({sortBy:DEFAULT_SORT[value],sortOrder:'desc'});setPaging({key:'',page:1,limit});}};
    const activeFilters=[seller,brand,category,currency,marketplace,search].filter(Boolean).length;
    const choices=options.data||{};
    const columns=[
        {title:groupBy==='seller'?'Seller':groupBy==='parent'?'Parent ASIN':'ASIN',key:'entityKey',fixed:'left',width:200,className:'ads-pinned-cell',onCell:()=>({className:'ads-pinned-cell','data-testid':'ads-pinned-product'}),onHeaderCell:()=>({className:'ads-pinned-cell'}),sorter:true,render:(_,r)=><><Button type="link" className="ads-entity-link" onClick={()=>openDrill(r,groupBy)}>{r.entityKey}</Button><div className="ads-product-title" title={r.title||r.sellerName}>{r.title||r.sellerName}</div></>},
        {title:'Seller / marketplace',key:'sellerContext',width:190,render:(_,r)=><><div className="ads-product-title" title={r.sellerName}>{r.sellerName}</div><div className="ads-analytics-note">{r.marketplace} · {r.currency}</div></>},
        ...METRIC_COLUMNS.filter(([,key])=>PRESETS[preset].includes(key)).map(([title,key,money])=>({title,key,width:155,align:'right',sorter:true,render:(_,r)=><><span className="ads-table-number" title={r.current?.totals?.[key]??'Unknown'}>{amount(r.current?.totals?.[key],money?r.currency:null)}</span>{showPrior&&<><div className="ads-table-prior">Prior: {amount(r.previous?.totals?.[key],money?r.currency:null)}</div><DeltaText change={r.comparison?.metrics?.[key]} money={money} currency={r.currency}/></>}{coverageLabel(r.current?.coverage?.[key])}</>})),
        ...RATIO_COLUMNS.filter(([,key])=>PRESETS[preset].includes(key)).map(([title,key,suffix])=>({title,key,width:140,align:'right',render:(_,r)=><><span className="ads-table-number" title={r.current?.ratios?.[key]?.value??'Unknown'}>{ratioValue(r.current?.ratios?.[key],suffix)}</span>{showPrior&&<><div className="ads-table-prior">Prior: {ratioValue(r.previous?.ratios?.[key],suffix)}</div><DeltaText change={r.comparison?.ratios?.[key]} currency={r.currency}/></>}{coverageLabel(r.current?.ratios?.[key])}</>}))
    ].map(c=>({...c,sortOrder:c.key===sort.sortBy?(sort.sortOrder==='asc'?'ascend':'descend'):undefined}));
    const selector=(label,values,value,onChange)=><Select aria-label={label} placeholder={label} allowClear showSearch value={value} onChange={onChange} options={(values||[]).map(v=>({value:v,label:v}))}/>;
    const refresh=()=>{options.refetch();if(reportView&&hasDates){
        const isOverview=view==='overview';
        const key=isOverview?['ads-canonical',principal,'overview',overviewFilters]:['ads-canonical',principal,'report',filters,page,limit];
        const params=isOverview?overviewFilters:{...filters,page,limit};
        // Cancel the existing request and refresh the identical cache key.
        // Never introduce a second client-side report identity for refresh.
        void queryClient.cancelQueries({queryKey:key,exact:true}).then(()=>queryClient.fetchQuery({queryKey:key,queryFn:({signal})=>get(isOverview?'canonical-overview':'canonical-report',{...params,refresh:'true'},signal),staleTime:0,retry:false})).catch(()=>{});
    }if(view==='budgets'&&targetsApplicable&&hasDates)targets.refetch();if(drillTarget)history.refetch();if(view==='opportunities'&&reviewRequested)review.refetch();if(view==='portfolio'&&portfolioRequested)portfolio.refetch();if(view==='quality'&&reconciliationRequested)reconciliation.refetch();};
    const refreshing=options.isFetching||(reportView&&report.isFetching)||(view==='budgets'&&targets.isFetching)||(view==='opportunities'&&review.isFetching)||(view==='portfolio'&&portfolio.isFetching)||(view==='quality'&&reconciliation.isFetching);
    const navigate=key=>{setView(key);setDrill(null);};
    if(!enabled)return <Alert type="warning" message="Advertising view permission is required." showIcon/>;
    return <div ref={rootRef} className="ads-workspace ads-phase4" data-testid="ads-workspace">
        <header className="ads-page-header">
            <div className="ads-heading-copy"><div className="ads-eyebrow">REPORTS / ADVERTISING</div><h1>Ads Intelligence</h1><p>Performance, portfolio decisions and report quality in one workspace.</p></div>
            <div className="ads-heading-actions">
                {hasPermission(PERMISSIONS.ADSREPORT_IMPORT)&&<><Button aria-label="Import history" icon={<HistoryOutlined aria-hidden="true"/>} onClick={()=>openImport('history')}>Import history</Button><Button aria-label="Import CSV" type="primary" icon={<UploadOutlined aria-hidden="true"/>} onClick={()=>openImport('upload')}>Import CSV</Button></>}
                {hasPermission(PERMISSIONS.ADSREPORT_EXPORT)&&<><Button aria-label="Export history" icon={<HistoryOutlined aria-hidden="true"/>} onClick={()=>window.dispatchEvent(new Event('export-started'))}>Export history</Button><Button aria-label="Export XLSX" icon={<DownloadOutlined aria-hidden="true"/>} onClick={openExport} loading={exportBusy} disabled={exportBusy}>Export report</Button></>}
                <Button aria-label="Refresh" icon={<ReloadOutlined aria-hidden="true"/>} onClick={refresh} loading={refreshing}>Refresh</Button>
            </div>
        </header>
        <div className="ads-source-strip"><span className="ads-source-dot" aria-hidden="true"/><strong>Imported daily reports</strong><span>Currency groups remain separate. Data reflects uploaded reports, not live advertising delivery.</span></div>
        
        <Card size="small" className="ads-filter-card">
            <div className="ads-filter-header"><strong><FilterOutlined/> Report scope</strong><div className="ads-filter-meta">{activeFilters>0&&<span>{activeFilters} active</span>}<Button type="link" size="small" disabled={!activeFilters} onClick={clearFilters}>Clear filters</Button></div></div>
            <div className="ads-filters ads-filter-grid" data-testid="ads-filters">
                <Field label="Reporting dates" htmlFor="ads-report-range"><ReportDateRangePicker idPrefix="ads-report-range" startDate={startDate} endDate={endDate} onDateRangeChange={updateDateRange} maxDays={366}/></Field>
                <Field label="Seller"><Select aria-label="Seller" placeholder="All accessible sellers" allowClear showSearch optionFilterProp="label" value={seller} loading={options.isFetching} options={(choices.sellers||[]).map(s=>({value:s.id,label:s.name||s.id}))} onChange={v=>{setSeller(v);setBrand(undefined);setCategory(undefined);setCurrency(undefined);setMarketplace(undefined);}}/></Field>
                <Field label="Brand">{selector('Brand',choices.brands,brand,setBrand)}</Field>
                <Field label="Category">{selector('Category',choices.categories,category,setCategory)}</Field>
                <Field label="Marketplace">{selector('Marketplace',choices.marketplaces||[],marketplace,setMarketplace)}</Field>
                <Field label="Currency">{selector('Currency',choices.currencies,currency,setCurrency)}</Field>
                <Field label="Product search"><div className="ads-search-control"><Input id="ads-product-search" aria-label="Search products" placeholder="ASIN, SKU or title" maxLength={120} allowClear value={searchInput} onChange={e=>{setSearchInput(e.target.value);if(!e.target.value)setSearch('');}} onPressEnter={applySearch}/><Button onClick={applySearch}>Apply</Button></div></Field>
            </div>
            {options.isError&&<Alert style={{marginTop:10}} type="error" message={errorText(options.error)} action={<Button onClick={()=>options.refetch()}>Retry</Button>}/>}
            {choices.truncated&&<Typography.Paragraph className="ads-filter-note" type="secondary">Filter options are capped; select a seller to narrow catalog choices.</Typography.Paragraph>}
        </Card>
        <ViewNav view={view} onChange={navigate}/>
        {!hasDates?<Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Select a valid reporting range of up to 366 days."/></Card>:<>
          {reportView&&(report.isError?<Alert type="error" showIcon message={errorText(report.error)} action={<Button onClick={()=>report.refetch()}>Retry</Button>}/>:report.isPending?<ReportLoading/>:data&&<>
            <div className="ads-period-note ads-comparison-period"><span>Current: <strong>{data.period.startDate} to {data.period.endDate}</strong></span><span>Previous: <strong>{data.period.prevStart} to {data.period.prevEnd}</strong></span>{report.isFetching&&<span role="status">Refreshing report…</span>}</div>
            {data.empty?<Card className="ads-empty-card"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No canonical advertising records in the selected dates.">{hasPermission(PERMISSIONS.ADSREPORT_IMPORT)&&<Button type="primary" onClick={()=>openImport('upload')}>Import a report</Button>}</Empty></Card>:view==='overview'?<>
                <AdsOverview key={reviewSignature} report={data} granularity={granularity} onGranularity={setGranularity} onNavigate={navigate} preferences={overviewPreferences} onPreference={setOverviewPreference}/>
                <AdsComparisonPanel report={data}/>
            </>:<Card size="small" className="ads-product-card">
                <div className="ads-section-heading"><div><h2>Product and seller analytics</h2><p>{adsCount(data.total)} matching entities · Server-side sorting and pagination</p></div><Tag>{showPrior?'Current vs prior':'Current only'}</Tag></div>
                <div className="ads-product-toolbar">
                    <Field label="Group by"><Select id="ads-product-group" virtual={false} aria-label="Group by" value={groupBy} onChange={v=>{setGroupBy(v);setDrill(null);}} options={[{value:'asin',label:'ASIN'},{value:'parent',label:'Parent ASIN',disabled:choices.parentAvailable!==true},{value:'seller',label:'Seller'}]}/></Field>
                    <Field label="Column set"><Select id="ads-product-columns" virtual={false} aria-label="Product column set" value={preset} onChange={selectPreset} options={[{value:'performance',label:'Performance'},{value:'traffic',label:'Traffic & conversion'},{value:'efficiency',label:'Efficiency'},{value:'all',label:'All metrics'}]}/></Field>
                    <Field label="Comparison"><Segmented aria-label="Product comparison display" value={showPrior?'compare':'current'} onChange={v=>setShowPrior(v==='compare')} options={[{label:'Current + prior',value:'compare'},{label:'Current only',value:'current'}]}/></Field>
                    <Field label="Density"><Segmented aria-label="Product table density" value={density} onChange={setDensity} options={[{label:'Compact',value:'compact'},{label:'Comfortable',value:'comfortable'}]}/></Field>
                </div>
                <div className="ads-table-shell" data-testid="ads-product-table" data-density={density}>
                    <Table tableLayout="fixed" rowKey="key" columns={columns} dataSource={data.rows} size={density==='compact'?'small':'middle'} sticky scroll={{x:columns.reduce((n,c)=>n+c.width,0),y:520}} loading={report.isFetching}
                        pagination={{current:data.page,pageSize:data.limit,total:data.total,showSizeChanger:true,pageSizeOptions:[25,50,100],showTotal:total=>adsCount(total)+' entities'}}
                        onChange={(p,_f,s,extra)=>{
                            if(extra.action==='sort'){setSort({sortBy:s.order?s.columnKey:DEFAULT_SORT[preset],sortOrder:s.order==='ascend'?'asc':'desc'});setPaging({key:'',page:1,limit:p.pageSize||limit});}
                            else if(extra.action==='paginate')setPaging({key:signature,page:p.pageSize!==limit?1:p.current,limit:p.pageSize});
                        }}/>
                </div>
                <div className="ads-chart-footer"><span>ASIN / seller identity stays pinned. Scroll horizontally to view all metrics. Null values remain N/A.</span><Button type="link" onClick={()=>navigate('opportunities')}>Review opportunities</Button></div>
            </Card>}
          </>)}
          {view==='opportunities'&&<AdsOpportunityPanel key={reviewSignature} review={review} requested={reviewRequested} onAnalyze={analyze} days={Math.round((Date.parse(filters.endDate)-Date.parse(filters.startDate))/86400000)+1} onOpen={row=>openDrill(row,'asin')}/>}
          {view==='portfolio'&&<AdsPortfolioPanel portfolio={portfolio} requested={portfolioRequested} onAnalyze={analyzePortfolio} granularity={portfolioGranularity} onGranularity={setPortfolioGranularity} onOpen={row=>openDrill(row,'asin')} onFilter={(dimension,row)=>{if(dimension==='seller')setSeller(row.groupKey);else setBrand(row.groupKey);setCurrency(row.current?.currency||row.previous?.currency);setMarketplace(row.marketplace);setDrill(null);}}/>}
          {view==='quality'&&<AdsReconciliationPanel key={reviewSignature} audit={reconciliation} requested={reconciliationRequested} onRun={reconcile}/>}
          {view==='budgets'&&<AdsBudgetPanel key={JSON.stringify([principal,targetFilters])} applicable={targetsApplicable} budget={targets} onRetry={()=>targets.refetch()}/>}
        </>}
        <Drawer rootClassName="ads-history-drawer ads-phase4-drawer" title={drillTarget?drillTarget.entityKey+' | '+drillTarget.sellerName:'Product history'} open={!!drillTarget} onClose={()=>setDrill(null)} width="min(1040px, 96vw)">
            {drillTarget&&<div className="ads-drawer-identity"><div><span>{drillGrouping==='seller'?'Seller':drillGrouping==='parent'?'Parent ASIN':'ASIN'}</span><strong>{drillTarget.entityKey}</strong></div><div><span>Marketplace / currency</span><strong>{drillTarget.marketplace} · {drillTarget.currency}</strong></div><div><span>Report dates</span><strong>{filters.startDate} to {filters.endDate}</strong></div>{drillTarget.title&&<p title={drillTarget.title}>{drillTarget.title}</p>}</div>}
            {history.isError?<Alert type="error" message={errorText(history.error)} action={<Button onClick={()=>history.refetch()}>Retry</Button>}/>:history.isPending?<Spin/>:history.data&&<Tabs activeKey={drillTab} onChange={setDrillTab} destroyOnHidden items={[
                {key:'overview',label:'Overview',children:<>{history.data.empty?<Empty description="No stored records in these dates"/>:<AdsOverview key={drillTarget?.key} report={history.data} granularity="day" compactMode/>}<AdsComparisonPanel report={history.data}/></>},
                ...(drillGrouping==='asin'?[{key:'diagnostics',label:'ASIN diagnostics',children:history.data.diagnostics?<AdsProductDiagnosticPanel diagnostics={history.data.diagnostics}/>:<Empty description="No ASIN diagnostic observations"/>}]:[]),
                {key:'history',label:'Daily history',children:<Card size="small" title="Daily report records"><TrendTable series={history.data.series||[]}/></Card>}
            ]}/>}
        </Drawer>
        {hasPermission(PERMISSIONS.ADSREPORT_EXPORT)&&exportConfig?.principal===principal&&<AdsExportDialog open initial={exportConfig.filters} principal={principal} onClose={()=>setExportConfig(null)} onSubmit={exportReport} busy={exportBusy} error={exportError}/>}
        {hasPermission(PERMISSIONS.ADSREPORT_IMPORT)&&<AdsImportModal key={principal} isOpen={importOpen} initialTab={importTab} onClose={()=>setImportOpen(false)} onComplete={imported}/>}
    </div>;
}
