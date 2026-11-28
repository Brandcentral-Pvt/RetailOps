'use strict';
const {resolveSellerScope}=require('../utils/sellerScope');
const norm=v=>String(v||'').trim().toLowerCase();
function resolveContext(seller) {
  // Known India marketplace identifier supplies its configured currency. Ambiguous
  // labels require an explicit server configuration, never a client currency.
  const raw=norm(seller.Marketplace);
  if (['amazon.in','amazon india','amazon_in','amazon-in'].includes(raw)) return {marketplace:'amazon.in',currency:'INR'};
  let map={};
  try { map=JSON.parse(process.env.ADS_SELLER_CONTEXT_JSON||'{}'); } catch { return null; }
  const item=map && Object.hasOwn(map,seller.Id)?map[seller.Id]:null;
  if (!item || norm(item.catalogMarketplace)!==raw || typeof item.marketplace!=='string' ||
      !/^amazon\.[a-z.]{2,12}$/.test(item.marketplace) || !/^[A-Z]{3}$/.test(item.currency)) return null;
  return {marketplace:item.marketplace,currency:item.currency};
}

class AdsScopeError extends Error {
  constructor(code,message,status=400){super(message);this.name='AdsScopeError';this.code=code;this.status=status;}
}
function strictScope(user,requested){
  if(!user||typeof user!=='object')throw new AdsScopeError('authentication_required','Authentication is required.',401);
  if(requested!==undefined&&requested!==null){
    const items=Array.isArray(requested)?requested:[requested];
    if(items.length>1000||items.some(x=>typeof x!=='string'||x.length>51000))
      throw new AdsScopeError('invalid_seller_filter','Invalid seller selection.');
    const tokens=items.flatMap(x=>x.split(',')).map(x=>x.trim());
    const sentinel=tokens.filter(x=>!x||/^(all|\*)$/i.test(x));
    if(tokens.length>1000||tokens.some(x=>x.length>50)|| (sentinel.length&&tokens.length!==1))
      throw new AdsScopeError('invalid_seller_filter','Invalid or mixed seller selection.');
  }
  const scope=resolveSellerScope(user,requested);
  if(scope.denied||(!scope.isGlobal&&scope.requested.some(id=>!scope.allowed.includes(id))))
    throw new AdsScopeError('forbidden_seller','You do not have access to every requested seller.',403);
  if(!scope.unrestricted&&scope.sellerIds.some(id=>typeof id!=='string'||!id||id.length>50))
    throw new AdsScopeError('invalid_seller_scope','Invalid assigned seller scope.',403);
  return scope;
}
function explicitSeller(user,sellerId){
  if(typeof sellerId!=='string'||sellerId!==sellerId.trim()||!sellerId||sellerId.length>50||/[,\s*]/.test(sellerId)||/^all$/i.test(sellerId))
    throw new AdsScopeError('seller_required','Select one explicit internal seller ID.');
  const scope=strictScope(user,sellerId);
  if(scope.empty||!scope.sellerIds.includes(sellerId))throw new AdsScopeError('forbidden_seller','You do not have access to this seller.',403);
  return sellerId;
}
module.exports={resolveContext,strictScope,explicitSeller,AdsScopeError};
