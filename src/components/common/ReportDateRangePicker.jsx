import React from 'react';
import {DatePicker} from 'antd';
import dayjs from 'dayjs';

// One reporting-calendar component for GMS and Ads. Presets are evaluated
// when selected, using the user's local calendar (not UTC string slicing).
const presets=[
 {label:'Today',value:()=>[dayjs().startOf('day'),dayjs().endOf('day')]},
 {label:'Yesterday',value:()=>[dayjs().subtract(1,'day').startOf('day'),dayjs().subtract(1,'day').endOf('day')]},
 {label:'Last 7 days',value:()=>[dayjs().subtract(6,'day').startOf('day'),dayjs().endOf('day')]},
 {label:'Last 30 days',value:()=>[dayjs().subtract(29,'day').startOf('day'),dayjs().endOf('day')]},
 {label:'This month',value:()=>[dayjs().startOf('month'),dayjs().endOf('day')]},
 {label:'Previous month',value:()=>[dayjs().subtract(1,'month').startOf('month'),dayjs().subtract(1,'month').endOf('month')]}
];
const outsideCalendar=d=>!d?.isValid()||d.isBefore(dayjs('2000-01-01'),'day')||d.isAfter(dayjs('2099-12-31'),'day');
export default function ReportDateRangePicker({startDate,endDate,onDateRangeChange,idPrefix,ariaLabel='Reporting dates',maxDays}){
 const range=[dayjs(startDate||dayjs().startOf('month')),dayjs(endDate||dayjs().endOf('month'))];
 const value=range.every(d=>d.isValid())?range:null;
 const tooLong=(a,b)=>maxDays!=null&&Math.abs(a.startOf('day').diff(b.startOf('day'),'day'))+1>maxDays;
 return <DatePicker.RangePicker
  id={{start:idPrefix,end:idPrefix+'-end'}} aria-label={ariaLabel}
  className="report-date-range-picker" value={value} allowClear={false}
  presets={presets} format="DD MMM YYYY" style={{width:'100%'}}
  disabledDate={(d,info)=>outsideCalendar(d)||Boolean(info?.from?.isValid()&&tooLong(d,info.from))}
  renderExtraFooter={maxDays?()=> 'Select up to '+maxDays+' calendar days.':undefined}
  onChange={dates=>{
   if(!dates?.[0]||!dates?.[1]||dates.some(outsideCalendar)||dates[1].isBefore(dates[0],'day')||tooLong(dates[0],dates[1]))return;
   onDateRangeChange({startDate:dates[0].startOf('day').toDate(),endDate:dates[1].endOf('day').toDate(),rangeType:'custom'});
  }}/>
}
