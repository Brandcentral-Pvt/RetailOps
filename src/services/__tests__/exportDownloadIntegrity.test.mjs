import test from 'node:test';
import assert from 'node:assert/strict';
import {exportResponseFormat,validateExportBlob} from '../exportDownloadIntegrity.mjs';

const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
test('rejects login/error pages and mismatched formats even on successful HTTP responses',()=>{
  assert.throws(()=>exportResponseFormat(new Headers({'Content-Type':'text/html'}),'report.xlsx'));
  assert.throws(()=>exportResponseFormat(new Headers({'Content-Type':'application/json'}),'report.xlsx'));
  assert.throws(()=>exportResponseFormat(new Headers({'Content-Type':mime,'Content-Disposition':'attachment; filename="report.csv"'}),'report.xlsx'));
  assert.equal(exportResponseFormat(new Headers({'Content-Type':mime}),'report.xlsx'),'xlsx');
  assert.equal(exportResponseFormat(new Headers({'Content-Type':'text/csv; charset=utf-8'}),'report.csv'),'csv');
});
test('checks download envelope and byte length before saving',async()=>{
  // Synthetic ZIP envelope for the browser's lightweight signature check.
  // Actual ZIP package and XML validation are covered by backend tests.
  const bytes=new Uint8Array(26);bytes.set([80,75,3,4]);bytes.set([80,75,5,6],4);
  const blob=new Blob([bytes]);
  assert.equal(await validateExportBlob(blob,'xlsx',26),blob);
  await assert.rejects(validateExportBlob(blob,'xlsx',27));
  await assert.rejects(validateExportBlob(new Blob([bytes.subarray(0,20)]),'xlsx'));
  await assert.rejects(validateExportBlob(new Blob(['<html>Error</html>']),'xlsx'));
  await assert.rejects(validateExportBlob(blob,'csv'));
  const csv=new Blob(['ASIN,Revenue\r\nB000000001,-125.50\r\n']);
  assert.equal(await validateExportBlob(csv,'csv',csv.size),csv);
});
