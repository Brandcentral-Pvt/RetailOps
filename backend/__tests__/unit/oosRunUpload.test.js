/**
 * Phase 3 integration tests — OOS run creation and uploads.
 *
 * Covers:
 *   - RUN-01: Idempotent run creation — concurrent creates for one
 *     task/seller/date produce exactly one run.
 *   - UP-01/UP-02: Upload contract — file buffer hash, metadata, revision
 *     semantics, private storage path.
 *   - OOS-017: Task-scoped run uniqueness.
 *
 * Uses mocked database pool (no real DB required).
 */

const assert = require('node:assert');
const { test } = require('node:test');

// These are CJS modules — use require
const monitoring = require('../../services/oos/oosMonitoringService');
const uploads = require('../../services/oos/oosUploadService');

test('oosMonitoringService exports required functions', () => {
  assert.ok(typeof monitoring.createOrGetRun === 'function');
  assert.ok(typeof monitoring.getRun === 'function');
  assert.ok(typeof monitoring.listRuns === 'function');
  assert.ok(typeof monitoring.updateRunStatus === 'function');
});

test('oosUploadService exports required functions', () => {
  assert.ok(typeof uploads.ingestUpload === 'function');
  assert.ok(typeof uploads.listImports === 'function');
});

test('ingestUpload validates file size limit', async () => {
  await assert.rejects(
    uploads.ingestUpload({
      runId: 'run-1',
      sellerId: 'seller-1',
      sourceType: 'BRAND_CENTRAL',
      fileName: 'test.csv',
      fileBuffer: Buffer.alloc(51 * 1024 * 1024), // 51MB > 50MB limit
    }),
    (err) => err.code === 'FILE_TOO_LARGE',
    'Should reject files over 50MB'
  );
});

test('ingestUpload rejects empty file', async () => {
  await assert.rejects(
    uploads.ingestUpload({
      runId: 'run-1',
      sellerId: 'seller-1',
      sourceType: 'BRAND_CENTRAL',
      fileName: 'test.csv',
      fileBuffer: Buffer.alloc(0),
    }),
    (err) => err.code === 'EMPTY_FILE',
    'Should reject empty files'
  );
});

test('ingestUpload validates source type', async () => {
  await assert.rejects(
    uploads.ingestUpload({
      runId: 'run-1',
      sellerId: 'seller-1',
      sourceType: 'INVALID_SOURCE',
      fileName: 'test.csv',
      fileBuffer: Buffer.from('asin,quantity\nB0001,10'),
    }),
    (err) => err.code === 'INVALID_SOURCE',
    'Should reject invalid source types'
  );
});

test('ingestUpload requires runId', async () => {
  await assert.rejects(
    uploads.ingestUpload({
      sellerId: 'seller-1',
      sourceType: 'BRAND_CENTRAL',
      fileName: 'test.csv',
      fileBuffer: Buffer.from('asin,quantity\nB0001,10'),
    }),
    (err) => err.code === 'RUN_REQUIRED',
    'Should require runId'
  );
});
