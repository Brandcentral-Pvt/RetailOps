const axios = require('axios');
const Seller = require('../models/Seller');
const Asin = require('../models/Asin');

class OctoparseAutomationService {
    constructor() {
        this.baseUrl = process.env.OCTOPARSE_BASE_URL || 'https://openapi.octoparse.com';
        this.masterTaskId = process.env.OCTOPARSE_MASTER_TASK_ID;
        this.groupId = process.env.OCTOPARSE_GROUP_ID;
        this.maxRetries = parseInt(process.env.OCTOPARSE_MAX_RETRIES) || 3;
        this.retryDelay = parseInt(process.env.OCTOPARSE_RETRY_DELAY) || 30000;
        this.pollInterval = parseInt(process.env.OCTOPARSE_POLL_INTERVAL) || 60000; // 1 minute
        this.concurrentPollers = new Map();
    }

    async authenticate() {
        const now = Date.now();
        if (this.token && this.tokenExpiry > now + 5 * 60 * 1000) {
            return this.token;
        }

        const username = process.env.MARKET_SYNC_USERNAME;
        const password = process.env.MARKET_SYNC_PASSWORD;

        if (!username || !password) {
            throw new Error('MARKET_SYNC_USERNAME or MARKET_SYNC_PASSWORD not configured');
        }

        const response = await axios.post(`${this.baseUrl}/token`, {
            username,
            password,
            grant_type: 'password'
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        this.token = response.data.access_token || response.data.data?.access_token;
        this.tokenExpiry = now + ((response.data.expires_in || 3600) * 1000);

        if (!this.token) {
            throw new Error('Authentication failed: No access token returned');
        }

        console.log(`[OctoparseAuth] ✅ Token secured (expires in ${Math.round((response.data.expires_in || 3600) / 60)}m)`);
        return this.token;
    }

    log(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, JSON.stringify(data));
    }

    async ensureTaskForSeller(sellerId) {
        const seller = await Seller.findById(sellerId);
        if (!seller) {
            throw new Error(`Seller not found: ${sellerId}`);
        }

        if (seller.marketSyncTaskId) {
            this.log('info', `Seller ${seller.name} already has task: ${seller.marketSyncTaskId}`);
            return seller.marketSyncTaskId;
        }

        const asins = await Asin.find({ seller: sellerId, status: 'Active' }).select('asinCode');
        if (asins.length === 0) {
            throw new Error(`No active ASINs found for seller: ${sellerId}`);
        }

        const newTaskId = await this.cloneMasterTask(seller.name);
        seller.marketSyncTaskId = newTaskId;
        await seller.save();

        this.log('info', `Created new Octoparse task ${newTaskId} for seller ${seller.name}`);
        return newTaskId;
    }

    async cloneMasterTask(taskName) {
        const token = await this.authenticate();
        
        const copyUrl = `${this.baseUrl}/task/copy?taskId=${this.masterTaskId}&taskGroupId=${this.groupId}`;
        const response = await axios.post(copyUrl, {}, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data?.data?.taskId) {
            return response.data.data.taskId;
        }

        throw new Error(`Failed to clone master task: ${JSON.stringify(response.data)}`);
    }

    async injectUrls(taskId, urls) {
        const token = await this.authenticate();
        
        const uniqueUrls = [...new Set(urls.map(url => {
            if (url.startsWith('http')) return url;
            if (url.length === 10) return `https://www.amazon.in/dp/${url}`;
            return url;
        }))];

        this.log('info', `Injecting ${uniqueUrls.length} URLs into task ${taskId}`);

        const formData = new FormData();
        formData.append('taskId', taskId);
        const blob = new Blob([uniqueUrls.join('\n')], { type: 'text/plain' });
        formData.append('file', blob, 'urls.txt');

        const response = await axios.post(`${this.baseUrl}/task/urls:file`, formData, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.data?.requestId || response.data?.data === null) {
            this.log('info', `✅ URLs injected successfully for task ${taskId}`);
            return true;
        }

        throw new Error(`URL injection failed: ${JSON.stringify(response.data)}`);
    }

    async startTask(taskId) {
        const token = await this.authenticate();

        this.log('info', `Starting task ${taskId}`);

        try {
            const response = await axios.post(`${this.baseUrl}/cloudextraction/start`,
                { taskId },
                { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
            );

            if (response.data?.data?.lotNo || response.data?.data === true) {
                this.log('info', `✅ Task ${taskId} started successfully`, { lotNo: response.data.data.lotNo });
                return response.data.data.lotNo || response.data.data;
            }
        } catch (err) {
            this.log('warn', `V3 start failed, trying legacy`, { error: err.message });
        }

        throw new Error(`Failed to start task ${taskId}`);
    }

    async getTaskStatus(taskId) {
        const token = await this.authenticate();

        try {
            const response = await axios.post(`${this.baseUrl}/cloudextraction/statuses/v2`,
                { taskIds: [taskId] },
                { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
            );

            return response.data?.data?.[0] || null;
        } catch (err) {
            this.log('warn', `Status check failed for ${taskId}`, { error: err.message });
            return null;
        }
    }

    async fetchResults(taskId) {
        const token = await this.authenticate();

        const paths = [
            '/data/notexported',              // OpenAPI V3 spec
            '/data/all',                      // OpenAPI V3 - get all by offset  
            '/api/alldata/GetDataOfTaskByOffset', // Legacy API
            '/task/data/notexporteddata',    // OpenAPI V1.0
            '/api/notexporteddata/get',       // Legacy V1
            '/api/notexporteddata'           // V1 Extension
        ];

        for (const path of paths) {
            try {
                console.log(`📥 Trying data fetch: ${path}`);
                const response = await axios.get(`${this.baseUrl}${path}`, {
                    params: { taskId, size: '1000' },
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.data?.data) {
                    console.log(`✅ Data fetched from ${path}`);
                    const dataObj = response.data.data;
                    return dataObj.data || dataObj;
                }
            } catch (err) {
                this.log('warn', `Fetch failed for ${path}`, { error: err.response?.status + ' ' + err.message });
            }
        }

        throw new Error(`Failed to fetch results - all paths exhausted`);
    }

    async stopTask(taskId) {
        const token = await this.authenticate();

        try {
            await axios.post(`${this.baseUrl}/cloudextraction/stop`,
                { taskId },
                { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
            );
            this.log('info', `Task ${taskId} stopped`);
        } catch (err) {
            this.log('warn', `Stop failed for ${taskId}`, { error: err.message });
        }
    }

    parseAsinFromData(item) {
        const asin = item.ASIN || item.asin || item.asinCode || item.asin_code || '';
        return asin.trim().toUpperCase();
    }

    isDataComplete(item) {
        const asin = this.parseAsinFromData(item);
        if (!asin) return false;

        // Check title - must exist and be non-empty
        const title = item.Title || item.title || item.Field1 || '';
        const hasTitle = title.toString().trim().length > 0;
        
        // Check price - must exist and be valid number > 0
        const price = item.Price || item.price || item.Current_Price || item.currentPrice || 0;
        const hasPrice = parseFloat(price) > 0;
        
        // Also check for other critical fields
        const hasRating = !!(item.Rating || item.rating);
        const hasReviews = !!(item.Reviews || item.reviews || item.ReviewCount);
        
        // Data is complete if we have title OR price (at minimum)
        // For higher quality, can require hasTitle && hasPrice
        return hasTitle || hasPrice;
    }

    async processResults(sellerId, results) {
        let updatedCount = 0;

        for (const item of results) {
            const asinCode = this.parseAsinFromData(item);
            if (!asinCode) continue;

            const asin = await Asin.findOne({ asinCode, seller: sellerId });
            if (!asin) {
                this.log('warn', `ASIN ${asinCode} not found in database, skipping`);
                continue;
            }

            const updateData = {};
            if (item.Title || item.title || item.Field1) updateData.title = item.Title || item.title || item.Field1;
            if (item.Price || item.price || item.Current_Price) updateData.currentPrice = parseFloat(item.Price || item.price || item.Current_Price) || 0;
            if (item.MRP || item.mrp) updateData.mrp = parseFloat(item.MRP || item.mrp) || 0;
            if (item.Rating || item.rating) updateData.rating = parseFloat(item.Rating || item.rating) || 0;
            if (item.Reviews || item.reviews || item.ReviewCount) updateData.reviewCount = parseInt(item.Reviews || item.reviews || item.ReviewCount) || 0;
            if (item.BSR || item.bsr) updateData.bsr = parseInt(item.BSR || item.bsr) || 0;
            if (item.Category || item.category) updateData.category = item.Category || item.category;
            if (item.Image || item.imageUrl) updateData.imageUrl = item.Image || item.imageUrl;

            updateData.lastScraped = new Date();
            updateData.scrapeStatus = 'COMPLETED';
            updateData.status = 'Active';

            await Asin.findByIdAndUpdate(asin._id, { $set: updateData });
            updatedCount++;
        }

        this.log('info', `Processed ${updatedCount} ASINs for seller ${sellerId}`);
        return updatedCount;
    }

    async identifyGaps(sellerId, results) {
        const allAsins = await Asin.find({ seller: sellerId, status: 'Active' }).select('asinCode currentPrice title rating');
        
        const gapAsins = [];
        const resultAsins = new Set();
        
        // First pass: build result set
        for (const item of results) {
            const asin = this.parseAsinFromData(item);
            if (asin) resultAsins.add(asin);
        }
        
        // Second pass: identify gaps
        for (const asin of allAsins) {
            const asinUpper = asin.asinCode.toUpperCase();
            
            // Case 1: ASIN not in results at all
            if (!resultAsins.has(asinUpper)) {
                gapAsins.push({
                    asinCode: asin.asinCode,
                    reason: 'NOT_EXTRACTED'
                });
                continue;
            }
            
            // Case 2: ASIN in results but data is incomplete
            const item = results.find(r => this.parseAsinFromData(r) === asinUpper);
            if (item && !this.isDataComplete(item)) {
                gapAsins.push({
                    asinCode: asin.asinCode,
                    reason: 'INCOMPLETE_DATA'
                });
            }
        }

        this.log('info', `Identified ${gapAsins.length} gap ASINs for seller ${sellerId}`);
        
        // Log breakdown
        const notExtracted = gapAsins.filter(g => g.reason === 'NOT_EXTRACTED').length;
        const incomplete = gapAsins.filter(g => g.reason === 'INCOMPLETE_DATA').length;
        if (gapAsins.length > 0) {
            this.log('info', `Gap breakdown: ${notExtracted} not extracted, ${incomplete} incomplete data`);
        }
        
        return gapAsins;
    }

    /**
     * Phase 3: Self-Healing - Run as concurrent background process
     * Does not block the main pipeline - runs in background
     */
    async startSelfHealingBackground(sellerId, taskId) {
        this.log('info', `🔧 [BG-HEAL] Starting background self-healing for seller ${sellerId}`);
        
        // Run self-healing in background without blocking
        this.runSelfHealing(sellerId, taskId, 0).then(result => {
            if (result.success) {
                this.log('info', `✅ [BG-HEAL] Self-healing completed for seller ${sellerId}`, result);
            } else {
                this.log('warn', `⚠️ [BG-HEAL] Self-healing completed with issues for seller ${sellerId}`, result);
            }
        }).catch(err => {
            this.log('error', `❌ [BG-HEAL] Self-healing failed for seller ${sellerId}:`, err.message);
        });
        
        // Return immediately - don't wait for completion
        return { started: true, message: 'Self-healing started in background' };
    }

    /**
     * Phase 3: Self-Healing - Recursively retry incomplete ASINs
     * Can run in background via startSelfHealingBackground
     */
    async runSelfHealing(sellerId, taskId, retryCount = 0) {
        const maxRetries = this.maxRetries;
        
        this.log('info', `═══════════════════════════════════════════════════════`);
        this.log('info', `🔧 PHASE 3: SELF-HEALING - Attempt ${retryCount + 1}/${maxRetries}`);
        this.log('info', `═══════════════════════════════════════════════════════`);
        
        // Check retry threshold
        if (retryCount >= maxRetries) {
            this.log('error', `❌ Self-healing MAX RETRIES (${maxRetries}) reached for seller ${sellerId}`);
            return { 
                success: false, 
                reason: 'Max retries exceeded',
                attempts: retryCount
            };
        }

        try {
            // Step 1: Fetch latest results and identify gaps
            this.log('info', `🔍 Scanning for incomplete ASINs...`);
            const results = await this.fetchResults(taskId);
            const gaps = await this.identifyGaps(sellerId, results);

            // Step 2: If no gaps, we're done
            if (gaps.length === 0) {
                this.log('info', `✅ ALL ASINs complete! Self-healing successful.`);
                return { 
                    success: true, 
                    gapsFound: 0,
                    attempts: retryCount
                };
            }

            // Step 3: Log gap details
            const gapAsins = gaps.map(g => g.asinCode);
            this.log('info', `📋 Found ${gaps.length} incomplete ASINs to retry:`, { asins: gapAsins.slice(0, 5), total: gapAsins.length });

            // Step 4: Stop current task
            this.log('info', `🛑 Stopping current task ${taskId}...`);
            await this.stopTask(taskId);
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Step 5: Create new task with gap ASINs
            const gapUrls = gapAsins.map(asin => `https://www.amazon.in/dp/${asin}`);
            this.log('info', `📝 Injecting ${gapUrls.length} gap URLs into new task...`);
            
            await this.injectUrls(taskId, gapUrls);
            
            // Step 6: Start new extraction
            this.log('info', `🚀 Starting extraction for ${gapUrls.length} gap ASINs...`);
            const lotNo = await this.startTask(taskId);
            
            // Step 7: Poll with concurrent DB updates
            this.log('info', `⏳ Polling for completion (1-min intervals)...`);
            await this.startConcurrentPolling(sellerId, taskId, lotNo);
            
            // Step 8: Fetch and process new results
            this.log('info', `📥 Fetching new results...`);
            const newResults = await this.fetchResults(taskId);
            const savedCount = await this.processResults(sellerId, newResults);
            this.log('info', `💾 Saved ${savedCount} ASINs from gap retry`);

            // Step 9: Recursively continue self-healing
            this.log('info', `🔄 Running next self-healing iteration...`);
            return await this.runSelfHealing(sellerId, taskId, retryCount + 1);

        } catch (error) {
            this.log('error', `❌ Self-healing error: ${error.message}`);
            
            // Continue to next attempt even on error
            if (retryCount < maxRetries - 1) {
                this.log('info', `⏳ Retrying after error...`);
                return await this.runSelfHealing(sellerId, taskId, retryCount + 1);
            }
            
            return { 
                success: false, 
                error: error.message,
                attempts: retryCount
            };
        }
    }

    async pollForCompletion(taskId, lotNo, maxAttempts = 120) {
        this.log('info', `Starting concurrent polling for task ${taskId} at 1-min intervals`);

        const pollKey = `poll_${taskId}`;
        
        // Start concurrent poller in background
        this.concurrentPollers.set(pollKey, true);
        
        let lastFetchedCount = 0;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (!this.concurrentPollers.get(pollKey)) {
                this.log('info', `Poller stopped for task ${taskId}`);
                return true;
            }
            
            const status = await this.getTaskStatus(taskId);
            
            if (!status) {
                this.log('warn', `Status check failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, this.pollInterval));
                continue;
            }

            const taskStatus = status.status?.toLowerCase();
            const extractCount = status.currentTotalExtractCount || 0;
            
            this.log('info', `Task ${taskId} status: ${taskStatus}, extracted: ${extractCount} items`, { 
                attempt: attempt + 1,
                interval: `${this.pollInterval / 1000}s`
            });

            // Fetch and save data incrementally as it's being extracted
            if (extractCount > lastFetchedCount) {
                try {
                    const results = await this.fetchResults(taskId);
                    if (results && results.length > 0) {
                        this.log('info', `📊 Incremental data: ${results.length} items fetched, saving to DB...`);
                        // Note: We need sellerId for this - will be passed when calling
                    }
                } catch (err) {
                    this.log('warn', `Incremental fetch error: ${err.message}`);
                }
                lastFetchedCount = extractCount;
            }

            if (taskStatus === 'finished' || taskStatus === 'stopped' || taskStatus === 'idle') {
                this.log('info', `Task ${taskId} completed with ${extractCount} items`);
                this.concurrentPollers.delete(pollKey);
                return { success: true, extractCount };
            }

            if (taskStatus === 'failed' || taskStatus === 'error') {
                this.log('error', `Task ${taskId} failed`);
                this.concurrentPollers.delete(pollKey);
                return { success: false, reason: 'Task failed' };
            }

            await new Promise(resolve => setTimeout(resolve, this.pollInterval));
        }

        this.log('warn', `Polling timeout for task ${taskId} after ${maxAttempts} attempts`);
        this.concurrentPollers.delete(pollKey);
        return { success: false, reason: 'Timeout' };
    }

    /**
     * Start concurrent background polling that updates DB in real-time
     */
    async startConcurrentPolling(sellerId, taskId, lotNo) {
        const pollKey = `poll_${taskId}`;
        
        this.log('info', `Starting concurrent poller for seller ${sellerId}, task ${taskId}`);
        
        this.concurrentPollers.set(pollKey, true);
        
        const maxAttempts = 120; // 2 hours max
        
        let lastFetchedCount = 0;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (!this.concurrentPollers.get(pollKey)) {
                this.log('info', `Concurrent poller stopped for task ${taskId}`);
                break;
            }
            
            const status = await this.getTaskStatus(taskId);
            
            if (!status) {
                this.log('warn', `Polling ${attempt + 1}: Status unavailable, retrying in 1 min...`);
                await new Promise(resolve => setTimeout(resolve, this.pollInterval));
                continue;
            }

            const taskStatus = status.status?.toLowerCase();
            const extractCount = status.currentTotalExtractCount || 0;
            
            // Log status every minute
            if (attempt % 5 === 0 || taskStatus === 'finished') {
                this.log('info', `🔄 [${attempt + 1}/${maxAttempts}] Task ${taskId}: ${taskStatus} - ${extractCount} items extracted`);
            }

            // Fetch and save data incrementally when new data arrives
            if (extractCount > lastFetchedCount) {
                try {
                    const results = await this.fetchResults(taskId);
                    if (results && results.length > 0) {
                        const saved = await this.processResults(sellerId, results);
                        this.log('info', `💾 Saved ${saved} ASINs to database (total: ${results.length} in task)`);
                    }
                } catch (err) {
                    this.log('warn', `Incremental save error: ${err.message}`);
                }
                lastFetchedCount = extractCount;
            }

            // Check for completion
            if (taskStatus === 'finished' || taskStatus === 'stopped' || taskStatus === 'idle') {
                this.log('info', `✅ Task ${taskId} completed. Final count: ${extractCount} items`);
                break;
            }

            if (taskStatus === 'failed' || taskStatus === 'error') {
                this.log('error', `❌ Task ${taskId} failed with status: ${taskStatus}`);
                break;
            }

            // Wait 1 minute before next poll
            await new Promise(resolve => setTimeout(resolve, this.pollInterval));
        }
        
        this.concurrentPollers.delete(pollKey);
        this.log('info', `Concurrent poller ended for task ${taskId}`);
    }

    /**
     * Stop concurrent polling for a task
     */
    stopPolling(taskId) {
        const pollKey = `poll_${taskId}`;
        if (this.concurrentPollers.has(pollKey)) {
            this.concurrentPollers.delete(pollKey);
            this.log('info', `Stopped polling for task ${taskId}`);
        }
    }

    async executePipeline(sellerId) {
        const startTime = Date.now();
        const executionId = `exec_${sellerId}_${Date.now()}`;
        
        this.log('info', `Starting pipeline for seller ${sellerId}`, { executionId });

        try {
            const seller = await Seller.findById(sellerId);
            if (!seller) {
                throw new Error(`Seller not found: ${sellerId}`);
            }

            const asins = await Asin.find({ seller: sellerId, status: 'Active' });
            if (asins.length === 0) {
                this.log('warn', `No active ASINs for seller ${sellerId}`);
                return { success: true, asinsProcessed: 0, executionId };
            }

            const taskId = await this.ensureTaskForSeller(sellerId);
            
            const urls = asins.map(a => `https://www.amazon.in/dp/${a.asinCode}`);
            
            await Seller.findByIdAndUpdate(sellerId, { 
                marketSyncUrls: urls,
                totalAsins: asins.length
            });

            await this.stopTask(taskId);
            await new Promise(resolve => setTimeout(resolve, 3000));

            await this.injectUrls(taskId, urls);
            
            const lotNo = await this.startTask(taskId);
            
            // Start concurrent polling - updates DB every minute as data is extracted
            this.log('info', `Starting concurrent polling (1-min intervals) for task ${taskId}`);
            const pollResult = await this.startConcurrentPolling(sellerId, taskId, lotNo);
            
            if (!pollResult || pollResult.success === false) {
                throw new Error(`Task ${taskId} did not complete successfully`);
            }

            // Final fetch after completion
            const results = await this.fetchResults(taskId);
            await this.processResults(sellerId, results);

            // Start self-healing in background - don't block pipeline
            this.log('info', `🔧 Starting background self-healing for seller ${sellerId}`);
            const healResult = this.startSelfHealingBackground(sellerId, taskId);

            const duration = Date.now() - startTime;
            this.log('info', `Pipeline completed for seller ${sellerId}`, { 
                executionId,
                duration: `${Math.round(duration / 1000)}s`,
                success: true,
                selfHealing: 'started in background'
            });

            return {
                success: true,
                asinsProcessed: asins.length,
                executionId,
                duration: `${Math.round(duration / 1000)}s`,
                selfHealing: healResult
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            this.log('error', `Pipeline failed for seller ${sellerId}`, { 
                executionId,
                error: error.message,
                duration: `${Math.round(duration / 1000)}s`
            });

            return {
                success: false,
                error: error.message,
                executionId,
                duration: `${Math.round(duration / 1000)}s`
            };
        }
    }

    /**
     * Run full automation for ALL sellers concurrently
     * Each seller runs in parallel - much faster
     */
    async runFullAutomation() {
        const startTime = Date.now();
        this.log('info', '═══════════════════════════════════════════════════════');
        this.log('info', '🏢 Starting CONCURRENT enterprise automation pipeline');
        this.log('info', '═══════════════════════════════════════════════════════');

        const sellers = await Seller.find({ status: 'Active', marketSyncTaskId: { $exists: true, $ne: '' } });
        
        if (sellers.length === 0) {
            this.log('warn', 'No active sellers with Octoparse tasks found');
            return { success: false, reason: 'No active sellers' };
        }

        this.log('info', `🚀 Launching ${sellers.length} seller pipelines CONCURRENTLY...`);

        // Run ALL seller pipelines concurrently
        const promises = sellers.map(seller => 
            this.executePipeline(seller._id).then(result => ({
                sellerId: seller._id,
                sellerName: seller.name,
                ...result
            })).catch(err => ({
                sellerId: seller._id,
                sellerName: seller.name,
                success: false,
                error: err.message,
                executionId: `error_${seller._id}`
            }))
        );

        const results = await Promise.all(promises);

        const successCount = results.filter(r => r.success).length;
        const totalDuration = Date.now() - startTime;

        const summary = {
            totalSellers: sellers.length,
            successful: successCount,
            failed: sellers.length - successCount,
            duration: `${Math.round(totalDuration / 1000)}s`,
            results
        };

        this.log('info', '═══════════════════════════════════════════════════════');
        this.log('info', '🏢 CONCURRENT pipeline completed', summary);
        this.log('info', '═══════════════════════════════════════════════════════');
        return summary;
    }
}

module.exports = new OctoparseAutomationService();