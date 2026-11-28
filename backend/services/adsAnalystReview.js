'use strict';
const MAX_CANDIDATES=40,MAX_SELECTION=8,MAX_INPUT_BYTES=64000;
const priority={coverage_review:0,tacos_coverage_mismatch:0,missing_ad_sales:0,spend_zero_sales:1,clicks_zero_conversions:1,spend_up_sales_down:1,prior_only:2,sales_up_spend_down:2,period_change:3};
function candidatesFor(snapshot){
 const byId=new Map(snapshot.evidence.map(e=>[e.id,e]));
 return snapshot.findings.filter(f=>f.evidenceIds.length&&f.evidenceIds.every(id=>byId.has(id)))
  .sort((a,b)=>(priority[a.code]??4)-(priority[b.code]??4)).slice(0,MAX_CANDIDATES);
}
function validateSelection(raw,candidates){
 if(typeof raw!=='string'||raw.length>4096)throw Error('Invalid analyst response');
 const parsed=JSON.parse(raw),allowed=new Set(candidates.map(f=>f.id));
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Object.keys(parsed).join(',')!=='findingIds'||!Array.isArray(parsed.findingIds)||parsed.findingIds.length<1||parsed.findingIds.length>MAX_SELECTION||new Set(parsed.findingIds).size!==parsed.findingIds.length||parsed.findingIds.some(id=>typeof id!=='string'||!allowed.has(id)))throw Error('Invalid analyst selection');
 return parsed.findingIds;
}
async function rankWithNim(messages){
 const nim=require('./nimService');
 if(!nim.isConfigured())throw Error('Provider not configured');
 const model=process.env.ADS_ANALYST_NIM_MODEL||'openai/gpt-oss-20b';
 const result=await nim.getClient().chat.completions.create({model,messages,temperature:0,max_tokens:2048,response_format:{type:'json_object'}},{timeout:20000,maxRetries:0});
 const choice=result?.choices?.[0];
 if(choice?.finish_reason!=='stop')throw Error('Incomplete analyst response');
 return choice.message?.content;
}
async function reviewSnapshot(snapshot,{useAI=false,rank=rankWithNim,enabled=process.env.ADS_ANALYST_AI_ENABLED==='true'}={}){
 const candidates=candidatesFor(snapshot),byId=new Map(candidates.map(f=>[f.id,f]));
 const deterministic=candidates.slice(0,MAX_SELECTION);
 const fallback=reason=>({...snapshot,mode:'rules',reason,recommendations:deterministic});
 if(!useAI)return fallback('rules_requested');
 if(!enabled)return fallback('ai_disabled');
 if(snapshot.empty||!candidates.length)return fallback('no_actionable_evidence');
 // The provider sees only approved aggregate numeric evidence and anonymous
 // candidate IDs. No ASIN, seller, search, catalog text, raw rows or credentials.
 const ids=new Set(candidates.flatMap(f=>f.evidenceIds));
 const digest={findings:candidates.map(f=>({id:f.id,code:f.code,evidenceIds:f.evidenceIds})),evidence:snapshot.evidence.filter(e=>ids.has(e.id)).map(e=>({id:e.id,currency:e.currency,period:e.period,metric:e.metric,value:e.value,coverage:e.coverage,coveredDays:e.coveredDays,expectedDays:e.expectedDays,unit:e.unit}))};
 const input=JSON.stringify(digest);
 if(Buffer.byteLength(input,'utf8')>MAX_INPUT_BYTES)return fallback('evidence_too_large');
 try{
  const raw=await rank([{role:'system',content:'Prioritize evidence quality and observed advertising risks. Return only a JSON object with findingIds, an ordered list of one to eight distinct supplied finding IDs. No new facts, numbers, free text, actions or identifiers. Never infer causality or profitability.'},{role:'user',content:input}]);
  const selected=validateSelection(raw,candidates).map(id=>byId.get(id));
  return {...snapshot,mode:'ai_ranked',reason:null,recommendations:selected};
 }catch{return fallback('provider_unavailable_or_invalid');}
}
module.exports={reviewSnapshot,validateSelection,candidatesFor};
