const express = require('express');
const request = require('supertest');
const { makeFakePool } = require('../../testUtils/fakePool');
const { dateOnly, dateWindow, exportWindow } = require('../../utils/gmsPhase1');

let mockUser;
let mockPool;
jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
  getPool: async () => mockPool,
  generateId: () => 'test-id',
  executeWithRetry: async fn => fn(),
}));
jest.mock('../../services/marketDataSyncService', () => ({}));
jest.mock('../../services/SystemLogService', () => ({}));
jest.mock('../../services/socketService', () => ({}));
jest.mock('../../controllers/exportAdsController', () => ({ startAdsExport: (_req, res) => res.sendStatus(200) }));
jest.mock('../../middleware/auth', () => {
  const authenticate = (req, res, next) => {
    if (!mockUser) return res.sendStatus(401);
    req.user = mockUser;
    next();
  };
  return {
    authenticate, auth: authenticate,
    requirePermission: permission => (req, res, next) => {
      if (!(req.user.permissions.includes('*') || req.user.permissions.includes(permission))) return res.sendStatus(403);
      next();
    },
  };
});
const app = express();
app.use(express.json());
app.use('/api', require('../../routes/uploadRoutes'));
app.use('/api/export', require('../../routes/exportRoutes'));

beforeEach(() => {
  mockUser = { id: 'u1', role: { name: 'brand_manager' }, assignedSellers: ['S1'], permissions: ['gms_tracker_view'] };
  mockPool = makeFakePool();
});

describe('GMS calendar dates', () => {
  test('valid calendar dates and legacy ISO values', () => {
    expect(dateOnly('2024-02-29')).toBe('2024-02-29');
    expect(dateOnly('2026-11-27T00:00:00.000Z')).toBe('2026-11-27');
    expect(exportWindow({ exportDateType: 'all' })).toEqual({ from: null, to: null });
    expect(exportWindow({ exportDateType: 'custom', exportCustomDates: ['2026-11-01', '2026-11-27'] })).toEqual({ from: '2026-11-01', to: '2026-11-27' });
  });
  test.each(['2026-02-29', '2026-11-31', '2026-13-01', '27/11/2026', 'invalid', ['2026-11-27']])('rejects malformed date %p', value => {
    expect(() => dateOnly(value)).toThrow();
  });
  test('rejects reversed and incomplete export windows', () => {
    expect(() => dateWindow('2026-11-27', '2026-11-01')).toThrow();
    expect(() => exportWindow({ exportDateType: 'current', startDate: '2026-11-01' })).toThrow();
    expect(() => exportWindow({ exportDateType: 'custom', exportCustomDates: ['2026-11-01'] })).toThrow();
  });
});

describe('GMS route security', () => {
  test('unauthenticated users cannot read metadata', async () => {
    mockUser = null;
    expect((await request(app).get('/api/upload/gms-asins')).status).toBe(401);
  });
  test('view permission alone cannot export or delete', async () => {
    expect((await request(app).post('/api/export/start-gms').send({})).status).toBe(403);
    expect((await request(app).post('/api/upload/gms-clear')).status).toBe(403);
    expect(mockPool.calls).toHaveLength(0);
  });
  test('export permission does not grant deletion even to a global user', async () => {
    mockUser.role.name = 'operational_manager';
    mockUser.permissions.push('gms_tracker_export');
    expect((await request(app).post('/api/upload/gms-clear')).status).toBe(403);
    expect(mockPool.calls).toHaveLength(0);
  });
  test('a scoped user cannot globally delete even with explicit permission', async () => {
    mockUser.permissions.push('gms_tracker_delete');
    expect((await request(app).post('/api/upload/gms-clear')).status).toBe(403);
    expect(mockPool.calls).toHaveLength(0);
  });
  test('global clear stays gated during staged-import rollout', async () => {
    mockUser.role.name = 'admin';
    mockUser.permissions = ['*'];
    expect((await request(app).post('/api/upload/gms-clear')).status).toBe(409);
    expect(mockPool.calls).toHaveLength(0);
  });
  test('legacy immediate-write upload cannot bypass staged preview', async () => {
    mockUser.permissions.push('gms_tracker_import');
    expect((await request(app).post('/api/upload/upload-gms')).status).toBe(409);
    expect(mockPool.calls).toHaveLength(0);
  });
  test('import history and commit require import permission', async () => {
    expect((await request(app).get('/api/upload/gms-imports')).status).toBe(403);
    expect((await request(app).post('/api/upload/gms-imports/foreign/confirm')).status).toBe(403);
    expect(mockPool.calls).toHaveLength(0);
  });
  test('even an importer cannot inspect or confirm another owner batch', async () => {
    mockUser.permissions.push('gms_tracker_import');
    expect((await request(app).get('/api/upload/gms-imports/foreign')).status).toBe(404);
    expect((await request(app).post('/api/upload/gms-imports/foreign/confirm')).status).toBe(404);
    for (const call of mockPool.calls) {
      expect(call.sql).toContain('OwnerId=@owner');
      expect(call.inputs.owner).toBe('u1');
    }
  });
  test('missing GMS fact column is reported as schema not ready', async () => {
    mockPool = makeFakePool([{ match:/INNER JOIN GmsDailyPerformance/, rows:() => {
      throw Object.assign(new Error('Invalid column name'), { number:207 });
    } }]);
    const res=await request(app).get('/api/upload/gms-asins');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('GMS_SCHEMA_NOT_READY');
    expect(res.body.message).not.toContain('Invalid column name');
  });
  test('missing import history table is reported as schema not ready', async () => {
    mockUser.permissions.push('gms_tracker_import');
    mockPool = makeFakePool([{ match:/FROM GmsImportJobs/, rows:() => {
      throw Object.assign(new Error('Invalid object name'), { number:208 });
    } }]);
    const res=await request(app).get('/api/upload/gms-imports');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('GMS_SCHEMA_NOT_READY');
    expect(res.body.message).not.toContain('Invalid object name');
  });
  test('metadata query is seller scoped and excludes ambiguous owners', async () => {
    expect((await request(app).get('/api/upload/gms-asins')).status).toBe(200);
    expect(mockPool.calls[0].inputs.gmsMeta_0).toBe('S1');
    expect(mockPool.calls[0].sql).toContain('NOT EXISTS');
    expect(mockPool.calls[0].sql).toContain('other.SellerId <> a.SellerId');
  });
  test('GMS reads use bound dates and seller scope', async () => {
    expect((await request(app).get('/api/upload/gms-data').query({ startDate: '2026-11-01', endDate: '2026-11-27' })).status).toBe(200);
    expect(mockPool.calls[0].inputs).toMatchObject({ gmsRead_0: 'S1', startDate: '2026-11-01', endDate: '2026-11-27' });
    expect(mockPool.calls[0].sql).toContain('g.Date < DATEADD(day, 1, @endDate)');
    expect(mockPool.calls[0].sql).toContain('NOT EXISTS');
  });
  test('no assigned sellers fails closed without querying the database', async () => {
    mockUser.assignedSellers = [];
    expect((await request(app).get('/api/upload/gms-asins')).body.data).toEqual([]);
    expect((await request(app).get('/api/upload/gms-data')).body.data).toEqual([]);
    expect(mockPool.calls).toHaveLength(0);
  });
  test('error report download requires import permission, owner and a valid format', async () => {
    expect((await request(app).get('/api/upload/gms-imports/foreign/errors?format=xlsx')).status).toBe(403);
    mockUser.permissions.push('gms_tracker_import');
    expect((await request(app).get('/api/upload/gms-imports/foreign/errors?format=json')).status).toBe(400);
    expect(mockPool.calls).toHaveLength(0);
    expect((await request(app).get('/api/upload/gms-imports/foreign/errors?format=csv')).status).toBe(404);
    expect(mockPool.calls[0].sql).toContain('Id=@id AND OwnerId=@owner');
    expect(mockPool.calls[0].inputs).toEqual({id:'foreign',owner:'u1'});
  });
  test('owner downloads readable CSV from stored full diagnostics', async () => {
    mockUser.permissions.push('gms_tracker_import');
    const issue={row:755,asin:'B000000001',date:'2026-11-27',brand:'Brand A',code:'ASIN_AMBIGUOUS',message:'RetailOps contains this ASIN under multiple seller IDs'};
    mockPool=makeFakePool([{match:/IssueReportJson FROM GmsImportJobs/,rows:[{Id:'batch1',FileName:'101-gms.xlsx',Status:'REJECTED',SummaryJson:JSON.stringify({invalid:1,issues:[issue]}),IssueReportJson:JSON.stringify([issue])}]}]);
    const res=await request(app).get('/api/upload/gms-imports/batch1/errors?format=csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('101-gms_error_report.csv');
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.text).toContain('B000000001');
    expect(res.text).toContain('Ask your administrator');
    expect(res.text).not.toContain('ASIN_AMBIGUOUS');
  });
  test('invalid export date rejected before job creation', async () => {
    mockUser.permissions.push('gms_tracker_export');
    expect((await request(app).post('/api/export/start-gms').send({ exportDateType: 'current', startDate: 'invalid', endDate: '2026-11-27' })).status).toBe(400);
    expect(mockPool.calls).toHaveLength(0);
  });
  test('analytics route requires view permission and validates filter input', async () => {
    mockUser.permissions=[];
    expect((await request(app).post('/api/upload/gms-analytics').send({startDate:'2026-11-27',endDate:'2026-11-27'})).status).toBe(403);
    mockUser.permissions=['gms_tracker_view'];
    expect((await request(app).post('/api/upload/gms-analytics').send({startDate:'2026-11-27',endDate:'2026-11-27',sellerIds:'S1'})).status).toBe(400);
    expect(mockPool.calls).toHaveLength(0);
  });
  test('analytics pagination validates bounds before SQL and preserves full-filter KPIs', async () => {
    const prior={date:'2026-11-26',recordCount:2,orderedRevenue:'10.00',orderedUnits:'1',shippedRevenue:'10.00',shippedCOGS:'5.00',shippedUnits:'1',customerReturns:'0'};
    const current={...prior,date:'2026-11-27',orderedRevenue:'20.00',orderedUnits:'2',shippedRevenue:'20.00',shippedCOGS:'10.00',shippedUnits:'2'};
    const entity={entityKey:'B000000001',asin:'B000000001',sellerId:'S1',dbBrand:'Seller A',brand:'Brand A',storeCode:'IN'};
    mockPool=makeFakePool([{match:/INTO #GmsSource/,recordsets:[
      [prior,current],[{records:2,asins:2,sellers:1,unmatchedRecords:0}],[{page:1,pageSize:1,totalRows:2}],
      [{...current,entityKey:entity.entityKey,orderedRevenue:'12.00'}],[entity],[entity]
    ]}]);
    const input={startDate:'2026-11-27',endDate:'2026-11-27',sellerIds:['S1'],page:1,pageSize:1};
    expect((await request(app).post('/api/upload/gms-analytics').send({...input,pageSize:101})).status).toBe(400);
    expect((await request(app).post('/api/upload/gms-analytics').send({...input,sort:{key:'g.Date;DROP TABLE Asins',direction:'desc'}})).status).toBe(400);
    expect(mockPool.calls).toHaveLength(0);
    const res=await request(app).post('/api/upload/gms-analytics').send(input);
    expect(res.status).toBe(200);
    expect(res.body.data.kpis.orderedRevenue).toBe(20);
    expect(res.body.data.comparison.changes.orderedRevenue).toBe(100);
    expect(res.body.data.matrixRows).toHaveLength(1);
    expect(res.body.data.matrixRows[0].orderedRevenue).toBe(12);
    expect(res.body.data.pagination).toEqual({page:1,pageSize:1,totalRows:2});
    expect(mockPool.calls[0].inputs).toMatchObject({allowedSellerIds:'["S1"]',selectedSellerIds:'["S1"]',historyFrom:'2026-10-01',currentTo:'2026-11-27'});
    expect(mockPool.calls[0].sql).toContain('OPENJSON(@allowedSellerIds)');
  });
  test('invalid read date rejected before database access', async () => {
    expect((await request(app).get('/api/upload/gms-data').query({ startDate: '2026-11-31' })).status).toBe(400);
    expect(mockPool.calls).toHaveLength(0);
  });
});
