'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {exactSum,metricProjection,percentage,change,periodCoverage}=require('../services/dashboardFinancialMetrics');
test('GMS exact sum preserves cents, zero and unknown values',()=>{
 assert.equal(exactSum([{v:'0.10'},{v:'0.20'},{v:'-0.01'}],'v'),0.29);
 assert.equal(exactSum([{v:'0.00'}],'v'),0);
 assert.equal(exactSum([{v:'1.00'},{v:null}],'v'),null);
 assert.equal(exactSum([],'v'),null);
 assert.equal(exactSum([{v:'4'},{v:'5'}],'v',0),9);
 assert.throws(()=>exactSum([{v:'0.001'}],'v'));
 assert.throws(()=>exactSum([{v:'90071992547409.92'}],'v'));
});
test('period comparisons and denominator semantics',()=>{
 assert.equal(change(100,50,false),null);
 assert.equal(change(0,50,true),-100);
 assert.equal(change(null,50,true),null);
 assert.equal(percentage(0,50),0);
 assert.equal(percentage(null,50),null);
 assert.equal(percentage(50,0),null);
 assert.deepEqual(periodCoverage([{}],2),{observedDays:1,expectedDays:2,complete:false});
});
test('SQL projection preserves null rather than manufacturing zero',()=>{
 const sql=metricProjection('g.OrderedRevenue','Revenue',{condition:'g.Date>=@startDate'});
 assert.match(sql,/COUNT_BIG/);
 assert.match(sql,/CONVERT\(varchar\(50\),SUM/);
 assert.doesNotMatch(sql,/ISNULL|ELSE 0/);
});
