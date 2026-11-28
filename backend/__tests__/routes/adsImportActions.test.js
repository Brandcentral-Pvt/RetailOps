// Exercise the real Ads upload routes and controller behind Express strict JSON.
const express=require('express'),request=require('supertest');
const {errorHandler}=require('../../utils/errors');
let mockUser;
const mockConfirm=jest.fn(),mockCancel=jest.fn();
jest.mock('../../database/db',()=>({sql:require('../../testUtils/fakePool').FAKE_SQL,getPool:async()=>({}),generateId:()=> 'test-id'}));
jest.mock('../../middleware/auth',()=>({
 authenticate:(req,res,next)=>{if(!mockUser)return res.sendStatus(401);req.user=mockUser;next();},
 requirePermission:p=>(req,res,next)=>{if(!req.user.permissions.some(x=>x==='*'||x===p))return res.sendStatus(403);next();}
}));
jest.mock('../../middleware/rateLimiter',()=>({createLimiter:()=> (_req,_res,next)=>next()}));
jest.mock('../../services/marketDataSyncService',()=>({}));
jest.mock('../../services/SystemLogService',()=>({}));
jest.mock('../../services/socketService',()=>({}));
jest.mock('../../services/adsImportJobs',()=>({confirmJob:(...args)=>mockConfirm(...args),cancelJob:(...args)=>mockCancel(...args)}));
const app=express();app.use(express.json({limit:'10mb'}));app.use('/api',require('../../routes/uploadRoutes'));app.use(errorHandler);
const id='00000000-0000-4000-8000-000000000001',path='/api/upload/ads-imports/'+id;
beforeEach(()=>{jest.clearAllMocks();mockUser={Id:'u1',role:{name:'brand_manager'},assignedSellers:['s1'],permissions:['adsreport_import']};mockConfirm.mockResolvedValue({id,status:'COMPLETED',result:{persisted:true,inserted:1}});mockCancel.mockResolvedValue({id,status:'CANCELLED'});});
test('regression: JSON null rejected without invoking confirmation',async()=>{
 const res=await request(app).post(path+'/confirm').set('Content-Type','application/json').send('null');
 expect(res.status).toBe(400);expect(res.body.code).toBe('INVALID_JSON');expect(mockConfirm).not.toHaveBeenCalled();
});
test('empty JSON object and bodyless confirm reach the durable job controller',async()=>{
 for(const call of [request(app).post(path+'/confirm').send({}),request(app).post(path+'/confirm')]){
  const res=await call;expect(res.status).toBe(200);expect(res.body.data.status).toBe('COMPLETED');
 }
 expect(mockConfirm).toHaveBeenCalledTimes(2);
 expect(mockConfirm.mock.calls[0][0]).toMatchObject({id,user:mockUser});
});
test('cancel accepts an empty JSON object; permission checks still gate writes',async()=>{
 const res=await request(app).post(path+'/cancel').send({});expect(res.status).toBe(200);expect(mockCancel).toHaveBeenCalledTimes(1);
 mockUser.permissions=['adsreport_view'];
 expect((await request(app).post(path+'/confirm').send({})).status).toBe(403);
 expect((await request(app).post(path+'/cancel').send({})).status).toBe(403);
 expect(mockConfirm).not.toHaveBeenCalled();expect(mockCancel).toHaveBeenCalledTimes(1);
});
