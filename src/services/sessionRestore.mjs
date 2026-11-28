// Only retry read-only session verification, never sign-in or financial writes.
const retryDelays=[350,1000];
const abortError=()=>new DOMException('Session check cancelled','AbortError');
function wait(ms,signal){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(abortError());return;}
  const onAbort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);reject(abortError());};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',onAbort);resolve();},ms);
  signal?.addEventListener('abort',onAbort,{once:true});
 });
}
export async function restoreSession({url,signal,fetcher=globalThis.fetch,delays=retryDelays,timeoutMs=8000}){
 for(let attempt=0;attempt<=delays.length;attempt++){
  if(signal?.aborted)throw abortError();
  const request=new AbortController();
  const cancel=()=>request.abort();
  signal?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(cancel,timeoutMs);
  let response=null,transient=false;
  try{
   response=await fetcher(url,{method:'GET',credentials:'include',cache:'no-store',signal:request.signal});
   if(signal?.aborted)throw abortError();
   if(response.status===401)return {status:'anonymous'};
   if(response.ok){
    const body=await response.json();
    if(signal?.aborted)throw abortError();
    if(body?.success&&body?.data&&typeof body.data==='object'&&!Array.isArray(body.data)&&(body.data.Id||body.data.id||body.data._id))
     return {status:'authenticated',user:body.data};
    return {status:'unavailable',httpStatus:response.status};
   }
   transient=response.status===408||response.status>=500;
  }catch(error){
   if(signal?.aborted)throw abortError();
   transient=true;
  }finally{
   clearTimeout(timer);
   signal?.removeEventListener('abort',cancel);
  }
  if(!transient||attempt===delays.length)return {status:'unavailable',httpStatus:response?.status||0};
  await wait(delays[attempt],signal);
 }
 return {status:'unavailable',httpStatus:0};
}
