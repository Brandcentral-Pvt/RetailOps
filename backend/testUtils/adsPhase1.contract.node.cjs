'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {HEADERS,validateReport,replayValidatedRows,validDate,numberText}=require('../services/adsProductContract');
const {createHash}=require('node:crypto');
const contract=require('../contracts/ads-product-daily-v1.json');
const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
const csv=(rows,headers=HEADERS)=>Buffer.from('\uFEFF'+headers.map(quote).join(',')+'\r\n'+rows.map(r=>headers.map(h=>quote(r[h])).join(',')).join('\r\n')+'\r\n');
const sample={asin:'B000000001',sku:'"None"',date:'"2026-04-01"','metrics.spend':'10.25','metrics.sales':'25.50',
 'metrics.total_sales':'20.00','metrics.ordered_revenue':'20','metrics.organic_sales':'8.00','metrics.orders':'2',
 'metrics.conversions':'1','metrics.total_orders':'3','metrics.ordered_orders':'3','metrics.total_units':'4','metrics.units_ordered':'4'};
test('63 unique persisted fields; original headers, nullable types and explicit grain',()=>{
 assert.equal(HEADERS.length,63);assert.equal(new Set(HEADERS).size,63);
 assert.equal(new Set(contract.fields.map(f=>f.canonicalColumn.toLowerCase())).size,63);
 assert.equal(contract.fields.filter(f=>f.requiredValue).length,2);
});
test('real template quoting, reordering, exact totals and blank vs zero',()=>{
 const r=validateReport(csv([sample,{...sample,date:'2026-04-02','metrics.spend':'0','metrics.sales':'0',
  'metrics.total_sales':'-1.25','metrics.ordered_revenue':'-1.25'}],[...HEADERS].reverse()));
 assert.equal(r.valid,true);assert.equal(r.rows,2);assert.equal(r.uniqueDates,2);
 assert.equal(r.totals['metrics.total_sales'],'18.75');assert.equal(r.totals['metrics.sales'],'25.5');
 assert.equal(r.totals['metrics.spend'],'10.25');assert.equal(r.coverage['metrics.spend'].zero,1);
 assert.equal(r.coverage.sku.populated,0);assert.equal(r.coverage['metrics.daily_budget'].populated,0);
});
test('all missing metric values stay unknown, not zero',()=>{
 const r=validateReport(csv([{asin:'B000000001',date:'2026-04-01'}]));
 assert.equal(r.valid,true);assert.equal(r.totals['metrics.spend'],null);assert.equal(r.populations.neitherRows,1);
});
test('reject malformed numbers, dates, ASINs, source conflicts and fractional counts',()=>{
 const r=validateReport(csv([{...sample,date:'2026-02-30'}, {...sample,asin:'invalid'},
  {...sample,'metrics.spend':'12abc'}, {...sample,'metrics.orders':'1.5'},
  {...sample,'metrics.ordered_revenue':'999'}]));
 assert.equal(r.valid,false);assert.equal(r.invalidRows,5);assert.equal(r.validRows,0);
 assert.deepEqual(new Set(r.issues.map(x=>x.code)),new Set(['invalid_date','invalid_asin','invalid_numeric','source_total_mismatch']));
});
test('duplicate identities are distinguished, never silently overwritten',()=>{
 const r=validateReport(csv([sample,sample,{...sample,'metrics.spend':'15'}]));
 assert.equal(r.valid,false);assert.equal(r.validRows,1);assert.equal(r.exactDuplicates,1);assert.equal(r.conflictingDuplicates,1);
});
test('reject malformed/unknown/duplicate headers and broken CSV quotes',()=>{
 assert.throws(()=>validateReport(csv([sample],HEADERS.slice(1))),{code:'invalid_header'});
 assert.throws(()=>validateReport(csv([sample],[...HEADERS.slice(0,-1),HEADERS[0]])),{code:'invalid_header'});
 assert.throws(()=>validateReport(Buffer.from(HEADERS.join(',')+'\n"unfinished')),{code:'malformed_csv'});
 assert.throws(()=>validateReport(Buffer.from([255,254,255])),{code:'invalid_encoding'});
});
test('signed precision, valid calendar and overflow checks',()=>{
 assert.equal(numberText('-000.1200',false),'-0.12');assert.equal(numberText('0.000',false),'0');
 assert.equal(numberText('-1',true),'-1');assert.throws(()=>numberText('9223372036854775808',true));
 assert.throws(()=>numberText('1.12345678901',false));assert.equal(validDate('2024-02-29'),true);assert.equal(validDate('2026-02-29'),false);
});

test('interspersed blank spreadsheet records are skipped in validation and replay',()=>{
 const record=r=>HEADERS.map(h=>quote(r[h])).join(',');
 const bare='',commas=','.repeat(62),quoted=HEADERS.map(()=>quote('')).join(','),whitespace=HEADERS.map(()=>quote(' \t ')).join(',');
 const lines=[HEADERS.map(quote).join(','),bare,record(sample),commas,quoted,whitespace,record({...sample,date:'2026-04-02'}),',,','   '];
 const input=Buffer.from('\uFEFF'+lines.join('\r\n'));
 const r=validateReport(input);
 assert.equal(r.valid,true);assert.equal(r.rows,2);assert.equal(r.sourceRecords,8);assert.equal(r.skippedBlankRows,6);
 assert.equal(r.validRows,2);assert.equal(r.invalidRows,0);assert.equal(r.issueCount,0);
 assert.equal(r.totals['metrics.spend'],'20.5');assert.equal(r.coverage.asin.populated,2);
 assert.equal(r.sourceFileSha256,createHash('sha256').update(input).digest('hex'));
 const replay=[...replayValidatedRows(input,r.sourceFileSha256)];
 assert.deepEqual(replay.map(x=>x[0]),[3,7]);assert.equal(replay.length,2);
 assert.equal(replay[1][HEADERS.indexOf('date')+1],'2026-04-02');
});
test('partial records and zeros are still validated at their original record numbers',()=>{
 const record=r=>HEADERS.map(h=>quote(r[h])).join(',');
 const input=Buffer.from([HEADERS.join(','),record(sample),'',record({'metrics.spend':'0'}),record({sku:'None'}),',,',record({asin:'B000000001'}),'',record({date:'2026-04-02'}),'value,',''].join('\n'));
 const r=validateReport(input);
 assert.equal(r.valid,false);assert.equal(r.rows,6);assert.equal(r.skippedBlankRows,3);assert.equal(r.validRows,1);assert.equal(r.invalidRows,5);
 assert.deepEqual(r.issues.map(i=>[i.row,i.code]),[[4,'invalid_asin'],[4,'invalid_date'],[5,'invalid_asin'],[5,'invalid_date'],[7,'invalid_date'],[9,'invalid_asin'],[10,'row_width']]);
});
test('all-blank data is rejected as no_data; header validation and duplicate rules are unchanged',()=>{
 const input=Buffer.from(HEADERS.join(',')+'\n'+','.repeat(62)+'\n\n'+HEADERS.map(()=>quote(' ')).join(',')+'\n');
 const r=validateReport(input);
 assert.equal(r.valid,false);assert.equal(r.rows,0);assert.equal(r.skippedBlankRows,3);assert.equal(r.issueCount,1);assert.equal(r.issues[0].code,'no_data');
 const duplicates=validateReport(csv([sample,{},sample]));
 assert.equal(duplicates.valid,false);assert.equal(duplicates.skippedBlankRows,1);assert.equal(duplicates.exactDuplicates,1);assert.equal(duplicates.issues[0].row,4);
 assert.throws(()=>validateReport(Buffer.from('\n'+HEADERS.join(',')+'\n')),{code:'invalid_header'});
});
