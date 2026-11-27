import React,{useMemo,useState} from 'react';
import {Alert,Button,Card,Empty,Flex,Segmented,Select,Skeleton,Space,Tag,Tooltip,Typography,theme} from 'antd';
import {InfoCircleOutlined,LineChartOutlined} from '@ant-design/icons';
import Chart from 'react-apexcharts';
import dayjs from 'dayjs';
import {METRICS,metricValue,changeLabel,changeTone,dailySeries,isKnown} from './gmsPresentation.mjs';

const {Text}=Typography;
const primary=['orderedRevenue','orderedUnits','shippedRevenue','profit','returnRatio'];
const secondary=['shippedUnits','shippedCOGS','marginPct','customerReturns'];
const byKey=key=>METRICS.find(m=>m.key===key);

function Metric({definition,value,change,selected,onSelect,small=false}){
  const label=changeLabel(definition,change);
  return <button type="button" className={'gms-metric'+(small?' gms-metric--small':'')+(selected?' gms-metric--selected':'')}
    aria-label={'Show '+definition.label+' trend'} aria-pressed={selected} onClick={onSelect}>
    <span className="gms-metric-label">{definition.label}<LineChartOutlined aria-hidden="true"/></span>
    <span className={'gms-metric-value'+(isKnown(value)&&value<0?' gms-number--negative':'')} title={metricValue(definition,value)}>{metricValue(definition,value,{compact:true})}</span>
    {label!=null&&<span className="gms-metric-change"><Tag color={changeTone(definition,change)}>{label}</Tag></span>}
  </button>;
}
export function GmsFinancialSummary({analytics,loading,metric,onMetricChange,onUseLatest}){
  const c=analytics?.comparison,prior=c?.window,current=c?.currentCoverage,previous=c?.previousCoverage;
  const kpis=analytics?.kpis||{},partial=prior&&(!current?.complete||!previous?.complete);
  const observed=current?.observedDays??0;
  if(!loading&&!analytics?.meta?.records)return <Card size="small"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
    description={<Space direction="vertical" size={4}><Text strong>No GMS records in this selection</Text><Text type="secondary">Change the dates or filters, or import an Amazon India GMS report.</Text></Space>}/></Card>;
  return <section aria-label={loading?'Loading financial summary':'Key performance indicators'} className="gms-summary">
    <Card size="small" className="gms-summary-card">
      <Flex align="center" justify="space-between" wrap gap={8} className="gms-summary-heading">
        <Flex align="center" wrap gap={8}>
          <Typography.Title level={5} className="gms-section-title">Financial overview</Typography.Title>
          <Text type="secondary">Entire filtered report</Text>
        </Flex>
        {!loading&&prior&&<Tooltip title={'Current '+(current?.observedDays??0)+' of '+(current?.expectedDays??0)+' days; prior '+(previous?.observedDays??0)+' of '+prior.days+' days. Observed dates do not prove every ASIN was reported.'}>
          <Tag color={partial?'warning':'success'}>{partial?'Comparison unavailable':'Comparable period'}</Tag>
        </Tooltip>}
      </Flex>
      {loading?<Skeleton active title={false} paragraph={{rows:2}}/>:<>
        <div className="gms-primary-metrics">{primary.map(key=><Metric key={key} definition={byKey(key)} value={kpis[key]} change={c?.changes?.[key]} selected={metric===key} onSelect={()=>onMetricChange(key)}/>)}</div>
        <div className="gms-secondary-metrics">{secondary.map(key=><Metric key={key} definition={byKey(key)} value={kpis[key]} change={c?.changes?.[key]} selected={metric===key} onSelect={()=>onMetricChange(key)} small/>)}</div>
        <Flex align="center" wrap gap={8} className="gms-coverage-line">
          {current&&<Text type={partial?'warning':'secondary'}>{observed}/{current.expectedDays??observed} reporting days available{prior?' · prior '+(previous?.observedDays??0)+'/'+prior.days:''}</Text>}
          {partial&&<Tooltip title={'Prior range: '+prior.from+' to '+prior.to+'. Missing dates are not counted as zero. Changes remain unavailable until both ranges have observed data on each day.'}><InfoCircleOutlined aria-label="Comparison coverage details"/></Tooltip>}
          {observed===1&&current?.expectedDays>1&&analytics?.meta?.last&&<Button size="small" type="link" onClick={()=>onUseLatest?.(analytics.meta.last)}>View {dayjs(analytics.meta.last).format('DD MMM')} only</Button>}
          {!isKnown(kpis.marginPct)&&<Text type="secondary">Margin unavailable</Text>}
        </Flex>
      </>}
    </Card>
  </section>;
}
export function GmsTrend({analytics,loading,metric,onMetricChange}){
  const {token}=theme.useToken();
  const [chartType,setChartType]=useState('line');
  const selected=byKey(metric)||METRICS[0];
  const data=useMemo(()=>dailySeries(analytics?.daily,selected.key,analytics?.selectedWindow),[analytics?.daily,analytics?.selectedWindow,selected]);
  const observed=useMemo(()=>data.filter(p=>p.y!==null),[data]);
  const series=useMemo(()=>[{name:selected.label,data}],[selected,data]);
  const options=useMemo(()=>({
    chart:{type:chartType,toolbar:{show:false},animations:{enabled:false},zoom:{enabled:false},parentHeightOffset:0},
    colors:[token.colorPrimary],stroke:{curve:'straight',width:2.4},dataLabels:{enabled:false},
    markers:{size:observed.length<=31?3:0},fill:{type:chartType==='area'?'gradient':'solid',gradient:{opacityFrom:.22,opacityTo:.03}},
    grid:{borderColor:token.colorBorderSecondary,strokeDashArray:3},
    xaxis:{type:'datetime',labels:{datetimeUTC:true,format:'dd MMM'}},
    yaxis:{labels:{formatter:v=>metricValue(selected,v,{compact:true})}},
    tooltip:{x:{format:'dd MMM yyyy'},y:{formatter:v=>metricValue(selected,v)}},legend:{show:false},
  }),[chartType,selected,observed.length,token.colorPrimary,token.colorBorderSecondary]);
  if(!loading&&!analytics?.meta?.records)return null;
  const single=observed.length===1?observed[0]:null;
  return <Card size="small" title="Daily performance" extra={<Tooltip title="A missing reporting day is not zero. The chart displays gaps and never invents a trend."><InfoCircleOutlined/></Tooltip>}>
    <Flex align="center" wrap gap={8} className="gms-trend-controls">
      <Select aria-label="Chart metric" value={selected.key} onChange={onMetricChange} options={METRICS.map(m=>({label:m.label,value:m.key}))} style={{minWidth:190}}/>
      {observed.length>1&&<Segmented aria-label="Chart style" value={chartType} onChange={setChartType} options={[{label:'Area',value:'area'},{label:'Line',value:'line'}]}/>}
      <Text type="secondary">{observed.length} observed {observed.length===1?'day':'days'}</Text>
    </Flex>
    {loading?<Skeleton active paragraph={{rows:4}}/>:single?<div className="gms-single-day" role="status">
      <Text type="secondary">{new Date(single.x).toISOString().slice(0,10)}</Text>
      <Typography.Title level={3} style={{margin:0}}>{metricValue(selected,single.y)}</Typography.Title>
      <Text strong>Only one observed reporting day</Text><Text type="secondary">At least two observed values are needed for a meaningful trend.</Text>
    </div>:observed.length>1?<div className="gms-trend-chart" aria-label={selected.label+' daily chart'}><Chart key={chartType+selected.key} options={options} series={series} type={chartType} height={280}/></div>:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No observed values for this metric"/>}
  </Card>;
}
export function GmsComparisonTable({analytics}){
  const c=analytics?.comparison;
  if(!analytics?.meta?.records)return null;
  return <Card size="small" title="Selected period comparison">
    <Text type="secondary">{c?.window?'Prior: '+c.window.from+' to '+c.window.to:'No equal-length prior period available'}. Values compare the full filtered dataset.</Text>
    <div className="gms-compare-scroll"><table className="gms-compare-table"><thead><tr><th>Metric</th><th>Current</th><th>Prior</th><th>Change</th></tr></thead><tbody>
      {METRICS.map(m=><tr key={m.key}><th>{m.label}</th><td>{metricValue(m,analytics.kpis?.[m.key])}</td><td>{metricValue(m,c?.baseline?.[m.key])}</td><td>{changeLabel(m,c?.changes?.[m.key])??'N/A'}</td></tr>)}
    </tbody></table></div>
    {(!c?.currentCoverage?.complete||!c?.previousCoverage?.complete)&&<Text type="secondary">Comparisons are unavailable where the date coverage is incomplete or the baseline is zero.</Text>}
  </Card>;
}
