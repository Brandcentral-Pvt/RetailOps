'use strict';
// Canonical transactional writer. HTTP callers must authenticate, authorize and verify confirmation before invocation.
const contract=require('../contracts/ads-product-daily-v1.json');
const {validateReport,replayValidatedRows,AdsValidationError,MAX_FILE_BYTES}=require('./adsProductContract');
const {explicitSeller,resolveContext,AdsScopeError}=require('./adsCanonicalScope');
const {createHash}=require('node:crypto');
const FIELDS=contract.fields;
const COLUMNS=FIELDS.map(f=>'['+f.canonicalColumn+']');
const stageColumns=['SourceRowNumber',...COLUMNS].join(',');
const jsonColumns=["SourceRowNumber int '$[0]'",...FIELDS.map((f,i)=>'['+f.canonicalColumn+'] '+f.sqlType+" '$["+(i+1)+"]'")].join(',');
const matching="t.SellerId=@seller AND t.Marketplace=@marketplace AND t.ReportType='daily' AND t.Asin=s.Asin AND t.[Date]=s.[Date]";
const compareColumns=FIELDS.filter(f=>f.canonicalColumn!=='Asin'&&f.canonicalColumn!=='Date').map(f=>'['+f.canonicalColumn+']');
const selectCols=alias=>compareColumns.map(c=>c==='[AdvertisedSku]'?'CONVERT(varbinary(510),'+alias+'.'+c+')':alias+'.'+c).join(',');
const mismatch="EXISTS (SELECT "+selectCols('s')+" EXCEPT SELECT "+selectCols('t')+") OR t.Currency<>@currency";
const BATCH_ROWS=1000;

class AdsIngestionError extends Error {
  constructor(code,message,details={}){super(message);this.name='AdsIngestionError';this.code=code;this.details=details;}
}
function actorId(user){
  const id=user?.Id||user?._id||user?.id;
  if(typeof id!=='string'||!id.trim()||id.length>50)throw new AdsScopeError('actor_required','A valid authenticated actor is required.',401);
  return id;
}
function bindScope(request,sql,{sellerId,marketplace,currency}){
  return request.input('seller',sql.VarChar(50),sellerId).input('marketplace',sql.NVarChar(50),marketplace).input('currency',sql.Char(3),currency);
}
async function ingestCanonicalReport({pool,sql,user,sellerId,reportType,input,expectedContext=null,lifecycle=null}){
  const seller=explicitSeller(user,sellerId);
  const actor=actorId(user);
  if(reportType!=='daily')throw new AdsIngestionError('unsupported_report_type','Only product_daily v1 is supported.');
  if(!Buffer.isBuffer(input)||!input.length||input.length>MAX_FILE_BYTES)throw new AdsIngestionError('invalid_file_size','A bounded CSV Buffer is required.');
  // Own the bytes so the caller cannot mutate them between validation and SQL writes.
  const bytes=Buffer.from(input);
  if(lifecycle?.progress)await lifecycle.progress('validating',0);
  const report=validateReport(bytes);
  if(!report.valid)throw new AdsIngestionError('validation_failed','No data imported; resolve all validation issues.',{issueCount:report.issueCount,issues:report.issues});
  const tx=new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  let stage='staging';
  try{
    if(lifecycle?.begin){stage='job_lock';await lifecycle.begin(tx,report);}
    stage='staging';
    if(lifecycle?.progress)await lifecycle.progress(stage,0);
    // batch (not query) creates a connection-local temp table that survives subsequent
    // sp_executesql requests on this transaction's pinned connection.
    await tx.request().batch('SELECT TOP (0) '+stageColumns+' INTO #AdsStage FROM dbo.AdsProductDailyFacts; CREATE UNIQUE CLUSTERED INDEX IX_AdsStage ON #AdsStage(Asin,[Date]);');
    let batch=[],staged=0;
    const flush=async()=>{
      if(!batch.length)return;
      await tx.request().input('payload',sql.NVarChar(sql.MAX),JSON.stringify(batch))
        .query('INSERT #AdsStage ('+stageColumns+') SELECT '+stageColumns+' FROM OPENJSON(@payload) WITH ('+jsonColumns+');');
      staged+=batch.length;batch=[];
      if(lifecycle?.progress&&(staged%5000===0||staged===report.validRows))await lifecycle.progress('staging',staged);
    };
    for(const row of replayValidatedRows(bytes,report.sourceFileSha256)){
      batch.push(row);if(batch.length===BATCH_ROWS)await flush();
    }
    await flush();
    const actualStage=await tx.request().query('SELECT COUNT_BIG(*) AS n FROM #AdsStage;');
    if(staged!==report.validRows||Number(actualStage.recordset[0].n)!==staged)throw new AdsIngestionError('staging_mismatch','Validated and staged record counts disagree.');
    // All writers using this service serialize per seller; database key/range locks
    // provide a second protection against conflicting concurrent writes.
    stage='seller_lock';
    if(lifecycle?.progress)await lifecycle.progress(stage,staged);
    const lockKey='retailops:ads-writer:'+createHash('sha256').update(seller).digest('hex');
    await tx.request().input('resource',sql.NVarChar(255),lockKey).query(
      "DECLARE @lock int; EXEC @lock=sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000; IF @lock<0 THROW 51030,'Ads import lock unavailable',1;");
    const sellerResult=await tx.request().input('seller',sql.VarChar(50),seller)
      .query('SELECT Id,Marketplace FROM dbo.Sellers WITH (UPDLOCK,HOLDLOCK) WHERE Id=@seller;');
    const sellerRow=sellerResult.recordset[0];
    if(!sellerRow||sellerRow.Id!==seller)throw new AdsIngestionError('seller_not_found','The selected seller is not available.');
    const context=resolveContext(sellerRow);
    if(!context)throw new AdsIngestionError('seller_context_unverified','The seller marketplace and currency must be verified.');
    if(expectedContext&&(expectedContext.marketplace!==context.marketplace||expectedContext.currency!==context.currency))
      throw new AdsIngestionError('seller_context_changed','Seller marketplace or currency changed after validation. Validate again.');
    const scope={sellerId:seller,...context};
    // Require exactly one catalog mapping under the explicit seller. A shared ASIN
    // owned by this seller and another is allowed; foreign-only, unknown, and
    // ambiguous same-seller catalog keys are rejected. No catalog auto-creation.
    stage='catalog_ownership';
    if(lifecycle?.progress)await lifecycle.progress(stage,staged);
    const owner=await bindScope(tx.request(),sql,scope).query(
      "SELECT COUNT_BIG(*) AS invalidKeys FROM (SELECT s.Asin FROM (SELECT DISTINCT Asin FROM #AdsStage) s LEFT JOIN dbo.Asins a WITH (UPDLOCK,HOLDLOCK) ON a.AsinCode=s.Asin AND a.SellerId=@seller GROUP BY s.Asin HAVING COUNT_BIG(a.AsinCode)<>1) x;");
    const invalidKeys=Number(owner.recordset[0].invalidKeys);
    if(invalidKeys)throw new AdsIngestionError('catalog_ownership_conflict','Every source ASIN must have one catalog mapping under the selected seller.',{invalidKeys});
    stage='historical_conflict_check';
    if(lifecycle?.progress)await lifecycle.progress(stage,staged);
    const conflicts=await bindScope(tx.request(),sql,scope).query(
      "SELECT COUNT_BIG(*) AS conflictCount FROM #AdsStage s JOIN dbo.AdsProductDailyFacts t WITH (UPDLOCK,HOLDLOCK) ON "+matching+" WHERE "+mismatch+"; "+
      "SELECT COUNT_BIG(*) AS currencyConflicts FROM dbo.AdsProductDailyFacts WITH (UPDLOCK,HOLDLOCK) WHERE SellerId=@seller AND Marketplace=@marketplace AND Currency<>@currency;");
    if(Number(conflicts.recordsets[1][0].currencyConflicts))
      throw new AdsIngestionError('currency_conflict','Existing seller facts use another currency; explicit migration is required.');
    const conflictCount=Number(conflicts.recordsets[0][0].conflictCount);
    if(conflictCount)throw new AdsIngestionError('historical_conflict','Existing facts differ from this report. No rows were replaced.',{conflictCount});
    stage='insert';
    if(lifecycle?.progress)await lifecycle.progress(stage,staged);
    const result=await bindScope(tx.request(),sql,scope)
      .input('hash',sql.Char(64),report.sourceFileSha256).input('actor',sql.VarChar(50),actor)
      .query("INSERT dbo.AdsProductDailyFacts (SellerId,Marketplace,Currency,ReportType,"+COLUMNS.join(',')+",SourceFileSha256,SourceRowNumber,SourceSchemaVersion,ImportedBy) "+
        "SELECT @seller,@marketplace,@currency,'daily',"+COLUMNS.map(c=>'s.'+c).join(',')+",@hash,s.SourceRowNumber,1,@actor FROM #AdsStage s "+
        "WHERE NOT EXISTS (SELECT 1 FROM dbo.AdsProductDailyFacts t WITH (UPDLOCK,HOLDLOCK) WHERE "+matching+"); SELECT @@ROWCOUNT AS inserted;");
    const inserted=Number(result.recordset[0].inserted);
    stage='reconcile';
    if(lifecycle?.progress)await lifecycle.progress(stage,staged);
    const reconciled=await bindScope(tx.request(),sql,scope).query(
      "SELECT COUNT_BIG(*) AS reconciled FROM #AdsStage s JOIN dbo.AdsProductDailyFacts t ON "+matching+
      " WHERE t.Currency=@currency AND NOT EXISTS (SELECT "+selectCols('s')+" EXCEPT SELECT "+selectCols('t')+");");
    if(Number(reconciled.recordset[0].reconciled)!==staged)throw new AdsIngestionError('reconciliation_failed','Persisted facts do not match the validated report.');
    await tx.request().batch('DROP TABLE #AdsStage;');
    const output={sellerId:seller,...context,reportType:'daily',inserted,unchanged:staged-inserted,sourceFileSha256:report.sourceFileSha256,report};
    if(lifecycle?.progress)await lifecycle.progress('commit',staged);
    if(lifecycle?.complete){stage='job_complete';await lifecycle.complete(tx,output);}
    stage='commit';
    await tx.commit();
    return output;
  }catch(e){
    try{await tx.rollback();}catch{/* SQL may already have rolled back. */}
    if(e instanceof AdsIngestionError||e instanceof AdsScopeError||e instanceof AdsValidationError)throw e;
    throw new Error('Canonical Ads writer failed at '+stage+': '+e.message,{cause:e});
  }
}
module.exports={ingestCanonicalReport,AdsIngestionError,BATCH_ROWS};
