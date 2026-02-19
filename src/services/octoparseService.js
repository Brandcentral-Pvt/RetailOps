// Octoparse Cloud API Service
// Replaces Keepa API for Amazon product data scraping

const OCTOPARSE_API_BASE = 'https://cloudapi.octoparse.com/api';

export const getSettings = () => {
  const savedSettings = localStorage.getItem('seller_hub_settings');
  return savedSettings ? JSON.parse(savedSettings) : {};
};

export const isConfigured = () => {
  const settings = getSettings();
  return !!(settings.octoparseApiKey && settings.octoparseTaskId);
};

export const startScrapeTask = async (asins, marketplace = 'amazon.in') => {
  const settings = getSettings();
  
  if (!settings.octoparseApiKey || !settings.octoparseTaskId) {
    throw new Error('Octoparse API not configured. Please add your API credentials in Settings.');
  }

  // Simulate Octoparse API call
  // In production, this would call:
  // POST https://cloudapi.octoparse.com/api/scrape/start
  // with headers: { 'Authorization': settings.octoparseApiKey }
  
  const executionId = `EXEC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Store scrape task
  const scrapeTask = {
    executionId,
    taskId: settings.octoparseTaskId,
    asins,
    marketplace,
    status: 'RUNNING',
    progress: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    errorMessage: null,
    resultsCount: 0,
    successCount: 0,
    failedCount: 0,
  };
  
  // Save to localStorage for demo
  const existingTasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
  existingTasks.unshift(scrapeTask);
  localStorage.setItem('scrapeTasks', JSON.stringify(existingTasks));
  
  // Simulate async scraping
  simulateScrapeProgress(executionId);
  
  return { executionId, status: 'RUNNING', message: 'Scrape task started successfully' };
};

const simulateScrapeProgress = (executionId) => {
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 20;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      
      // Mark as completed
      const tasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
      const taskIndex = tasks.findIndex(t => t.executionId === executionId);
      if (taskIndex >= 0) {
        tasks[taskIndex].status = 'COMPLETED';
        tasks[taskIndex].progress = 100;
        tasks[taskIndex].completedAt = new Date().toISOString();
        tasks[taskIndex].resultsCount = Math.floor(Math.random() * 5) + 1;
        tasks[taskIndex].successCount = tasks[taskIndex].resultsCount;
        tasks[taskIndex].failedCount = 0;
        localStorage.setItem('scrapeTasks', JSON.stringify(tasks));
      }
    } else {
      // Update progress
      const tasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
      const taskIndex = tasks.findIndex(t => t.executionId === executionId);
      if (taskIndex >= 0) {
        tasks[taskIndex].progress = Math.round(progress);
        localStorage.setItem('scrapeTasks', JSON.stringify(tasks));
      }
    }
  }, 1000);
};

export const getTaskStatus = async (executionId) => {
  const tasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
  const task = tasks.find(t => t.executionId === executionId);
  
  if (!task) {
    throw new Error('Scrape task not found');
  }
  
  return {
    executionId: task.executionId,
    status: task.status,
    progress: task.progress,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    error: task.error,
  };
};

export const getTaskResults = async (executionId) => {
  const tasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
  const task = tasks.find(t => t.executionId === executionId);
  
  if (!task) {
    throw new Error('Scrape task not found');
  }
  
  if (task.status !== 'COMPLETED') {
    return {
      results: [],
      count: 0,
      status: task.status,
      progress: task.progress,
    };
  }
  
  // Generate mock results based on ASINs
  const results = task.asins.map((asinCode, idx) => ({
    asin: asinCode,
    title: `Product ${asinCode} - Scraped from Amazon`,
    price: Math.round((30 + Math.random() * 100) * 100) / 100,
    rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
    reviews: Math.floor(Math.random() * 2000),
    rank: Math.floor(Math.random() * 5000) + 100,
    marketplace: task.marketplace,
    scrapedAt: task.completedAt,
  }));
  
  return {
    results,
    count: results.length,
    status: task.status,
    executionId: task.executionId,
  };
};

export const getScrapeTasks = async (page = 1, limit = 10) => {
  const tasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
  const start = (page - 1) * limit;
  const end = start + limit;
  
  return {
    tasks: tasks.slice(start, end),
    pagination: {
      page,
      limit,
      total: tasks.length,
      totalPages: Math.ceil(tasks.length / limit),
    },
  };
};

export const cancelScrapeTask = async (executionId) => {
  const tasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
  const taskIndex = tasks.findIndex(t => t.executionId === executionId);
  
  if (taskIndex >= 0) {
    tasks[taskIndex].status = 'FAILED';
    tasks[taskIndex].error = 'Cancelled by user';
    tasks[taskIndex].completedAt = new Date().toISOString();
    localStorage.setItem('scrapeTasks', JSON.stringify(tasks));
  }
  
  return { success: true, message: 'Task cancelled' };
};

export const deleteScrapeTask = async (executionId) => {
  let tasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
  tasks = tasks.filter(t => t.executionId !== executionId);
  localStorage.setItem('scrapeTasks', JSON.stringify(tasks));
  
  return { success: true, message: 'Task deleted' };
};

export default {
  getSettings,
  isConfigured,
  startScrapeTask,
  getTaskStatus,
  getTaskResults,
  getScrapeTasks,
  cancelScrapeTask,
  deleteScrapeTask,
};
