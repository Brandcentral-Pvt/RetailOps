// Presentation only: never convert canonical decimal strings to Number for
// financial rounding. Sorting, classifications, exports and API payloads
// retain their original exact values. Currency codes stay explicit.
const group=(whole,indian)=>{
 if(!indian)return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',');
 if(whole.length<=3)return whole;
 return whole.slice(0,-3).replace(/\B(?=(\d{2})+(?!\d))/g,',')+','+whole.slice(-3);
};
export function formatAdsValue(value,unit='count',currency=null,{signed=false,missing='N/A'}={}){
 if(value===null||value===undefined||value==='')return missing;
 const text=String(value),match=/^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
 if(!match)return missing;
 const [,sourceSign,whole,fraction='']=match;
 const cash=unit==='money'||unit==='currency',rate=unit==='%'||unit==='pp'||unit==='x'||unit==='×';
 let integer=BigInt(whole).toString(),decimals=fraction.replace(/0+$/,'');
 if(cash||rate){
  let scaled=BigInt(integer)*100n+BigInt(fraction.slice(0,2).padEnd(2,'0'));
  if((fraction[2]||'0')>='5')scaled++;
  integer=(scaled/100n).toString();decimals=(scaled%100n).toString().padStart(2,'0');
  if(rate)decimals=decimals.replace(/0+$/,'');
 }
 // Genuine counts are integral. Preserve an unexpected fractional count
 // rather than silently turning it into an integer.
 const zero=integer==='0'&&!/[1-9]/.test(decimals);
 const sign=zero?'':sourceSign==='-'?'-':signed||sourceSign==='+'?'+':'';
 const suffix=unit==='%'?'%':unit==='pp'?' pp':unit==='x'||unit==='×'?'×':'';
 return (cash&&currency?currency+' ':'')+sign+group(integer,!cash||currency==='INR')+(decimals?'.'+decimals:'')+suffix;
}
export const adsCount=(v,missing='N/A')=>formatAdsValue(v,'count',null,{missing});
export const adsMoney=(v,c)=>formatAdsValue(v,'money',c);
export const adsRate=(v,unit='%')=>formatAdsValue(v,unit);
