import React,{useMemo,useState,useEffect} from 'react';
import {Button,Card,Checkbox,Drawer,Empty,Flex,Grid,Popover,Segmented,Select,Space,Table,Tag,Tooltip,Typography} from 'antd';
import {InfoCircleOutlined,LeftOutlined,RightOutlined,SettingOutlined} from '@ant-design/icons';
import dayjs from 'dayjs';
import {METRICS,metricValue,changeLabel,changeTone,formatMoney,formatCount,isKnown,matrixPeriods,monthKeys,visibleMonth} from './gmsPresentation.mjs';

const {Text}=Typography;
const defaultMetrics=['orderedRevenue','orderedUnits','shippedRevenue','profit','customerReturns','returnRatio'];
const metricByKey=key=>METRICS.find(m=>m.key===key);
const emptyGroups=Object.freeze({});
const revenueMetric={kind:'money'};
function valueCell(m,value){
  return <span className={'gms-number'+(isKnown(value)&&value<0?' gms-number--negative':'')}>{metricValue(m,value)}</span>;
}
function trendCell(m,value){
  const label=changeLabel(m,value);
  return label==null?<Text type="secondary">N/A</Text>:<Tag color={changeTone(m,value)}>{label}</Tag>;
}
function RowDetail({row,level,onClose}){
  const coverage=row?.periodCoverage;
  return <Drawer open={!!row} onClose={onClose} title={level==='asin'?'ASIN financial details':'Seller financial details'} width="min(680px,100vw)">
    {row&&<Flex vertical gap={14}>
      <div>
        <Typography.Title level={4} style={{margin:'0 0 4px'}}>{level==='asin'?row.asin:row.dbBrand||'-'}</Typography.Title>
        {level==='asin'&&<Text>{row.productTitle||'Product title unavailable'}</Text>}
      </div>
      <div className="gms-detail-meta">
        <span><Text type="secondary">Seller (DB)</Text><br/>{row.dbBrand||'-'}</span>
        <span><Text type="secondary">Brand (Sheet)</Text><br/>{row.brand||'-'}</span>
        <span><Text type="secondary">Store code</Text><br/>{row.storeCode||'-'}</span>
        <span><Text type="secondary">Mapping</Text><br/><Tag color={row.isUnmatched?'warning':'success'}>{row.isUnmatched?'Unmatched':'Matched'}</Tag></span>
      </div>
      {coverage&&<Text type="secondary">Observed dates: {coverage.currentDays}/{coverage.expectedDays??coverage.currentDays} current, {coverage.priorDays}/{coverage.expectedDays??0} prior. {coverage.comparable?'Equal-length comparison available.':'Comparison unavailable where coverage is incomplete.'}</Text>}
      <div className="gms-compare-scroll"><table className="gms-compare-table"><thead><tr><th>Metric</th><th>Current</th><th>Prior</th><th>Change</th></tr></thead><tbody>
        {METRICS.map(m=><tr key={m.key}><th scope="row">{m.label}</th><td>{metricValue(m,row[m.key])}</td><td>{metricValue(m,row.periodBaseline?.[m.key])}</td><td>{changeLabel(m,row.periodChanges?.[m.key])??'N/A'}</td></tr>)}
      </tbody></table></div>
      <Text type="secondary">These are selected-period totals, not estimates. Missing values are displayed as N/A.</Text>
    </Flex>}
  </Drawer>;
}
export default function GmsMatrix({analytics,loading,level,onLevelChange,page,pageSize,sortKey,sortDirection,onPageChange,onSortChange}){
  const screens=Grid.useBreakpoint();
  const [granularity,setGranularity]=useState('summary');
  const [month,setMonth]=useState(null);
  const [showTrends,setShowTrends]=useState(true);
  const [metricKeys,setMetricKeys]=useState(defaultMetrics);
  const [detail,setDetail]=useState(null);
  const groups=analytics?.monthGroups||emptyGroups;
  const keys=useMemo(()=>monthKeys(groups),[groups]);
  const activeMonth=visibleMonth(groups,month);
  const activeYear=activeMonth?.slice(0,4);
  const years=useMemo(()=>[...new Set(keys.map(k=>k.slice(0,4)))],[keys]);
  const periods=useMemo(()=>matrixPeriods(groups,granularity,activeMonth).filter(p=>granularity!=='month'||p.key.startsWith(activeYear)),[groups,granularity,activeMonth,activeYear]);
  const monthIndex=keys.indexOf(activeMonth);
  const rows=analytics?.matrixRows||[];
  const total=analytics?.pagination?.totalRows??0;
  const fixed=Boolean(screens.lg);
  const columns=useMemo(()=>{
    const sortable=key=>({key,sorter:true,sortOrder:sortKey===key?(sortDirection==='asc'?'ascend':'descend'):null});
    const identity=[
      ...(level==='asin'?[{title:'ASIN',dataIndex:'asin',...sortable('asin'),width:218,fixed:fixed?'left':undefined,
        render:(v,r)=><div className="gms-product-cell"><Button type="link" className="gms-row-link" aria-label={'View ASIN '+v+' details'} onClick={()=>setDetail(r)}>{v||'-'}</Button><Tooltip title={r.productTitle||'Product title unavailable'}><span className="gms-product-title">{r.productTitle||'-'}</span></Tooltip></div>}]:[]),
      {title:'Seller (DB)',dataIndex:'dbBrand',...sortable('dbBrand'),width:level==='seller'?190:158,fixed:fixed&&level==='seller'?'left':undefined,
        render:(v,r)=><div className="gms-product-cell">{level==='seller'?<Button type="link" className="gms-row-link" onClick={()=>setDetail(r)}>{v||'-'}</Button>:<Text>{v||'-'}</Text>}{r.isUnmatched&&<Tag color="warning">Unmatched</Tag>}</div>},
      {title:'Brand (Sheet)',dataIndex:'brand',...sortable('brand'),width:142,ellipsis:{showTitle:true}},
    ];
    const metrics=metricKeys.map(metricByKey).filter(Boolean).map(m=>({
      title:m.key==='orderedRevenue'?'Period Revenue':m.label,dataIndex:m.key,...sortable(m.key),width:m.kind==='money'?148:126,align:'right',
      render:(v,r)=><div className="gms-matrix-value">{valueCell(m,v)}{showTrends&&granularity==='summary'&&r.periodChanges?.[m.key]!=null&&<div>{trendCell(m,r.periodChanges[m.key])}</div>}</div>
    }));
    const periodCols=periods.map(p=>({
      title:p.type==='day'?dayjs(p.label).format('DD MMM'):p.label,key:'group-'+p.key,
      children:[
        {title:'Revenue',...sortable(p.sortKey),width:142,align:'right',render:(_,r)=>valueCell(revenueMetric,r[p.revenueMap]?.[p.key])},
        ...(showTrends?[{title:<Tooltip title={p.type==='month'?'Previous complete calendar month':p.type==='week'?'Corresponding calendar segment seven days earlier':'Preceding calendar day'}>{p.trendLabel}</Tooltip>,key:'change-'+p.key,width:94,align:'right',render:(_,r)=>trendCell(revenueMetric,r[p.trendMap]?.[p.key])}]:[])
      ]
    }));
    return [...identity,...metrics,...periodCols];
  },[level,periods,showTrends,fixed,sortKey,sortDirection,metricKeys,granularity]);
  const width=columns.reduce((n,c)=>n+(c.children?c.children.reduce((m,x)=>m+x.width,0):c.width),0);
  useEffect(()=>{
    if(loading||!analytics)return;
    const isPeriod=/^(day-|week-total-|month-total-)/.test(sortKey);
    const hidden=isPeriod&&!periods.some(p=>p.sortKey===sortKey)||METRICS.some(m=>m.key===sortKey)&&!metricKeys.includes(sortKey);
    if(hidden)onSortChange({key:'orderedRevenue',direction:'desc'});
  },[loading,analytics,periods,sortKey,onSortChange,metricKeys]);
  useEffect(()=>{setDetail(null);},[analytics,level]);
  const controls=<Flex vertical gap={10} className="gms-columns-popover">
    <Text strong>Financial columns</Text>
    <Text type="secondary">Period Revenue always stays visible.</Text>
    <Checkbox.Group value={metricKeys} onChange={keys=>setMetricKeys(METRICS.filter(m=>m.key==='orderedRevenue'||keys.includes(m.key)).map(m=>m.key))}>
      <Flex vertical gap={6}>{METRICS.map(m=><Checkbox key={m.key} value={m.key} disabled={m.key==='orderedRevenue'}>{m.label}</Checkbox>)}</Flex>
    </Checkbox.Group>
    <Button size="small" onClick={()=>setMetricKeys(defaultMetrics)}>Reset columns</Button>
  </Flex>;
  return <Card id="panel-matrix" size="small" className="gms-matrix-card" title={<Flex gap={8} align="center" wrap><span>Revenue matrix</span><Text type="secondary" className="gms-row-count">{formatCount(total)} {level==='asin'?'ASINs':'groups'}</Text></Flex>}
    extra={<Tooltip title="All selected-period financial totals are computed by the server. N/A is missing data; zeros are actual reported values."><InfoCircleOutlined/></Tooltip>}>
    <Flex vertical gap={10}>
      <Flex align="center" justify="space-between" wrap gap={8} className="gms-matrix-tools">
        <Segmented aria-label="Row grouping" value={level} onChange={onLevelChange} options={[{label:'ASIN View',value:'asin'},{label:'Seller View',value:'seller'}]}/>
        <Segmented aria-label="Matrix granularity" value={granularity} onChange={setGranularity} options={[{label:'Summary',value:'summary'},{label:'Monthly',value:'month'},{label:'Weekly',value:'week'},{label:'Daily',value:'day'}]}/>
        <Space wrap size={6}>
          <Popover trigger="click" content={controls} placement="bottomRight"><Button icon={<SettingOutlined/>} aria-label="Choose financial columns">Columns</Button></Popover>
          <Button aria-pressed={showTrends} onClick={()=>setShowTrends(v=>!v)}>{showTrends?'Hide comparisons':'Show comparisons'}</Button>
        </Space>
      </Flex>
      <Flex align="center" wrap gap={8} className="gms-matrix-hint">
        {granularity==='month'&&years.length>1&&<Select size="small" aria-label="Matrix year" value={activeYear} options={years.map(year=>({label:year,value:year}))} onChange={year=>setMonth(keys.filter(key=>key.startsWith(year)).at(-1))}/>}
        {['week','day'].includes(granularity)&&<>
          <Button size="small" aria-label="Previous matrix month" icon={<LeftOutlined/>} disabled={monthIndex<=0} onClick={()=>setMonth(keys[monthIndex-1])}/>
          <Select size="small" aria-label="Matrix month" placeholder="Select month" style={{minWidth:155}} value={activeMonth??undefined} onChange={setMonth} options={keys.map(key=>({label:groups[key].label,value:key}))}/>
          <Button size="small" aria-label="Next matrix month" icon={<RightOutlined/>} disabled={monthIndex<0||monthIndex>=keys.length-1} onClick={()=>setMonth(keys[monthIndex+1])}/>
        </>}
        <Text type="secondary">{granularity==='summary'?'Selected-period financial totals. Select an ASIN or seller for details.':granularity==='month'?'Observed months in '+(activeYear||'the selected year')+'.':granularity==='week'?'Non-overlapping week segments.':'Observed dates in the selected month.'} Sorting applies to the full report.</Text>
      </Flex>
      <div className="gms-matrix-scroll">
        <Table size="small" rowKey="key" columns={columns} dataSource={rows} loading={loading} tableLayout="fixed"
          scroll={{x:Math.max(width,800),y:Math.max(240,Math.min(560,typeof window==='undefined'?480:window.innerHeight-395))}}
          locale={{emptyText:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matching matrix rows"/>}}
          pagination={{current:analytics?.pagination?.page??page,pageSize,total,showSizeChanger:true,pageSizeOptions:[25,50,100],size:'small',showTotal:(n,range)=>range[0]+'-'+range[1]+' of '+n.toLocaleString('en-IN')+' rows'}}
          onChange={(pagination,_filters,sorter,extra)=>{
            if(extra.action==='sort'){
              const next=Array.isArray(sorter)?sorter[0]:sorter;
              onSortChange(next?.order?{key:String(next.columnKey),direction:next.order==='ascend'?'asc':'desc'}:{key:'orderedRevenue',direction:'desc'});
            }else if(extra.action==='paginate')onPageChange(Number(pagination.current||1),Number(pagination.pageSize||50));
          }}/>
      </div>
    </Flex>
    <RowDetail row={detail} level={level} onClose={()=>setDetail(null)}/>
  </Card>;
}
