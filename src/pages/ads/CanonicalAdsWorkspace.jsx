import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Drawer, Empty, Input, Row, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS } from '../../constants/permissions';
import { useDateRange } from '../../contexts/DateRangeContext';
import { usePageTitle } from '../../contexts/PageTitleContext';
import { apiClient } from '../../lib/api-client';
import AdsImportModal from '../../components/ads/AdsImportModal';
import {AdsComparisonPanel,AdsOpportunityPanel,DeltaText} from './AdsPerformanceReview';
import './canonicalAdsWorkspace.css';

const iso=value=>{
    if(!value)return undefined;
    const d=value instanceof Date?value:new Date(value);
    if(Number.isNaN(d.getTime()))return undefined;
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
};
const get=async(path,params,signal)=>(await apiClient.get('/ads/'+path,{params,signal})).data.data;
const errorText=e=>e?.response?.data?.message||e?.message||'Could not load advertising data.';
const amount=(value,currency)=>value===null||value===undefined?'N/A':(currency?currency+' ':'')+value;
const ratioValue=(r,suffix='%')=>r?.value==null?'N/A':r.value+suffix;
const coverageLabel=m=>m?.status==='complete'?null:<Tag color={m?.status==='partial'?'gold':'default'}>{m?.status==='partial'?'Partial':m?.status==='incompatible_coverage'?'Unmatched coverage':'Unknown'}</Tag>;
const METRIC_COLUMNS=[['Spend','spend',true],['Ad sales','sales',true],['Total sales','totalSales',true],['Organic sales','organicSales',true],['Ad orders','orders'],['Total orders','totalOrders'],['Conversions','conversions'],['Clicks','clicks'],['Impressions','impressions']];
const RATIO_COLUMNS=[['ACoS','acos','%'],['TACoS','tacos','%'],['ROAS','roas','x'],['CVR','cvr','%']];
const Summary=({summary,title})=><Card size="small" title={title+' | '+summary.currency} style={{marginBottom:10}}>
    <Row gutter={[12,12]}>
        {[...METRIC_COLUMNS.slice(0,3),['Total orders','totalOrders']].map(([label,key,money])=><Col xs={12} md={6} key={key}>
            <Typography.Text type="secondary">{label}</Typography.Text><div style={{fontSize:19,fontWeight:600,overflowWrap:'anywhere'}}>{amount(summary.totals[key],money?summary.currency:null)}</div>{coverageLabel(summary.coverage[key])}
        </Col>)}
        {RATIO_COLUMNS.map(([label,key,suffix])=><Col xs={12} md={6} key={key}><Typography.Text type="secondary">{label}</Typography.Text><div style={{fontSize:19,fontWeight:600}}>{ratioValue(summary.ratios[key],suffix)}</div>{coverageLabel(summary.ratios[key])}</Col>)}
    </Row>
    <Typography.Text type="secondary">Source rows: {summary.rowCount}. Unmapped or ambiguous catalog rows: {summary.unmappedRows}.</Typography.Text>
</Card>;
const TrendTable=({series})=>series.length===0?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No historical records in this period"/>:<div className="ads-table-shell" data-testid="ads-trend-table"><Table tableLayout="fixed" size="small" rowKey={r=>JSON.stringify([r.currency,r.periodKey,r.bucket])} dataSource={series} pagination={{pageSize:10}} scroll={{x:760}}
    columns={[{title:'Period',dataIndex:'periodKey',width:100},{title:'Date / bucket',dataIndex:'bucket',width:125},{title:'Currency',dataIndex:'currency',width:90},
        {title:'Ad spend',width:120,render:(_,r)=>amount(r.totals.spend,r.currency)},{title:'Ad sales',width:120,render:(_,r)=>amount(r.totals.sales,r.currency)},
        {title:'Total sales',width:125,render:(_,r)=>amount(r.totals.totalSales,r.currency)},{title:'ACoS',width:90,render:(_,r)=>ratioValue(r.ratios.acos)}]}/></div>;

export default function CanonicalAdsWorkspace(){
    const {user}=useAuth();
    // Match requirePermission on the API: effective grants and wildcard only.
    // Global seller scope or a role label is not a permission grant.
    const permissions=Array.isArray(user?.permissions)?user.permissions:[];
    const hasPermission=permission=>permissions.includes('*')||permissions.includes(permission);
    const {startDate,endDate,openPicker,updateDateRange}=useDateRange();
    const {setPageTitle}=usePageTitle();
    useEffect(()=>{setPageTitle('Ads Intelligence');},[setPageTitle]);
    const [seller,setSeller]=useState(undefined);
    const [brand,setBrand]=useState(undefined);
    const [category,setCategory]=useState(undefined);
    const [currency,setCurrency]=useState(undefined);
    const [groupBy,setGroupBy]=useState('asin');
    const [granularity,setGranularity]=useState('day');
    const [search,setSearch]=useState('');
    const [searchInput,setSearchInput]=useState('');
    const [sort,setSort]=useState({sortBy:'totalSales',sortOrder:'desc'});
    const [paging,setPaging]=useState({key:'',page:1,limit:50});
    const [drill,setDrill]=useState(null);
    const [requestedReview,setRequestedReview]=useState(null);
    const [importOpen,setImportOpen]=useState(false);
        const [exportBusy,setExportBusy]=useState(false);
    const [exportError,setExportError]=useState(null);
    // Include principal and current scope in the client cache key. No stale
    // placeholder data is used across filters, pages, or account changes.
    const principal=JSON.stringify([user?._id||user?.Id||user?.id,user?.role?.name||user?.role?.Name||user?.role,user?.assignedSellers,user?.permissions]);
    const enabled=!!user&&hasPermission(PERMISSIONS.ADSREPORT_VIEW);
    const options=useQuery({queryKey:['ads-canonical',principal,'options',seller],queryFn:({signal})=>get('canonical-options',{sellerId:seller},signal),enabled,staleTime:0,retry:false});
    const filters=useMemo(()=>({startDate:iso(startDate),endDate:iso(endDate),sellerId:seller,brand,category,currency,groupBy,granularity,search:search||undefined,...sort}),[startDate,endDate,seller,brand,category,currency,groupBy,granularity,search,sort]);
    const signature=JSON.stringify([principal,filters]);
    const page=paging.key===signature?paging.page:1,limit=paging.limit;
    const report=useQuery({queryKey:['ads-canonical',principal,'report',filters,page,limit],queryFn:({signal})=>get('canonical-report',{...filters,page,limit},signal),enabled:enabled&&!!filters.startDate&&!!filters.endDate,staleTime:0,retry:false});
    const drillTarget=drill?.signature===signature?drill.row:null;
    const drillGrouping=drill?.groupBy||groupBy;
    const history=useQuery({queryKey:['ads-canonical',principal,'history',filters,drillGrouping,drillTarget?.key],queryFn:({signal})=>get('canonical-report',{...filters,groupBy:drillGrouping,granularity:'day',sellerId:drillTarget.sellerId,marketplace:drillTarget.marketplace,currency:drillTarget.currency,entityKey:drillTarget.entityKey,page:1},signal),enabled:enabled&&!!drillTarget,staleTime:0,retry:false});
    const reviewFilters={startDate:filters.startDate,endDate:filters.endDate,sellerId:seller,brand,category,currency,search:search||undefined,groupBy:'asin'};
    const reviewSignature=JSON.stringify([principal,reviewFilters]);
    const reviewRequested=requestedReview===reviewSignature;
    const review=useQuery({queryKey:['ads-canonical',principal,'review',reviewFilters],queryFn:({signal})=>get('canonical-insights',reviewFilters,signal),enabled:enabled&&reviewRequested&&!!filters.startDate&&!!filters.endDate,staleTime:0,retry:false,refetchOnWindowFocus:false});
    const analyze=()=>{if(reviewRequested)review.refetch();else setRequestedReview(reviewSignature);};
    const targetFilters={sellerId:seller,startDate:filters.startDate,endDate:filters.endDate,currency};
    const targetsApplicable=!brand&&!category&&!search;
    const targets=useQuery({queryKey:['ads-canonical',principal,'targets',targetFilters],queryFn:({signal})=>get('canonical-targets',targetFilters,signal),enabled:enabled&&targetsApplicable&&!!filters.startDate&&!!filters.endDate,staleTime:0,retry:false});
    const data=report.data;
    const exportReport=async()=>{
        setExportBusy(true);setExportError(null);
        try{
            const res=await apiClient.get('/ads/canonical-export',{params:filters,responseType:'blob',timeout:180000});
            const blob=res.data;
            if(!String(res.headers['content-type']||'').includes('spreadsheetml'))throw Error('Unexpected export response.');
            const url=URL.createObjectURL(blob),a=document.createElement('a');
            a.href=url;a.download='ads-intelligence-'+filters.startDate+'-'+filters.endDate+'.xlsx';
            document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
        }catch(e){
            let detail=e?.response?.data;
            if(detail instanceof Blob){try{detail=JSON.parse(await detail.text());}catch{detail=null;}}
            setExportError(detail?.message||e.message||'Export failed.');
        }finally{setExportBusy(false);}
    };
    const imported=info=>{
        // Keep the completed modal visible. Move the report to the imported seller/date
        // and invalidate all affected local queries after the committed response.
        setSeller(info.sellerId||undefined);setBrand(undefined);setCategory(undefined);setCurrency(info.currency);
        setSearch('');setSearchInput('');setDrill(null);setRequestedReview(null);setPaging({key:'',page:1,limit:50});
        const end=new Date(info.endDate+'T00:00:00'),start=new Date(info.startDate+'T00:00:00');
        const earliest=new Date(end);earliest.setDate(earliest.getDate()-365);
        updateDateRange({startDate:start<earliest?earliest:start,endDate:end,rangeType:'custom'});
        refresh();
    };
    const choices=options.data||{};
    const columns=[
        {title:groupBy==='seller'?'Seller':groupBy==='parent'?'Parent ASIN':'ASIN',key:'entityKey',fixed:'left',width:200,className:'ads-pinned-cell',onCell:()=>({className:'ads-pinned-cell','data-testid':'ads-pinned-product'}),onHeaderCell:()=>({className:'ads-pinned-cell'}),sorter:true,render:(_,r)=><><Button type="link" className="ads-entity-link" onClick={()=>setDrill({signature,row:r})}>{r.entityKey}</Button><div style={{fontSize:12,overflowWrap:'anywhere'}}>{r.title||r.sellerName}</div></>},
        {title:'Seller / marketplace',width:180,render:(_,r)=><>{r.sellerName}<div style={{fontSize:12}}>{r.marketplace} | {r.currency}</div></>},
        ...METRIC_COLUMNS.map(([title,key,money])=>({title,key,width:145,sorter:true,render:(_,r)=><>{amount(r.current?.totals?.[key],money?r.currency:null)}<div style={{fontSize:11,color:'var(--ant-color-text-secondary,#777)'}}>Prior: {amount(r.previous?.totals?.[key],money?r.currency:null)}</div>{coverageLabel(r.current?.coverage?.[key])}<DeltaText change={r.comparison?.metrics?.[key]} money={money} currency={r.currency}/></>})),
        ...RATIO_COLUMNS.map(([title,key,suffix])=>({title,key,width:125,render:(_,r)=><>{ratioValue(r.current?.ratios?.[key],suffix)}<div style={{fontSize:11}}>Prior: {ratioValue(r.previous?.ratios?.[key],suffix)}</div>{coverageLabel(r.current?.ratios?.[key])}<DeltaText change={r.comparison?.ratios?.[key]} currency={r.currency}/></>}))
    ].map(c=>({...c,sortOrder:c.key===sort.sortBy?(sort.sortOrder==='asc'?'ascend':'descend'):undefined}));
    const selector=(label,values,value,onChange)=><Select aria-label={label} placeholder={label} allowClear showSearch value={value} onChange={onChange} className="ads-filter-select" options={(values||[]).map(v=>({value:v,label:v}))}/>;
    const refresh=()=>{options.refetch();report.refetch();if(targetsApplicable)targets.refetch();if(drillTarget)history.refetch();if(reviewRequested)review.refetch();};
    if(!enabled)return <Alert type="warning" message="Advertising view permission is required." showIcon/>;
    return <div className="ads-workspace" data-testid="ads-workspace">
        <Card size="small" className="ads-heading-card"><div className="ads-heading">
            <div className="ads-heading-copy"><Typography.Title level={4} style={{margin:0}}>Ads Intelligence</Typography.Title><Typography.Text type="secondary">Daily advertising and product performance</Typography.Text></div>
            <div className="ads-heading-actions">{hasPermission(PERMISSIONS.ADSREPORT_IMPORT)&&<Button type="primary" onClick={()=>{setImportOpen(true);}}>Import CSV</Button>}{hasPermission(PERMISSIONS.ADSREPORT_EXPORT)&&<Button onClick={exportReport} loading={exportBusy} disabled={!data||report.isError||report.isFetching}>Export XLSX</Button>}<Button onClick={refresh} loading={report.isFetching}>Refresh</Button></div>
        </div></Card>
        <Alert showIcon type="info" message="Advertising report data" description="Totals use the original report values. Currency groups are separate. Validate a CSV before confirming an import."/>
        {exportError&&<Alert type="error" showIcon message={exportError} closable onClose={()=>setExportError(null)}/>} 
        <Card size="small" className="ads-filter-card"><div className="ads-filters" data-testid="ads-filters">
            <Select aria-label="Seller" placeholder="All accessible sellers" allowClear showSearch optionFilterProp="label" value={seller} loading={options.isFetching} className="ads-filter-seller"
                options={(choices.sellers||[]).map(s=>({value:s.id,label:s.name||s.id}))} onChange={v=>{setSeller(v);setBrand(undefined);setCategory(undefined);setCurrency(undefined);}}/>
            {selector('Brand',choices.brands,brand,setBrand)}{selector('Category',choices.categories,category,setCategory)}{selector('Currency',choices.currencies,currency,setCurrency)}
            <Select className="ads-filter-compact" aria-label="Group by" value={groupBy} onChange={setGroupBy} options={[{value:'asin',label:'ASIN'},{value:'parent',label:'Parent ASIN',disabled:choices.parentAvailable!==true},{value:'seller',label:'Seller'}]}/>
            <Select className="ads-filter-compact" aria-label="Trend granularity" value={granularity} onChange={setGranularity} options={[{value:'day',label:'Daily'},{value:'week',label:'Weekly'},{value:'month',label:'Monthly'}]}/>
            <Button className="ads-date-button" onClick={openPicker}>{filters.startDate} to {filters.endDate}</Button>
            <Input.Search aria-label="Search products" placeholder="ASIN, SKU or title" maxLength={120} allowClear value={searchInput} onChange={e=>{setSearchInput(e.target.value);if(!e.target.value)setSearch('');}} onSearch={setSearch} className="ads-filter-search"/>
        </div>{options.isError&&<Alert style={{marginTop:10}} type="error" message={errorText(options.error)} action={<Button onClick={()=>options.refetch()}>Retry</Button>}/>}
        {choices.truncated&&<Typography.Paragraph className="ads-filter-note" type="secondary">Filter options are capped; select a seller to narrow catalog choices.</Typography.Paragraph>}</Card>
        {report.isError?<Alert type="error" showIcon message={errorText(report.error)} action={<Button onClick={()=>report.refetch()}>Retry</Button>}/>:report.isPending?<Card><Spin/> Loading canonical report…</Card>:data&&<>
            <Typography.Text className="ads-period-note" type="secondary">Current: {data.period.startDate} to {data.period.endDate}. Previous: {data.period.prevStart} to {data.period.prevEnd}.</Typography.Text>
            {data.empty?<Card className="ads-empty-card"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No canonical advertising records in the selected dates.">{hasPermission(PERMISSIONS.ADSREPORT_IMPORT)&&<Button type="primary" onClick={()=>{setImportOpen(true);}}>Import a report</Button>}</Empty></Card>:<>
                <div className="ads-summary-grid">{[...new Set([...data.current,...data.previous].map(s=>s.currency))].map(c=><div className="ads-summary-group" key={c}>
                    {data.current.find(s=>s.currency===c)?<Summary summary={data.current.find(s=>s.currency===c)} title="Current"/>:<Card size="small">No current {c} data</Card>}
                    {data.previous.find(s=>s.currency===c)?<Summary summary={data.previous.find(s=>s.currency===c)} title="Previous"/>:<Card size="small">No previous {c} data</Card>}
                </div>)}</div>
                <AdsComparisonPanel report={data}/>
                <AdsOpportunityPanel review={review} requested={reviewRequested} onAnalyze={analyze} days={data.period.days} onOpen={row=>setDrill({signature,row,groupBy:'asin'})}/>
                <Card size="small" title="Historical comparison"><TrendTable series={data.series}/></Card>
                <Card size="small" title={'Product and seller analytics ('+data.total+' entities)'}>
                    <div className="ads-table-shell" data-testid="ads-product-table"><Table tableLayout="fixed" rowKey="key" columns={columns} dataSource={data.rows} size="small" sticky scroll={{x:2300,y:520}} loading={report.isFetching}
                        pagination={{current:data.page,pageSize:data.limit,total:data.total,showSizeChanger:true,pageSizeOptions:[25,50,100]}}
                        onChange={(p,_f,s,extra)=>{
                            if(extra.action==='sort'){
                                setSort({sortBy:s.order?s.columnKey:'totalSales',sortOrder:s.order==='ascend'?'asc':'desc'});
                                setPaging({key:'',page:1,limit:p.pageSize||limit});
                            }else if(extra.action==='paginate')setPaging({key:signature,page:p.pageSize!==limit?1:p.current,limit:p.pageSize});
                        }}/></div>
                </Card>
            </>}
        </>}
        <Card size="small" title="Seller targets & budgets">
            {!targetsApplicable?<Alert type="info" message="Clear brand, category and product search to compare seller-wide targets."/>:targets.isError?<Alert type="error" message={errorText(targets.error)} action={<Button onClick={()=>targets.refetch()}>Retry</Button>}/>:targets.isPending?<div className="ads-inline-loading"><Spin size="small"/> Loading seller targets…</div>:!targets.data?.rows?.length?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No seller targets in the selected period"/>:<div className="ads-table-shell" data-testid="ads-target-table"><Table tableLayout="fixed" size="small" loading={targets.isFetching} rowKey={r=>JSON.stringify([r.sellerId,r.month,r.goalType])} dataSource={targets.data.rows} pagination={{pageSize:10}} scroll={{x:960}}
                columns={[{title:'Seller',dataIndex:'sellerName',width:180},{title:'Month',dataIndex:'month',width:110},{title:'Metric',dataIndex:'goalType',width:90},
                    {title:'Target',width:130,render:(_,r)=>r.goalType==='ACOS'?(r.target==null?'N/A':r.target+'%'):amount(r.target,r.currency)},
                    {title:'Observed actual',width:150,render:(_,r)=>r.goalType==='ACOS'?(r.actual==null?'N/A':r.actual+'%'):amount(r.actual,r.currency)},
                    {title:'Actual / target',width:130,render:(_,r)=>r.attainmentPct==null?'N/A':r.attainmentPct+'%'},
                    {title:'Status',dataIndex:'status',width:170,render:s=><Tag>{s.replaceAll('_',' ')}</Tag>}]}/></div>}
            <Typography.Text className="ads-period-note" type="secondary">Targets are full-calendar-month allocations. Partial date windows and incomplete coverage do not receive an attainment claim. Lower ACoS is better.</Typography.Text>
        </Card>
        <Drawer rootClassName="ads-history-drawer" title={drillTarget?drillTarget.entityKey+' | '+drillTarget.sellerName:'Product history'} open={!!drillTarget} onClose={()=>setDrill(null)} width="min(900px, 95vw)">
            {history.isError?<Alert type="error" message={errorText(history.error)} action={<Button onClick={()=>history.refetch()}>Retry</Button>}/>:history.isPending?<Spin/>:history.data&&<>
                {history.data.current.map(s=><Summary key={'cur'+s.currency} summary={s} title="Current"/>)}{history.data.previous.map(s=><Summary key={'prev'+s.currency} summary={s} title="Previous"/>)}<AdsComparisonPanel report={history.data}/><TrendTable series={history.data.series}/>
            </>}
        </Drawer>
        {hasPermission(PERMISSIONS.ADSREPORT_IMPORT)&&<AdsImportModal isOpen={importOpen} onClose={()=>setImportOpen(false)} onComplete={imported}/>}
    </div>;
}
