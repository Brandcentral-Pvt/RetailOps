import test from 'node:test';
import assert from 'node:assert/strict';
import {sameProductPageScope} from '../../pages/ads/adsWorkspacePerformance.mjs';
const filters={sellerId:'s1',startDate:'2026-04-01',endDate:'2026-04-30',sortBy:'totalSales',sortOrder:'desc',groupBy:'asin'};
const key=(page=1,override={},principal='u1',limit=50)=>['ads-canonical',principal,'report',{...filters,...override},page,limit];
test('only page changes within identical report scope retain rows',()=>{
 assert.equal(sameProductPageScope(key(),key(2)),true);
 assert.equal(sameProductPageScope(key(),key()),false);
 for(const change of [{sellerId:'s2'},{search:'ASIN'},{startDate:'2026-04-02'},{sortOrder:'asc'},{groupBy:'seller'},{currency:'USD'},{brand:'B'}])assert.equal(sameProductPageScope(key(),key(2,change)),false);
 assert.equal(sameProductPageScope(key(),key(2,{},'u2')),false);
 assert.equal(sameProductPageScope(key(),key(2,{},'u1',100)),false);
 assert.equal(sameProductPageScope(undefined,key()),false);
 const reordered=key(2);reordered[3]=Object.fromEntries(Object.entries(reordered[3]).reverse());
 assert.equal(sameProductPageScope(key(),reordered),true);
});
