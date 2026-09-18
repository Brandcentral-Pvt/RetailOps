import { scraperApi } from './api';

// Playwright Scraper Service — replaces the Octoparse integration.
// Octoparse service stays in the codebase (disabled) to preserve old data/migration.

export const healthcheck = async () => {
  return await scraperApi.getHealth();
};

export const testScrape = async (asin) => {
  return await scraperApi.testScrape(asin);
};

export const startScrape = async ({ sellerId, asinIds = [], onlyMissing = false }) => {
  return await scraperApi.startScrape({ sellerId, asinIds, onlyMissing });
};

export const startBulkScrape = async (asinIds = []) => {
  return await scraperApi.startBulkScrape(asinIds);
};

export const getJobStatus = async (jobId) => {
  return await scraperApi.getJobStatus(jobId);
};

export const cancelScrapeJob = async (jobId) => {
  return await scraperApi.cancelJob(jobId);
};

export const retryScrapeJob = async (jobId) => {
  return await scraperApi.retryJob(jobId);
};

export const getJobs = async (params = {}) => {
  return await scraperApi.getJobs(params);
};

export const getJobDetails = async (jobId) => {
  return await scraperApi.getJobDetails(jobId);
};

export const getStats = async () => {
  return await scraperApi.getStats();
};

export const getSellersSummary = async () => {
  return await scraperApi.getSellersSummary();
};

export const syncSeller = async (sellerId, opts = {}) => {
  return await scraperApi.syncSeller(sellerId, opts);
};

export const getSyncStatus = async (sellerId) => {
  return await scraperApi.getSyncStatus(sellerId);
};

export default {
  healthcheck,
  testScrape,
  startScrape,
  startBulkScrape,
  getJobStatus,
  cancelScrapeJob,
  retryScrapeJob,
  getJobs,
  getJobDetails,
  getStats,
  getSellersSummary,
  syncSeller,
  getSyncStatus,
};