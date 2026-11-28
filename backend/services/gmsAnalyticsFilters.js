const {sql}=require('../database/db');
const {resolveSellerScope}=require('../utils/sellerScope');

// A report filter is a directory, not the Sellers dashboard. No ASIN
// counts, activity, integration settings or seller secrets are needed.
async function loadGmsFilters(pool,user){
  const scope=resolveSellerScope(user);
  if(scope.empty)return {sellers:[],managers:[]};
  const q=pool.request();
  const allowed=scope.isGlobal?[]:[...new Set(scope.allowed)];
  let sellerWhere='',managerJoin='',managerWhere='';
  if(!scope.isGlobal){
    q.input('allowedSellerIds',sql.NVarChar(sql.MAX),JSON.stringify(allowed));
    sellerWhere=' WHERE EXISTS (SELECT 1 FROM OPENJSON(@allowedSellerIds) j WHERE j.value=s.Id)';
    managerJoin=' AND EXISTS (SELECT 1 FROM OPENJSON(@allowedSellerIds) j WHERE j.value=us.SellerId)';
    // Restricted users only see managers associated with their own sellers.
    managerWhere=' AND s.Id IS NOT NULL';
  }
  const result=await q.query(
    'SET NOCOUNT ON; SELECT s.Id AS id,s.Name AS name FROM Sellers s'+sellerWhere+' ORDER BY s.Name,s.Id; '+
    'SELECT u.Id AS id,u.FirstName AS firstName,u.LastName AS lastName,s.Id AS sellerId '+
    'FROM Users u JOIN Roles r ON u.RoleId=r.Id LEFT JOIN UserSellers us ON u.Id=us.UserId'+managerJoin+
    ' LEFT JOIN Sellers s ON us.SellerId=s.Id WHERE u.IsActive=1 AND (r.Name LIKE \'%manager%\' OR r.Name LIKE \'%admin%\' OR r.Level>=2)'+managerWhere+
    ' ORDER BY u.FirstName,u.LastName,u.Id,s.Id;'
  );
  const [sellerRows,managerRows]=result.recordsets;
  // The SQL scope is primary. This second guard prevents returning labels or
  // associations outside the effective directory even if a fixture/driver
  // produces an unexpected extra row.
  const permitted=new Set(allowed);
  const sellers=sellerRows.filter(r=>scope.isGlobal||permitted.has(String(r.id))).map(r=>({id:String(r.id),name:r.name}));
  const sellerIds=new Set(sellers.map(s=>s.id));
  const managers=new Map();
  for(const r of managerRows){
    const id=String(r.id),sellerId=r.sellerId==null?null:String(r.sellerId);
    if(!scope.isGlobal&&!sellerIds.has(sellerId))continue;
    if(!managers.has(id))managers.set(id,{id,firstName:r.firstName,lastName:r.lastName,assignedSellers:new Set()});
    if(sellerIds.has(sellerId))managers.get(id).assignedSellers.add(sellerId);
  }
  return {sellers,managers:[...managers.values()].map(m=>({...m,assignedSellers:[...m.assignedSellers]}))};
}
module.exports={loadGmsFilters};
