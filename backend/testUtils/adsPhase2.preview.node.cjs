'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {parseInWorker}=require('../services/adsPreviewParser');
const {HEADERS,MAX_FILE_BYTES}=require('../services/adsProductContract');
const csv=(count)=>Buffer.from(HEADERS.join(',')+'\n'+Array.from({length:count},(_,i)=>HEADERS.map(h=>h==='asin'?'B'+String(i).padStart(9,'0'):h==='date'?'2026-04-01':h==='metrics.spend'?'1.25':h==='metrics.sales'?'5.50':'').join(',')).join('\n')+'\n');
test('worker parser reports fatal CSV errors without losing source hash',async()=>{
 const input=Buffer.from('bad,header\n');
 const r=await parseInWorker(input);
 assert.equal(r.summary.valid,false);assert.equal(r.summary.scanComplete,false);
 assert.equal(r.issues[0].code,'invalid_header');assert.equal(r.sourceFileSha256,createHash('sha256').update(input).digest('hex'));
});
test('worker preserves first source record and signed exact metrics with blank rows',async()=>{
 const record=HEADERS.map(h=>h==='asin'?'B000000001':h==='date'?'2026-04-01':h==='metrics.spend'?'-1.25':'').join(',');
 const r=await parseInWorker(Buffer.from(HEADERS.join(',')+'\n\n'+record+'\n'+','.repeat(62)+'\n'));
 assert.equal(r.summary.valid,true);assert.equal(r.summary.rows,1);assert.equal(r.summary.skippedBlankRows,2);
 assert.equal(r.summary.totals['metrics.spend'],'-1.25');assert.deepEqual(r.keys,[{row:3,asin:'B000000001',date:'2026-04-01'}]);
});
for(const n of [100000,200000])test('isolated worker parses '+n+' synthetic data rows with exact reconciliation',{timeout:180000},async()=>{
 const input=csv(n);assert.ok(input.length<=MAX_FILE_BYTES);
 const progress=[];let ticks=0;const timer=setInterval(()=>ticks++,10);const start=performance.now();
 try{
  const r=await parseInWorker(input,{onProgress:rows=>progress.push(rows)});
  assert.equal(r.summary.valid,true);assert.equal(r.summary.validRows,n);assert.equal(r.keys.length,n);assert.equal(r.summary.issueCount,0);
  assert.equal(r.summary.totals['metrics.spend'],String(n*1.25));assert.equal(r.summary.totals['metrics.sales'],String(n*5.5));
  assert.equal(progress.at(-1),n);assert.ok(ticks>0);assert.ok(progress.every((v,i)=>i===0||v>=progress[i-1]));
  console.log('Synthetic preview',n,'rows',input.length,'bytes',Math.round(performance.now()-start),'ms; main-loop ticks',ticks);
 }finally{clearInterval(timer);}
});
