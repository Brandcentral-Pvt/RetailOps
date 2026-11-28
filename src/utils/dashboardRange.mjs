// Dashboard reporting uses local calendar dates, never UTC timestamp slicing.
const pad=n=>String(n).padStart(2,'0');
export function dashboardDateKey(value){
 if(value==null)return undefined;
 if(value instanceof Date){
  if(!Number.isFinite(value.getTime()))return 'invalid';
  return String(value.getFullYear()).padStart(4,'0')+'-'+pad(value.getMonth()+1)+'-'+pad(value.getDate());
 }
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
 return 'invalid';
}
function validDay(s){
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const date=new Date(s+'T00:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===s;
}
export function dashboardRangeError(start,end){
 if(start===undefined&&end===undefined)return null;
 if(!validDay(start)||!validDay(end))return 'Select a valid start and end date.';
 if(end<start)return 'End date must not precede start date.';
 if((Date.parse(end)-Date.parse(start))/86400000+1>366)return 'Select up to 366 calendar days.';
 return null;
}
export function sameDashboardScope(a,b){
 return !!a&&!!b&&a.empty===b.empty&&a.unrestricted===b.unrestricted&&a.managerId===b.managerId&&JSON.stringify([...a.sellerIds].sort())===JSON.stringify([...b.sellerIds].sort());
}
export function matchesDashboardPeriod(data,start,end){
 return !!data?.period&&(!start||data.period.startDate===start)&&(!end||data.period.endDate===end);
}
export function dashboardErrorText(error){
 const body=error?.response?.data;
 if(error?.response?.status===400&&typeof body?.error==='string')return body.error;
 if(error?.response?.status===403)return 'You no longer have access to this selection.';
 if(error?.code==='ECONNABORTED'||error?.response?.status===502||error?.response?.status===504)return 'Dashboard request timed out. Retry or select a shorter date range.';
 return 'Dashboard data could not be loaded. Retry this selection.';
}
