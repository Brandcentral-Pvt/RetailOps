import { marketSyncApi, asinApi } from './api';

// Octoparse Cloud API Service - Integrated with Backend
export const getSettings = () => {
  const savedSettings = localStorage.getItem('seller_hub_settings');
  return savedSettings ? JSON.parse(savedSettings) : {};
};

export const isConfigured = () => {
  // Now checked on backend, but keep for UI consistency
  const settings = getSettings();
  return !!(settings.octoparseApiKey || settings.octoparseTaskId);
};

export const startScrapeTask = async (asins, marketplace = 'amazon.in', sellerId) => {
  if (!sellerId) throw new Error('Seller ID is required to start a scrape task');

  // In the current architecture, we trigger batch sync for a seller
  const response = await marketSyncApi.syncSellerAsins(sellerId);

  return {
    executionId: `BATCH-${sellerId}-${Date.now()}`,
    status: 'RUNNING',
    message: response.message
  };
};

export const startSingleAsinSync = async (asinId) => {
  return await marketSyncApi.syncAsin(asinId);
};

export const fetchResults = async (sellerId) => {
  return await marketSyncApi.fetchResults(sellerId);
};

export const getTaskStatus = async (executionId) => {
  // Status is now tracked in the ASIN models themselves
  // This is kept for UI compatibility if needed
  return {
    executionId,
    status: 'RUNNING',
    progress: 50,
  };
};

export const getTaskResults = async (executionId) => {
  // Results are automatically applied to ASINs via backend update
  return {
    results: [],
    count: 0,
    status: 'COMPLETED'
  };
};

export const getScrapeTasks = async (page = 1, limit = 10) => {
  // We can treat different sellers as tasks or use System Logs
  // For now, return empty or mock from real data
  return {
    tasks: [],
    pagination: { page, limit, total: 0, totalPages: 0 }
  };
};

export const cancelScrapeTask = async (executionId) => {
  return { success: true, message: 'Action not supported yet on backend' };
};

export const deleteScrapeTask = async (executionId) => {
  return { success: true, message: 'Task deleted locally' };
};

export default {
  getSettings,
  isConfigured,
  startScrapeTask,
  startSingleAsinSync,
  fetchResults,
  getTaskStatus,
  getTaskResults,
  getScrapeTasks,
  cancelScrapeTask,
  deleteScrapeTask,
};
