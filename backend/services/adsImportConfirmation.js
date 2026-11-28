'use strict';
// Short-lived server-signed confirmation. No server-side temporary upload is retained.
const {createHmac,timingSafeEqual}=require('node:crypto');
const {AdsScopeError}=require('./adsCanonicalScope');
const TTL_MS=30*60*1000;
const fail=()=>{throw new AdsScopeError('invalid_confirmation','Validation expired or no longer matches this file and seller. Validate again.',409);};
const actor=user=>user?.Id||user?._id||user?.id;
const secret=()=>{
  const root=process.env.JWT_SECRET;
  if(typeof root!=='string'||!root.length)throw new AdsScopeError('confirmation_unavailable','Import confirmation is unavailable.',503);
  return createHmac('sha256',root).update('retailops:ads:product-daily:confirmation:v1').digest();
};
const sign=body=>createHmac('sha256',secret()).update(body).digest();
function issueConfirmation({user,sellerId,marketplace,currency,sourceFileSha256,now=Date.now()}){
  const id=actor(user);
  if(typeof id!=='string'||!id||id.length>50||!(/^[a-f0-9]{64}$/).test(sourceFileSha256))fail();
  const body=Buffer.from(JSON.stringify({v:1,actor:id,sellerId,marketplace,currency,hash:sourceFileSha256,exp:now+TTL_MS})).toString('base64url');
  return body+'.'+sign(body).toString('base64url');
}
function verifyConfirmation({token,user,sellerId,sourceFileSha256,now=Date.now()}){
  if(typeof token!=='string'||token.length>1024||!(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/).test(token))fail();
  const [body,sig]=token.split('.');
  const actual=Buffer.from(sig,'base64url'),expected=sign(body);
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))fail();
  let p;
  try{p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));}catch{fail();}
  if(p?.v!==1||p.actor!==actor(user)||p.sellerId!==sellerId||p.hash!==sourceFileSha256||!Number.isSafeInteger(p.exp)||p.exp<=now||p.exp>now+TTL_MS||
    typeof p.marketplace!=='string'||typeof p.currency!=='string')fail();
  return {marketplace:p.marketplace,currency:p.currency};
}
// The durable importer is now released behind adsreport_import and seller
// authorization. An unset setting permits authorized confirmation. An explicit
// false (or malformed configured value) remains a server-side safety stop.
const importsEnabled=(env=process.env)=>env.ADS_CANONICAL_IMPORT_ENABLED===undefined||String(env.ADS_CANONICAL_IMPORT_ENABLED).trim().toLowerCase()==='true';
module.exports={issueConfirmation,verifyConfirmation,importsEnabled,TTL_MS};
