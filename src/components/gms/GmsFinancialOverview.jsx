import React,{useMemo,useState} from 'react';
import {Alert,Button,Card,Col,Empty,Flex,Row,Segmented,Select,Skeleton,Space,Statistic,Tag,Tooltip,Typography,theme} from 'antd';
import {InfoCircleOutlined,LineChartOutlined} from '@ant-design/icons';
import Chart from 'react-apexcharts';
import dayjs from 'dayjs';
import {METRICS,metricValue,changeLabel,changeTone,dailySeries,isKnown} from './gmsPresentation.mjs';

const {Text}=Typography;
export function GmsFinancialSummary({analytics,loading,metric,onMetricChange}){
  const {token}=theme.useToken();
  const comparison=analytics?.comparison, prior=comparison?.window;
  const incomplete=prior&&(!comparison.currentCoverage?.complete||!comparison.previousCoverage?.complete);
  const kpis=analytics?.kpis||{};
  if(!loading&&!analytics?.meta?.records)return <Card size="small"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Space direction="vertical" size={4}><Text strong>No GMS records in this selection</Text><Text type="secondary">Change the report dates or filters, or import an Amazon India GMS report.</Text></Space>}/></Card>;
  return <section aria-label={loading?'Loading financial summary':'Key performance indicators'} className="gms-summary">
    <Flex align="center" justify="space-between" wrap gap={8}>
      <div><Typography.Title level={5} className="gms-section-title">Financial overview</Typography.Title><Text type="secondary">Full filtered dataset, not just the current table page.</Text></div>
      {prior&&<Tag color={incomplete?'warning':'default'}>Prior: {prior.from} to {prior.to}</Tag>}
    </Flex>
    {!loading&&prior&&<Alert showIcon type={incomplete?'warning':'info'} title={incomplete?'Comparison coverage is incomplete':'Period comparison'} description={<span>Current: {comparison.currentCoverage?.observedDays??0}/{comparison.currentCoverage?.expectedDays??0} observed days. Prior: {comparison.previousCoverage?.observedDays??0}/{prior.days} observed days. {incomplete?'Changes are unavailable when date coverage is incomplete.':'Changes compare the preceding equal-length period. Ratios use percentage points.'}</span>}/>}
    <Row gutter={[12,12]}>
      {METRICS.map(m=>{
        const value=kpis[m.key],change=comparison?.changes?.[m.key],selected=metric===m.key;
        const delta=changeLabel(m,change);
        return <Col key={m.key} xs={12} sm={8} xl={6} xxl={4}>
          <Card size="small" className={'gms-stat-card'+(selected?' gms-stat-card--selected':'')} style={selected?{borderColor:token.colorPrimary}:undefined}>
            {loading?<Skeleton active title={{width:'75%'}} paragraph={{rows:1,width:'90%'}}/>:
              <>
                <Flex justify="space-between" align="center" gap={4}>
                  <Text type="secondary" className="gms-stat-label">{m.label}</Text>
                  <Tooltip title={'Show '+m.label+' daily trend'}><Button size="small" type="text" icon={<LineChartOutlined/>} aria-label={'Show '+m.label+' trend'} aria-pressed={selected} onClick={()=>onMetricChange(m.key)}/></Tooltip>
                </Flex>
                <Tooltip title={metricValue(m,value)}>
                  <Statistic value={isKnown(value)?value:0} formatter={()=>metricValue(m,value,{compact:true})} valueStyle={{fontSize:22,fontWeight:650,color:isKnown(value)&&value<0?token.colorError:token.colorText}}/>
                </Tooltip>
                <Flex wrap gap={4} align="center" className="gms-stat-delta">
                  {delta!==null?<Tag color={changeTone(m,change)}>{delta}</Tag>:<Text type="secondary">No comparison</Text>}
                </Flex>
                {m.key==='profit'&&<Text type="secondary" className="gms-stat-note">{isKnown(kpis.marginPct)?'Margin '+kpis.marginPct.toFixed(2)+'%':'Margin unavailable'}</Text>}
              </>}
          </Card>
        </Col>;
      })}
    </Row>
  </section>;
}
export function GmsTrend({analytics,loading,metric,onMetricChange}){
  const {token}=theme.useToken();
  const [chartType,setChartType]=useState('area');
  const selected=METRICS.find(m=>m.key===metric)||METRICS[0];
  const series=useMemo(()=>[{name:selected.label,data:dailySeries(analytics?.daily,selected.key,analytics?.selectedWindow)}],[analytics?.daily,analytics?.selectedWindow,selected]);
  const options=useMemo(()=>({
    chart:{type:chartType,toolbar:{show:false},animations:{enabled:false},zoom:{enabled:false},parentHeightOffset:0},
    colors:[token.colorPrimary],
    stroke:{curve:'straight',width:2.4},
    dataLabels:{enabled:false},
    markers:{size:series[0].data.length<=31?3:0},
    fill:{type:chartType==='area'?'gradient':'solid',gradient:{opacityFrom:.22,opacityTo:.03}},
    grid:{borderColor:token.colorBorderSecondary,strokeDashArray:3},
    xaxis:{type:'datetime',labels:{datetimeUTC:true,format:'dd MMM'}},
    yaxis:{labels:{formatter:v=>metricValue(selected,v,{compact:true})}},
    tooltip:{x:{format:'dd MMM yyyy'},y:{formatter:v=>metricValue(selected,v)}},
    noData:{text:'No observed values'},
    legend:{show:false},
  }),[chartType,selected,series,token.colorPrimary,token.colorBorderSecondary]);
  if(!loading&&!analytics?.meta?.records)return null;
  return <Card size="small" title="Daily performance" extra={<Tooltip title="Missing days and unavailable values are shown as gaps, not zero."><InfoCircleOutlined/></Tooltip>}>
    <Flex align="center" wrap gap={8} className="gms-trend-controls">
      <Select aria-label="Chart metric" value={selected.key} onChange={onMetricChange} options={METRICS.map(m=>({label:m.label,value:m.key}))} style={{minWidth:190}}/>
      <Segmented aria-label="Chart style" value={chartType} onChange={setChartType} options={[{label:'Area',value:'area'},{label:'Line',value:'line'}]}/>
      <Text type="secondary">{analytics?.selectedWindow?.from?dayjs(analytics.selectedWindow.from).format('DD MMM YYYY')+' to '+dayjs(analytics.selectedWindow.to).format('DD MMM YYYY'):'Selected report dates'}</Text>
    </Flex>
    {loading?<Skeleton active paragraph={{rows:5}}/>:series[0].data.some(p=>p.y!==null)?<div className="gms-trend-chart" aria-label={selected.label+' daily chart'}><Chart key={chartType+selected.key} options={options} series={series} type={chartType} height={260}/></div>:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No observed values for this metric"/>}
  </Card>;
}
