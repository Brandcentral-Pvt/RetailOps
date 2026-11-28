// Query identity includes authorization, not only a display name or role.
export function dashboardPrincipal(user){
 if(!user)return '';
 const id=String(user.Id??user.id??user._id??'');
 if(!id)return '';
 const sellers=(user.assignedSellers||[]).map(s=>String(typeof s==='object'?(s?._id??s?.Id??s?.id??''):s)).filter(Boolean).sort();
 const permissions=(user.permissions||[]).map(String).sort();
 const role=String(user.role?.Name??user.role?.name??user.role??'').toLowerCase();
 return JSON.stringify([id,role,sellers,permissions]);
}
export function matchesDashboardScope(scope,sellerId){
 if(!scope||scope.empty)return false;
 if(scope.unrestricted)return true;
 return sellerId!=null&&Array.isArray(scope.sellerIds)&&scope.sellerIds.includes(String(sellerId));
}
export function dashboardSellerParam(scope){
 if(!scope||scope.empty)return null;
 return scope.unrestricted?undefined:scope.sellerIds.length?scope.sellerIds.join(','):null;
}
export function isDashboardGlobal(user){
 const role=String(user?.role?.Name??user?.role?.name??user?.role??'').trim().toLowerCase().replace(/[\s-]+/g,'_');
 return ['admin','super_admin','superadmin','developer','operational_manager','operationalmanager'].includes(role);
}
