// TanStack query keys are [namespace,principal,mode,filters,page,limit].
// A page transition is the only circumstance where earlier rows are reusable.
const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export function sameProductPageScope(previous,next){
 if(!Array.isArray(previous)||!Array.isArray(next)||previous.length!==6||next.length!==6)return false;
 if(previous[0]!=='ads-canonical'||next[0]!==previous[0]||previous[2]!=='report'||next[2]!=='report')return false;
 return typeof previous[1]==='string'&&previous[1]===next[1]&&previous[5]===next[5]&&previous[4]!==next[4]&&stable(previous[3])===stable(next[3]);
}
