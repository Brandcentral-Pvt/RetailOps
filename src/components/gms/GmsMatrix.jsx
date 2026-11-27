import React,{useMemo,useState,useEffect} from 'react';
import {Badge,Button,Card,Empty,Flex,Grid,Segmented,Select,Space,Table,Tag,Tooltip,Typography} from 'antd';
import {InfoCircleOutlined,LeftOutlined,RightOutlined} from '@ant-design/icons';
import dayjs from 'dayjs';
import {changeLabel,formatMoney,formatCount,isKnown,matrixPeriods,monthKeys,visibleMonth} from './gmsPresentation.mjs';

const {Text}=Typography;
const revenueMetric={kind:'money'};
function revenueCell(value){
  return <span className={'gms-number'+(isKnown(value)&&value<0?' gms-number--negative':'')}>{isKnown(value)?formatMoney(value):<Text type="secondary">N/A</Text>}</span>;
}
function trendCell(value){
  const label=changeLabel(revenueMetric,value);
  return label==null?<Text type="secondary">N/A</Text>:<Tag color={value===0?'default':value>0?'success':'error'}>{label}</Tag>;
}
export default function GmsMatrix({analytics,loading,level,onLevelChange,page,pageSize,sortKey,sortDirection,onPageChange,onSortChange}){
  const screens=Grid.useBreakpoint();
  const [granularity,setGranularity]=useState('month');
  const [month,setMonth]=useState(null);
  const [showTrends,setShowTrends]=useState(true);
  const groups=analytics?.monthGroups||{};
  const keys=useMemo(()=>monthKeys(groups),[groups]);
  const activeMonth=visibleMonth(groups,month);
  const periods=useMemo(()=>matrixPeriods(groups,granularity,activeMonth),[groups,granularity,activeMonth]);
  const monthIndex=keys.indexOf(activeMonth);
  const rows=analytics?.matrixRows||[];
  const total=analytics?.pagination?.totalRows??0;
  const fixed=Boolean(screens.lg);
  const columns=useMemo(()=>{
    const sortable=(key)=>({key,sorter:true,sortOrder:sortKey===key?(sortDirection==='asc'?'ascend':'descend'):null});
    const identity=[
      ...(level==='asin'?[{title:'ASIN',dataIndex:'asin',...sortable('asin'),width:135,fixed:fixed?'left':undefined,
        render:(v,r)=><Tooltip title={r.productTitle&&r.productTitle!=='-'?r.productTitle:'Product title unavailable'}><Text strong className="gms-asin">{v||'-'}</Text></Tooltip>}]:[]),
      {title:'Seller (DB)',dataIndex:'dbBrand',...sortable('dbBrand'),width:190,fixed:fixed&&level==='seller'?'left':undefined,
        render:(v,r)=><Flex align="center" wrap gap={4}><Text>{v||'-'}</Text>{r.isUnmatched&&<Tag color="warning">Unmatched</Tag>}</Flex>},
      {title:'Brand (Sheet)',dataIndex:'brand',...sortable('brand'),width:160,ellipsis:{showTitle:true}},
      {title:'Store Code',dataIndex:'storeCode',...sortable('storeCode'),width:105,ellipsis:true},
      {title:'Ordered Units',dataIndex:'orderedUnits',...sortable('orderedUnits'),width:125,align:'right',render:v=>formatCount(v)},
      {title:'Period Revenue',dataIndex:'orderedRevenue',...sortable('orderedRevenue'),width:158,align:'right',render:revenueCell},
    ];
    if(level==='asin')identity.splice(1,0,{title:'Product Title',key:'productTitle',dataIndex:'productTitle',width:210,ellipsis:true,render:v=>v||'-'});
    const periodCols=periods.map(p=>({
      title:p.type==='day'?dayjs(p.label).format('DD MMM'):p.label,key:'group-'+p.key,
      children:[
        {title:'Revenue',...sortable(p.sortKey),width:155,align:'right',render:(_,r)=>revenueCell(r[p.revenueMap]?.[p.key])},
        ...(showTrends?[{title:<Tooltip title={p.type==='month'?'Change against previous complete calendar month':p.type==='week'?'Change against the same calendar segment seven days earlier':'Change against the preceding calendar day'}>{p.trendLabel}</Tooltip>,key:'change-'+p.key,width:100,align:'right',render:(_,r)=>trendCell(r[p.trendMap]?.[p.key])}]:[])
      ]
    }));
    return [...identity,...periodCols];
  },[level,periods,showTrends,fixed,sortKey,sortDirection]);
  const width=columns.reduce((n,c)=>n+(c.children?c.children.reduce((m,x)=>m+x.width,0):c.width),0);
  // When a selected period column is hidden, revert to a visible global sort.
  // Do not reset while a new report is still loading.
  useEffect(()=>{
    if(loading||!analytics)return;
    if((sortKey.startsWith('day-')||sortKey.startsWith('week-total-')||sortKey.startsWith('month-total-'))&&!periods.some(p=>p.sortKey===sortKey))onSortChange({key:'orderedRevenue',direction:'desc'});
  },[loading,analytics,periods,sortKey,onSortChange]);
  return <Card id="panel-matrix" size="small" className="gms-matrix-card" title={<Flex gap={8} align="center" wrap><span>Revenue matrix</span><Badge count={total} overflowCount={999999999} showZero color="#64748b"/></Flex>}
    extra={<Tooltip title="Period Revenue covers the selected date range. Revenue sorts apply across all rows. N/A is unavailable data, not zero."><InfoCircleOutlined/></Tooltip>}>
    <Flex vertical gap={12}>
      <Flex align="center" justify="space-between" wrap gap={8}>
        <Segmented aria-label="Row grouping" value={level} onChange={onLevelChange} options={[{label:'ASIN View',value:'asin'},{label:'Seller View',value:'seller'}]}/>
        <Segmented aria-label="Matrix granularity" value={granularity} onChange={setGranularity} options={[{label:'Summary',value:'summary'},{label:'Monthly',value:'month'},{label:'Weekly',value:'week'},{label:'Daily',value:'day'}]}/>
      </Flex>
      <Flex align="center" wrap gap={8}>
        {['week','day'].includes(granularity)&&<>
          <Button aria-label="Previous matrix month" icon={<LeftOutlined/>} disabled={monthIndex<=0} onClick={()=>setMonth(keys[monthIndex-1])}/>
          <Select aria-label="Matrix month" placeholder="Select month" style={{minWidth:170}} value={activeMonth??undefined} onChange={setMonth} options={keys.map(key=>({label:groups[key].label,value:key}))}/>
          <Button aria-label="Next matrix month" icon={<RightOutlined/>} disabled={monthIndex<0||monthIndex>=keys.length-1} onClick={()=>setMonth(keys[monthIndex+1])}/>
        </>}
        {granularity!=='summary'&&<Button aria-pressed={showTrends} onClick={()=>setShowTrends(v=>!v)}>{showTrends?'Hide comparisons':'Show comparisons'}</Button>}
        <Text type="secondary">{granularity==='summary'?'Selected-period totals':granularity==='month'?'All observed reporting months':granularity==='week'?'Selected month, non-overlapping week segments':'Selected month, observed daily records'}. Sorting is server-side.</Text>
      </Flex>
      <div className="gms-matrix-scroll">
        <Table size="small" bordered rowKey="key" columns={columns} dataSource={rows} loading={loading} tableLayout="fixed"
          scroll={{x:Math.max(width,800),y:480}} locale={{emptyText:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matching matrix rows"/>}}
          pagination={{current:analytics?.pagination?.page??page,pageSize,total,showSizeChanger:true,pageSizeOptions:[25,50,100],size:'small',showTotal:(n,range)=>range[0]+'-'+range[1]+' of '+n.toLocaleString('en-IN')+' rows'}}
          onChange={(pagination,_filters,sorter,extra)=>{
            if(extra.action==='sort'){
              const next=Array.isArray(sorter)?sorter[0]:sorter;
              onSortChange(next?.order?{key:String(next.columnKey),direction:next.order==='ascend'?'asc':'desc'}:{key:'orderedRevenue',direction:'desc'});
            }else if(extra.action==='paginate')onPageChange(Number(pagination.current||1),Number(pagination.pageSize||50));
          }}
        />
      </div>
    </Flex>
  </Card>;
}
