import React,{useMemo,useState} from 'react';
import {Button,Card,Empty,Segmented,Select} from 'antd';
import {BarChartOutlined,CalendarOutlined,DollarOutlined,FundOutlined,InfoCircleOutlined,LineChartOutlined,ShoppingCartOutlined,ThunderboltOutlined} from '@ant-design/icons';
import {CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {formatAdsValue,adsCount} from './adsNumberFormat.mjs';
import {buildOverviewTrend,metricValue,metricCoverage,ratioMetric,reportCurrencies} from './adsOverviewModel.mjs';
import {DeltaText} from './AdsPerformanceReview';

const METRICS=[
 ['totalSales','Total sales','money',DollarOutlined,'blue'],['sales','Ad sales','money',ShoppingCartOutlined,'blue'],
 ['spend','Ad spend','money',FundOutlined,'amber'],['totalOrders','Total orders','count',ShoppingCartOutlined,'neutral'],
 ['acos','ACoS','%',BarChartOutlined,'neutral'],['tacos','TACoS','%',BarChartOutlined,'neutral'],
 ['roas','ROAS','x',LineChartOutlined,'neutral'],['cvr','CVR','%',ThunderboltOutlined,'neutral']
];
const CHARTS=[
 {value:'sales_spend',label:'Ad sales & spend',keys:['sales','spend'],unit:'money'},
 ...[['totalSales','Total sales','money'],['acos','ACoS','%'],['roas','ROAS','x'],['cvr','CVR','%'],['clicks','Clicks','count'],['conversions','Conversions','count']].map(([value,label,unit])=>({value,label,keys:[value],unit}))
];
const LABELS={sales:'Ad sales',spend:'Ad spend',totalSales:'Total sales',acos:'ACoS',roas:'ROAS',cvr:'CVR',clicks:'Clicks',conversions:'Conversions'};
const COVERAGE={complete:'Complete observed',partial:'Partial coverage',incompatible_coverage:'Unmatched coverage',unknown:'Unknown'};
const COLORS=['#1976d2','#b7791f'];
const compact=new Intl.NumberFormat('en-IN',{notation:'compact',maximumFractionDigits:1});
const range=(a,b)=>a===b?a:a+' to '+b;
function Kpi({metric,current,previous,comparison,currency,days}){
 const [key,label,unit,Icon,accent]=metric,now=metricValue(current,key),prior=metricValue(previous,key);
 const cov=metricCoverage(current,key),change=(ratioMetric(key)?comparison?.ratios:comparison?.metrics)?.[key];
 return <article className="ads-kpi" data-testid={'ads-kpi-'+key}>
  <div className="ads-kpi-top"><span>{label}</span><span className={'ads-kpi-icon ads-kpi-icon-'+accent}><Icon aria-hidden="true"/></span></div>
  <div className="ads-kpi-value" title={now==null?'Unknown':String(now)}>{formatAdsValue(now,unit,currency)}</div>
  <div className="ads-kpi-prior">Prior: <span title={prior==null?'Unknown':String(prior)}>{formatAdsValue(prior,unit,currency)}</span></div>
  <DeltaText change={change} money={unit==='money'} currency={currency}/>
  <div className="ads-kpi-foot"><span className={'ads-kpi-coverage ads-kpi-coverage-'+cov}><i aria-hidden="true"/>{COVERAGE[cov]||'Unknown'}</span>{cov==='complete'&&current?.coveredDays!==days&&<span className="ads-analytics-note">Incomplete dates</span>}</div>
 </article>;
}
function TrendTooltip({active,payload,mode,currency}){
 if(!active||!payload?.length)return null;
 const r=payload[0]?.payload;if(!r)return null;
 return <div className="ads-portfolio-tooltip"><strong>{range(r.start,r.end)}</strong>
  {mode.keys.map(k=><div key={k}>{LABELS[k]}: <strong title={r.exact[k]??'Unknown'}>{formatAdsValue(r.exact[k],mode.unit,currency)}</strong><div className="ads-analytics-note">{COVERAGE[metricCoverage(r.source,k)]||'Unknown'}</div></div>)}
  <div className="ads-analytics-note">{r.source?adsCount(r.source.coveredDays):'0'}/{r.days} stored days</div>
 </div>;
}
export function AdsOverviewTrend({report,currency,granularity,onGranularity,onPortfolio,compactMode=false,preferences,onPreference}){
 const [localPeriod,setLocalPeriod]=useState('current'),[localMetric,setLocalMetric]=useState('sales_spend');
 const periodKey=preferences?.period||localPeriod,modeKey=preferences?.metric||localMetric;
 const setPeriodKey=value=>onPreference?onPreference('period',value):setLocalPeriod(value);
 const setModeKey=value=>onPreference?onPreference('metric',value):setLocalMetric(value);
 const mode=CHARTS.find(x=>x.value===modeKey)||CHARTS[0];
 const rows=useMemo(()=>buildOverviewTrend({report,currency,periodKey,granularity,keys:mode.keys}),[report,currency,periodKey,granularity,mode]);
 const has=rows.some(r=>mode.keys.some(k=>r[k]!==null)),missing=rows.filter(r=>!r.source).length;
 return <Card size="small" className="ads-overview-trend" title="Performance trend" data-testid="ads-overview-trend">
  <div className="ads-analytics-toolbar"><div className="ads-analytics-note">{periodKey==='current'?'Current':'Previous'} actual reporting dates · {currency}</div>
   <div className="ads-portfolio-controls">
    <Segmented size="small" aria-label="Overview trend period" value={periodKey} onChange={setPeriodKey} options={[{label:'Current',value:'current'},{label:'Prior',value:'previous'}]}/>
    <Select id="ads-overview-trend-metric" aria-label="Overview trend metric" virtual={false} value={modeKey} onChange={setModeKey} options={CHARTS.map(({value,label})=>({value,label}))} style={{width:165}}/>
    {onGranularity&&<Select id="ads-overview-trend-granularity" aria-label="Overview trend granularity" virtual={false} value={granularity} onChange={onGranularity} options={[{value:'day',label:'Daily'},{value:'week',label:'Weekly'},{value:'month',label:'Monthly'}]} style={{width:110}}/>}
   </div>
  </div>
  {has?<div className="ads-overview-chart" role="img" aria-label={mode.label+' '+periodKey+' trend in '+currency}>
   <ResponsiveContainer width="100%" height={compactMode?245:290} minWidth={0}><LineChart data={rows} margin={{top:14,right:14,left:4,bottom:8}}>
    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3"/><XAxis dataKey="bucket" minTickGap={30} tick={{fontSize:11}}/><YAxis width={67} tickFormatter={v=>compact.format(v)} tick={{fontSize:11}}/>
    <Tooltip content={<TrendTooltip mode={mode} currency={currency}/>}/><Legend/>
    {mode.keys.map((key,i)=><Line key={key} name={LABELS[key]} dataKey={key} stroke={COLORS[i]} strokeWidth={2.3} connectNulls={false} dot={rows.length<=31} isAnimationActive={false}/>)}
   </LineChart></ResponsiveContainer>
  </div>:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No observed values for this trend"/>}
  <div className="ads-chart-footer"><span>{adsCount(missing)} of {adsCount(rows.length)} calendar buckets have no stored facts. Missing values are gaps, not zero.</span>{onPortfolio&&<Button type="link" onClick={onPortfolio}>Compare aligned periods</Button>}</div>
 </Card>;
}
export default function AdsOverview({report,granularity,onGranularity,onNavigate,compactMode=false,preferences,onPreference}){
 const [localCurrency,setLocalCurrency]=useState(null);
 const selectedCurrency=preferences?preferences.currency:localCurrency;
 const setCurrency=value=>onPreference?onPreference('currency',value):setLocalCurrency(value);
 const currencies=reportCurrencies(report),currency=currencies.includes(selectedCurrency)?selectedCurrency:currencies[0];if(!currency)return null;
 const current=report.current.find(s=>s.currency===currency),previous=report.previous.find(s=>s.currency===currency),comparison=report.comparisons?.find(s=>s.currency===currency),days=report.period.days;
 return <section className={'ads-overview'+(compactMode?' ads-overview-compact':'')} aria-label="Performance overview" data-testid="ads-overview">
  <div className="ads-section-heading"><div><h2>{compactMode?'Selected entity performance':'Performance overview'}</h2><p>Current and equal-length previous period · {currency}</p></div>
   {currencies.length>1&&<Select id={compactMode?'ads-drawer-currency':'ads-overview-currency'} aria-label="Overview currency" virtual={false} value={currency} onChange={setCurrency} options={currencies.map(value=>({value,label:value}))} style={{width:130}}/>}
  </div>
  <div className="ads-kpi-grid">{METRICS.map(metric=><Kpi key={metric[0]} metric={metric} current={current} previous={previous} comparison={comparison} currency={currency} days={days}/>)}</div>
  {!current&&<div className="ads-evidence-note"><InfoCircleOutlined/> No current-period records. Prior values remain visible; missing current values are not treated as zero.</div>}
  <div className={'ads-overview-lower'+(compactMode?' ads-overview-single':'')}>
   <AdsOverviewTrend report={report} currency={currency} granularity={granularity} onGranularity={onGranularity} onPortfolio={onNavigate?()=>onNavigate('portfolio'):null} compactMode={compactMode} preferences={preferences} onPreference={onPreference}/>
   <Card size="small" title="Reporting evidence" className="ads-overview-evidence">
    {[['Current dates',adsCount(current?.coveredDays)+' / '+adsCount(days)],['Prior dates',adsCount(previous?.coveredDays)+' / '+adsCount(days)],['Current source rows',adsCount(current?.rowCount)],['Prior source rows',adsCount(previous?.rowCount)],['Unmapped current rows',adsCount(current?.unmappedRows)]].map(([label,value])=><div className="ads-evidence-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}
    <div className="ads-evidence-note"><InfoCircleOutlined/> Stored coverage does not establish that every advertising report was uploaded. Financial totals are never reconstructed from ad plus organic sales.</div>
    {onNavigate&&<div className="ads-quick-links"><Button block onClick={()=>onNavigate('products')}>Explore products</Button><Button block onClick={()=>onNavigate('quality')}>Inspect data quality</Button></div>}
   </Card>
  </div>
 </section>;
}
