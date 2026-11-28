jest.mock('../../database/db',()=>({sql:require('../../testUtils/fakePool').FAKE_SQL}));
const {createReportLoader,cacheIdentity,sliceBlock,readReportRevision}=require('../../services/gmsAnalyticsReportCache');
const {pageSpec}=require('../../services/gmsAnalyticsPageService');
const {makeFakePool}=require('../../testUtils/fakePool');
const admin={id:'U1',role:{name:'admin'},assignedSellers:[]};
const input={startDate:'2026-11-01',endDate:'2026-11-27',page:1,pageSize:25};
function memoryCache(){
  const values=new Map();
  return {isEnabled:jest.fn(async()=>true),key:(...p)=>p.join(':'),get:jest.fn(async k=>values.get(k)||null),set:jest.fn(async(k,v)=>{values.set(k,JSON.parse(JSON.stringify(v)));}),values};
}
function fixture({total=251}={}){
  let revision='initial',amount=1;
  const cache=memoryCache();
  const readRevision=jest.fn(async()=>revision);
  const load=jest.fn(async(_pool,_user,spec,{onTiming})=>{
    const page=Math.max(1,Math.min(spec.page,Math.ceil(total/spec.pageSize)));
    const start=(page-1)*spec.pageSize;
    onTiming({sqlMs:10,composeMs:2});
    return {
      kpis:{orderedRevenue:total*amount},comparison:{},meta:{records:total},
      matrixRows:Array.from({length:Math.min(spec.pageSize,Math.max(0,total-start))},(_,i)=>({key:'B'+String(start+i+1).padStart(9,'0'),orderedRevenue:amount})),
      pagination:{page,pageSize:spec.pageSize,totalRows:total},sort:spec.sort
    };
  });
  const service=createReportLoader({cache,readRevision,load});
  return {cache,readRevision,load,service,change:(rev,value=2)=>{revision=rev;amount=value;}};
}
describe('revision-aware report blocks',()=>{
  test('adjacent pages reuse a bounded sorted block and preserve full-report KPIs',async()=>{
    const {service,load,cache}=fixture();
    const timing=jest.fn();
    const first=await service({},admin,input,{onTiming:timing});
    expect(first.pagination).toEqual({page:1,pageSize:25,totalRows:251});
    expect(first.matrixRows).toHaveLength(25);
    expect(load.mock.calls[0][2].pageSize).toBe(100);
    expect(timing).toHaveBeenLastCalledWith(expect.objectContaining({cacheStatus:'miss'}));
    const second=await service({},admin,{...input,page:2},{onTiming:timing});
    expect(second.matrixRows[0].key).toBe('B000000026');
    expect(second.kpis).toEqual(first.kpis);
    expect(load).toHaveBeenCalledTimes(1);
    expect(timing).toHaveBeenLastCalledWith(expect.objectContaining({cacheStatus:'hit',sqlMs:0}));
    expect(cache.set.mock.calls[0][2]).toBe(60);
    const distant=await service({},admin,{...input,page:5});
    expect(distant.matrixRows[0].key).toBe('B000000101');
    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.values.size).toBe(1);
  });
  test('revision change, explicit refresh, sort/filter and scope changes miss the cache',async()=>{
    const {service,load,change,cache}=fixture();
    const timing=jest.fn();
    await service({},admin,input);
    change('committed-fact-update',2);
    const updated=await service({},admin,input,{onTiming:timing});
    expect(updated.kpis.orderedRevenue).toBe(502);
    expect(timing).toHaveBeenLastCalledWith(expect.objectContaining({cacheStatus:'miss'}));
    await service({},admin,{...input,refresh:true},{onTiming:timing});
    expect(timing).toHaveBeenLastCalledWith(expect.objectContaining({cacheStatus:'refresh'}));
    await service({},admin,{...input,sort:{key:'orderedUnits',direction:'asc'}});
    await service({},admin,{...input,sellerIds:['S1']});
    await service({}, {...admin,role:{name:'brand_manager'},assignedSellers:['S1']},input);
    await service({}, {...admin,role:{name:'brand_manager'},assignedSellers:['S2']},input);
    await service({}, {...admin,id:'U2'},input);
    expect(load).toHaveBeenCalledTimes(8);
    expect(cache.values.size).toBe(2);
  });
  test('does not cache a block if revision changes while it is calculated',async()=>{
    const {service,load,readRevision,cache}=fixture();
    readRevision.mockResolvedValueOnce('before').mockResolvedValueOnce('after');
    const timing=jest.fn();
    const result=await service({},admin,input,{onTiming:timing});
    expect(result.matrixRows).toHaveLength(25);
    expect(load.mock.calls.map(c=>c[2].pageSize)).toEqual([100,25]);
    expect(cache.set).not.toHaveBeenCalled();
    expect(timing).toHaveBeenLastCalledWith(expect.objectContaining({cacheStatus:'revision-changed'}));
  });
  test('missing revision, Redis outage and long date ranges fall back to the original page size',async()=>{
    const {service,load,cache,readRevision}=fixture();
    const timing=jest.fn();
    readRevision.mockResolvedValueOnce(null);
    await service({},admin,input,{onTiming:timing});
    expect(timing).toHaveBeenLastCalledWith(expect.objectContaining({cacheStatus:'no-revision'}));
    cache.isEnabled.mockResolvedValueOnce(false);
    await service({},admin,input,{onTiming:timing});
    await service({},admin,{...input,startDate:'2026-01-01'},{onTiming:timing});
    expect(load.mock.calls.map(c=>c[2].pageSize)).toEqual([25,25,25]);
    expect(cache.set).not.toHaveBeenCalled();
  });
  test('public page size stays bounded and clamped last page contains only requested rows',async()=>{
    const {service}=fixture({total:103});
    const last=await service({},admin,{...input,page:999});
    expect(last.pagination).toEqual({page:5,pageSize:25,totalRows:103});
    expect(last.matrixRows.map(r=>r.key)).toEqual(['B000000101','B000000102','B000000103']);
    expect(()=>pageSpec({...input,pageSize:200})).toThrow();
    const spec=pageSpec(input),id=cacheIdentity(admin,spec);
    expect(sliceBlock({pagination:{page:1,pageSize:100,totalRows:103},matrixRows:[]},spec,id.blockSpec)).toBeNull();
    expect(cacheIdentity({...admin,role:{name:'brand_manager'},assignedSellers:[]},spec)).toBeNull();
  });
  test('read revision checks enabled triggers and rejects missing rows',async()=>{
    const revision='12345678-1234-1234-1234-123456789012';
    const pool=makeFakePool([{match:/FROM dbo.GmsReportRevision/,rows:['facts','catalog','sellers'].map(source=>({source,revision}))}]);
    expect(await readReportRevision(pool)).toBe([revision,revision,revision].join(':'));
    expect(pool.calls[0].sql).toContain('is_disabled=0');
    expect(await readReportRevision(makeFakePool())).toBeNull();
  });
});
