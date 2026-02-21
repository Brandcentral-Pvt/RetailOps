const axios = require('axios');
const Asin = require('../models/Asin');
const config = require('../config/env');

/**
 * Discreet service for syncing market data from external provider.
 * Naming is abstract (MarketDataSync) to avoid provider exposure.
 */
class MarketDataSyncService {
    constructor() {
        this.baseUrl = 'https://openapi.octoparse.com'; // Internal only
        this.token = null;
        this.tokenExpiry = null;
    }

    /**
     * Handles OAuth2.0 authentication with the data provider.
     */
    async authenticate() {
        if (this.token && this.tokenExpiry > Date.now()) {
            return this.token;
        }

        try {
            console.log('🔄 Authenticating with Market Data provider...');
            // In a real scenario, these would come from process.env via config
            const username = process.env.MARKET_SYNC_USERNAME;
            const password = process.env.MARKET_SYNC_PASSWORD;

            if (!username || !password) {
                throw new Error('Market Sync credentials missing');
            }

            const response = await axios.post(`${this.baseUrl}/token`, {
                username,
                password,
                grant_type: 'password'
            }, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            this.token = response.data.access_token;
            // Set expiry with 5 min buffer (expiry is in seconds)
            this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

            console.log('✅ Market Data authentication successful');
            return this.token;
        } catch (error) {
            console.error('❌ Market Data Auth Error:', error.message);
            throw error;
        }
    }

    /**
     * Triggers a data extraction task for a list of ASINs.
     * @param {string} taskId - The ID of the scraper task configured in the external provider.
     * @param {Array} parameters - Key-value pairs of parameters (e.g., ASIN list).
     */
    async triggerSync(taskId, parameters) {
        const token = await this.authenticate();
        try {
            const response = await axios.post(`${this.baseUrl}/api/task/updateParameter`, {
                taskId,
                parameters
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data.code !== 0) {
                throw new Error(`Provider Error: ${response.data.message}`);
            }

            // Start the task
            await axios.post(`${this.baseUrl}/api/task/startTask`, { taskId }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            return { success: true, taskId };
        } catch (error) {
            console.error('❌ Trigger Sync Error:', error.message);
            throw error;
        }
    }

    /**
     * Polls and retrieves results from a completed sync task.
     */
    async retrieveResults(taskId, offset = 0, size = 1000) {
        const token = await this.authenticate();
        try {
            const response = await axios.get(`${this.baseUrl}/api/notexportdata/getdata`, {
                params: { taskId, offset, size },
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data.code !== 0) {
                throw new Error(`Provider Error: ${response.data.message}`);
            }

            return response.data.data;
        } catch (error) {
            console.error('❌ Retrieve Results Error:', error.message);
            throw error;
        }
    }

    /**
     * Maps external raw data to internal ASIN model metrics.
     */
    async updateAsinMetrics(asinId, rawData) {
        try {
            const asin = await Asin.findById(asinId);
            if (!asin) throw new Error('ASIN not found');

            // Clean raw data fields (handling cross-platform inconsistencies)
            const price = parseFloat(rawData.price || rawData.currentPrice || 0);
            const bsr = parseInt(rawData.bsr || rawData.salesRank || 0);
            const rating = parseFloat(rawData.rating || 0);
            const reviews = parseInt(rawData.reviews || rawData.reviewCount || 0);
            const imageCount = parseInt(rawData.imageCount || rawData.imagesCount || 0);
            const title = rawData.title || asin.title;
            const description = rawData.description || asin.description;
            const hasAplus = rawData.hasAplus === true || rawData.hasAplus === 'true';

            // Calculate LQS (Listing Quality Score) - Basic logic
            // 1. Title length (> 150 chars: 20 pts)
            // 2. Images (>= 7: 20 pts)
            // 3. Rating (>= 4.5: 20 pts)
            // 4. A+ Content (exists: 20 pts)
            // 5. Description length (> 500 chars: 20 pts)
            let lqs = 0;
            if (title && title.length > 150) lqs += 20;
            if (imageCount >= 7) lqs += 20;
            if (rating >= 4.5) lqs += 20;
            if (hasAplus) lqs += 20;
            if (description && description.length > 500) lqs += 20;

            const updates = {
                title,
                description,
                currentPrice: price > 0 ? price : asin.currentPrice,
                bsr: bsr > 0 ? bsr : asin.bsr,
                rating: rating > 0 ? rating : asin.rating,
                reviewCount: reviews > 0 ? reviews : asin.reviewCount,
                imagesCount: imageCount > 0 ? imageCount : asin.imagesCount,
                hasAplus,
                lqs,
                lastScraped: new Date(),
                scrapeStatus: 'COMPLETED',
                status: 'Active'
            };

            // Update history
            asin.history.push({
                date: new Date(),
                price: updates.currentPrice,
                salesRank: updates.bsr,
                reviews: updates.reviewCount
            });

            // Update LQS Details
            asin.lqsDetails = {
                titleLength: title ? title.length : 0,
                imageCount,
                rating,
                reviewCount: reviews,
                hasAplus,
                descriptionLength: description ? description.length : 0
            };

            Object.assign(asin, updates);
            await asin.save();

            return asin;
        } catch (error) {
            console.error('❌ ASIN Update Error:', error.message);
            throw error;
        }
    }
}

module.exports = new MarketDataSyncService();
