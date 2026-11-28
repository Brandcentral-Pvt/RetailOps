import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardPrincipal,matchesDashboardScope,dashboardSellerParam,isDashboardGlobal,canDashboardPermission} from '../../utils/dashboardScope.mjs';
test('principal key changes with identity, seller assignments, role and permissions',()=>{
 const user={Id:'a',role:{name:'brand_manager'},assignedSellers:['s1','s2'],permissions:['dashboard_view']};
 const key=dashboardPrincipal(user);
 assert.notEqual(key,dashboardPrincipal({...user,Id:'b'}));
 assert.notEqual(key,dashboardPrincipal({...user,assignedSellers:['s1']}));
 assert.notEqual(key,dashboardPrincipal({...user,permissions:[]}));
 assert.notEqual(key,dashboardPrincipal({...user,role:{name:'admin'}}));
 assert.equal(key,dashboardPrincipal({...user,assignedSellers:['s2','s1']}));
 assert.equal(dashboardPrincipal(null),'');
});
test('unresolved and empty scopes cannot become an all-seller request',()=>{
 assert.equal(dashboardSellerParam(null),null);
 assert.equal(dashboardSellerParam({empty:true,unrestricted:false,sellerIds:[]}),null);
 assert.equal(matchesDashboardScope(null,'s1'),false);
 assert.equal(matchesDashboardScope({empty:true,unrestricted:false,sellerIds:[]},'s1'),false);
 const scoped={empty:false,unrestricted:false,sellerIds:['s1']};
 assert.equal(dashboardSellerParam(scoped),'s1');
 assert.equal(matchesDashboardScope(scoped,'s1'),true);
 assert.equal(matchesDashboardScope(scoped,'s2'),false);
 assert.equal(matchesDashboardScope(scoped,null),false);
 assert.equal(dashboardSellerParam({empty:false,unrestricted:true,sellerIds:[]}),undefined);
});
test('module visibility uses actual effective grants and wildcard',()=>{
 assert.equal(canDashboardPermission({role:{name:'admin'},permissions:[]},'tasks_view'),false);
 assert.equal(canDashboardPermission({permissions:['*']},'tasks_view'),true);
 assert.equal(canDashboardPermission({permissions:['dashboard_view']},'tasks_view'),false);
 assert.equal(isDashboardGlobal({role:{name:'operational_manager'}}),true);
 assert.equal(isDashboardGlobal({role:{name:'brand_manager'}}),false);
});
