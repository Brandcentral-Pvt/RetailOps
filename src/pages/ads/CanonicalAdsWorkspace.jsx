import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Drawer, Empty, Input, Row, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useDateRange } from '../../contexts/DateRangeContext';
import { usePageTitle } from '../../contexts/PageTitleContext';
import { apiClient } from '../../lib/api-client';
import AdsImportModal from '../../components/ads/AdsImportModal';

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
const TrendTable=({series})=><Table size="small" rowKey={r=>JSON.stringify([r.currency,r.periodKey,r.bucket])} dataSource={series} pagination={{pageSize:10}} scroll={{x:760}}
    columns={[{title:'Period',dataIndex:'periodKey'},{title:'Date / bucket',dataIndex:'bucket'},{title:'Currency',dataIndex:'currency'},
        {title:'Ad spend',render:(_,r)=>amount(r.totals.spend,r.currency)},{title:'Ad sales',render:(_,r)=>amount(r.totals.sales,r.currency)},
        {title:'Total sales',render:(_,r)=>amount(r.totals.totalSales,r.currency)},{title:'ACoS',render:(_,r)=>ratioValue(r.ratios.acos)}]}/>;

export default function CanonicalAdsWorkspace({onLegacy}){
    const {user,hasPermission}=useAuth();
    const {startDate,endDate,openPicker}=useDateRange();
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
    const [importOpen,setImportOpen]=useState(false);
    // Include principal and current scope in the client cache key. No stale
    // placeholder data is used across filters, pages, or account changes.
    const principal=JSON.stringify([user?._id||user?.Id||user?.id,user?.role?.name||user?.role?.Name||user?.role,user?.assignedSellers,user?.permissions]);
    const enabled=!!user&&hasPermission('adsreport_view');
    const options=useQuery({queryKey:['ads-canonical',principal,'options',seller],queryFn:({signal})=>get('canonical-options',{sellerId:seller},signal),enabled,staleTime:0,retry:false});
    const filters=useMemo(()=>({startDate:iso(startDate),endDate:iso(endDate),sellerId:seller,brand,category,currency,groupBy,granularity,search:search||undefined,...sort}),[startDate,endDate,seller,brand,category,currency,groupBy,granularity,search,sort]);
    const signature=JSON.stringify([principal,filters]);
    const page=paging.key===signature?paging.page:1,limit=paging.limit;
    const report=useQuery({queryKey:['ads-canonical',principal,'report',filters,page,limit],queryFn:({signal})=>get('canonical-report',{...filters,page,limit},signal),enabled:enabled&&!!filters.startDate&&!!filters.endDate,staleTime:0,retry:false});
    const drillTarget=drill?.signature===signature?drill.row:null;
    const history=useQuery({queryKey:['ads-canonical',principal,'history',filters,drillTarget?.key],queryFn:({signal})=>get('canonical-report',{...filters,granularity:'day',sellerId:drillTarget.sellerId,marketplace:drillTarget.marketplace,currency:drillTarget.currency,entityKey:drillTarget.entityKey,page:1},signal),enabled:enabled&&!!drillTarget,staleTime:0,retry:false});
    const data=report.data;
    const choices=options.data||{};
    const columns=[
        {title:groupBy==='seller'?'Seller':groupBy==='parent'?'Parent ASIN':'ASIN',key:'entityKey',fixed:'left',width:240,sorter:true,render:(_,r)=><><Button type="link" style={{padding:0}} onClick={()=>setDrill({signature,row:r})}>{r.entityKey}</Button><div style={{fontSize:12,overflowWrap:'anywhere'}}>{r.title||r.sellerName}</div></>},
        {title:'Seller / marketplace',width:180,render:(_,r)=><>{r.sellerName}<div style={{fontSize:12}}>{r.marketplace} | {r.currency}</div></>},
        ...METRIC_COLUMNS.map(([title,key,money])=>({title,key,width:145,sorter:true,render:(_,r)=><>{amount(r.current?.totals?.[key],money?r.currency:null)}<div style={{fontSize:11,color:'var(--ant-color-text-secondary,#777)'}}>Prior: {amount(r.previous?.totals?.[key],money?r.currency:null)}</div>{coverageLabel(r.current?.coverage?.[key])}</>})),
        ...RATIO_COLUMNS.map(([title,key,suffix])=>({title,key,width:125,render:(_,r)=><>{ratioValue(r.current?.ratios?.[key],suffix)}<div style={{fontSize:11}}>Prior: {ratioValue(r.previous?.ratios?.[key],suffix)}</div>{coverageLabel(r.current?.ratios?.[key])}</>}))
    ].map(c=>({...c,sortOrder:c.key===sort.sortBy?(sort.sortOrder==='asc'?'ascend':'descend'):undefined}));
    const selector=(label,values,value,onChange)=><Select aria-label={label} placeholder={label} allowClear showSearch value={value} onChange={onChange} style={{minWidth:155}} options={(values||[]).map(v=>({value:v,label:v}))}/>;
    const refresh=()=>{options.refetch();report.refetch();if(drillTarget)history.refetch();};
    if(!enabled)return <Alert type="warning" message="Advertising view permission is required." showIcon/>;
    return <div className="ops ads-page" style={{display:'grid',gap:12}}>
        <Card size="small"><Space wrap style={{width:'100%',justifyContent:'space-between'}}>
            <Space direction="vertical" size={2}><Typography.Title level={4} style={{margin:0}}>Ads Intelligence</Typography.Title><Typography.Text type="secondary">Canonical daily product reports · source contract v1</Typography.Text></Space>
            <Space wrap>{hasPermission('adsreport_import')&&<Button onClick={()=>setImportOpen(true)}>Validate CSV</Button>}<Button onClick={refresh} loading={report.isFetching}>Refresh</Button><Button onClick={onLegacy}>Legacy workspace</Button></Space>
        </Space></Card>
        <Alert showIcon type="info" message="Canonical analytics cutover"
            description="Totals use explicit source values; currencies are never combined. Imports, canonical targets, AI review and full workbook export remain gated until their migration and reconciliation are complete. The legacy workspace is separate."/>
        <Card size="small"><Space wrap>
            <Select aria-label="Seller" placeholder="All accessible sellers" allowClear showSearch optionFilterProp="label" value={seller} loading={options.isFetching} style={{minWidth:200}}
                options={(choices.sellers||[]).map(s=>({value:s.id,label:s.name||s.id}))} onChange={v=>{setSeller(v);setBrand(undefined);setCategory(undefined);setCurrency(undefined);}}/>
            {selector('Brand',choices.brands,brand,setBrand)}{selector('Category',choices.categories,category,setCategory)}{selector('Currency',choices.currencies,currency,setCurrency)}
            <Select aria-label="Group by" value={groupBy} onChange={setGroupBy} options={[{value:'asin',label:'ASIN'},{value:'parent',label:'Parent ASIN',disabled:choices.parentAvailable!==true},{value:'seller',label:'Seller'}]}/>
            <Select aria-label="Trend granularity" value={granularity} onChange={setGranularity} options={[{value:'day',label:'Daily'},{value:'week',label:'Weekly'},{value:'month',label:'Monthly'}]}/>
            <Button onClick={openPicker}>{filters.startDate} to {filters.endDate}</Button>
            <Input.Search aria-label="Search products" placeholder="ASIN, SKU or title" maxLength={120} allowClear value={searchInput} onChange={e=>{setSearchInput(e.target.value);if(!e.target.value)setSearch('');}} onSearch={setSearch} style={{width:235}}/>
        </Space>{options.isError&&<Alert style={{marginTop:10}} type="error" message={errorText(options.error)} action={<Button onClick={()=>options.refetch()}>Retry</Button>}/>}
        {choices.truncated&&<Typography.Text type="secondary"> Filter options are capped; use an explicit seller to narrow catalog choices.</Typography.Text>}</Card>
        {report.isError?<Alert type="error" showIcon message={errorText(report.error)} action={<Button onClick={()=>report.refetch()}>Retry</Button>}/>:report.isPending?<Card><Spin/> Loading canonical report…</Card>:data&&<>
            <Typography.Text type="secondary">Current: {data.period.startDate} to {data.period.endDate}. Previous: {data.period.prevStart} to {data.period.prevEnd}.</Typography.Text>
            {data.empty?<Card><Empty description="No canonical advertising records in the selected dates. Validate a report while ingestion remains gated."/></Card>:<>
                <Row gutter={[12,12]}>{[...new Set([...data.current,...data.previous].map(s=>s.currency))].map(c=><Col xs={24} xl={12} key={c}>
                    {data.current.find(s=>s.currency===c)?<Summary summary={data.current.find(s=>s.currency===c)} title="Current"/>:<Card size="small">No current {c} data</Card>}
                    {data.previous.find(s=>s.currency===c)?<Summary summary={data.previous.find(s=>s.currency===c)} title="Previous"/>:<Card size="small">No previous {c} data</Card>}
                </Col>)}</Row>
                <Card size="small" title="Historical comparison"><TrendTable series={data.series}/></Card>
                <Card size="small" title={'Product and seller analytics ('+data.total+' entities)'}>
                    <Table rowKey="key" columns={columns} dataSource={data.rows} size="small" sticky scroll={{x:2500,y:520}} loading={report.isFetching}
                        pagination={{current:data.page,pageSize:data.limit,total:data.total,showSizeChanger:true,pageSizeOptions:[25,50,100]}}
                        onChange={(p,_f,s,extra)=>{
                            if(extra.action==='sort'){
                                setSort({sortBy:s.order?s.columnKey:'totalSales',sortOrder:s.order==='ascend'?'asc':'desc'});
                                setPaging({key:'',page:1,limit:p.pageSize||limit});
                            }else if(extra.action==='paginate')setPaging({key:signature,page:p.pageSize!==limit?1:p.current,limit:p.pageSize});
                        }}/>
                </Card>
            </>}
        </>}
        <Drawer title={drillTarget?drillTarget.entityKey+' | '+drillTarget.sellerName:'Product history'} open={!!drillTarget} onClose={()=>setDrill(null)} width="min(900px, 95vw)">
            {history.isError?<Alert type="error" message={errorText(history.error)} action={<Button onClick={()=>history.refetch()}>Retry</Button>}/>:history.isPending?<Spin/>:history.data&&<>
                {history.data.current.map(s=><Summary key={'cur'+s.currency} summary={s} title="Current"/>)}{history.data.previous.map(s=><Summary key={'prev'+s.currency} summary={s} title="Previous"/>)}<TrendTable series={history.data.series}/>
            </>}
        </Drawer>
        {hasPermission('adsreport_import')&&<AdsImportModal isOpen={importOpen} onClose={()=>setImportOpen(false)} selectedSeller={seller||null}/>}
    </div>;
}
