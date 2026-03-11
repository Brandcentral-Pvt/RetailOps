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
     * Checks if the service is configured with credentials.
     */
    isConfigured() {
        const username = process.env.MARKET_SYNC_USERNAME;
        const password = process.env.MARKET_SYNC_PASSWORD;
        // Check if defined and not default demo values
        return !!(username && password &&
            username !== 'demo-provider' &&
            password !== 'demo-pass');
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
                const error = new Error('Market Sync credentials missing (OCTOPARSE_NOT_CONFIGURED)');
                error.code = 'CONFIG_MISSING';
                throw error;
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
     * @param {Array} parameters - Key-value pairs of parameters.
     */
    async triggerSync(taskId, parameters) {
        const token = await this.authenticate();
        try {
            // Note: In Octoparse OpenAPI v1.0, updating parameters requires specific actionIds.
            // If parameters are provided, you typically use /task/updateTaskParameters 
            // or /task/updateLoopItems. Since we may not have actionIds, we will log a warning
            // but still proceed to start the task.
            if (parameters && parameters.length > 0) {
                console.warn('⚠️ Market Sync: Updating parameters dynamically requires Octoparse actionIds in OpenAPI v1.0. Proceeding to start task directly.');
            }

            // Start the task in the Cloud
            const response = await axios.post(`${this.baseUrl}/cloudextraction/start`, { taskId }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data.error) {
                throw new Error(`Provider Error: ${response.data.error.message}`);
            }

            return { success: true, taskId, lotNo: response.data.data?.lotNo };
        } catch (error) {
            console.error('❌ Trigger Sync Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Polls and retrieves results from a completed sync task.
     */
    async retrieveResults(taskId, offset = 0, size = 1000) {
        const token = await this.authenticate();
        try {
            // Use OpenAPI v1.0 endpoint for Non-Exported Data
            const response = await axios.get(`${this.baseUrl}/data/notexported`, {
                params: { taskId, size },
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data.error) {
                throw new Error(`Provider Error: ${response.data.error.message}`);
            }

            // Mark data as exported after successful retrieval
            try {
                await axios.post(`${this.baseUrl}/data/markexported`, { taskId }, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (markError) {
                console.error('⚠️ Market Sync: Failed to mark data as exported', markError.message);
            }

            return response.data.data?.data || [];
        } catch (error) {
            console.error('❌ Retrieve Results Error:', error.response?.data || error.message);
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

            // --- Field Mapping & Cleaning ---
            // Price mapping (Custom Template mapping: asp, mrp)
            const cleanPriceString = (str) => {
                if (!str) return 0;
                const match = str.toString().replace(/,/g, '').match(/\d+(\.\d+)?/);
                return match ? parseFloat(match[0]) : 0;
            };

            const price = cleanPriceString(rawData.asp || rawData.price || rawData.currentPrice);
            const mrp = cleanPriceString(rawData.mrp || rawData.listPrice);

            // BSR mapping & cleaning (Custom Template mapping: BSR, sub_BSR)
            const cleanBsrString = (str) => {
                if (!str) return 0;
                // Extract first number found after a # symbol, or just the first number
                const match = str.toString().replace(/,/g, '').match(/#?(\d+)/);
                return match ? parseInt(match[1]) : 0;
            };
            const bsr = cleanBsrString(rawData.Field9 || rawData.BSR || rawData.bsr || rawData.salesRank);

            // Sub-BSRs handling
            let subBSRs = asin.subBSRs || [];
            if (rawData.sub_BSR) {
                const subMatch = rawData.sub_BSR.toString().trim();
                if (subMatch && !subBSRs.includes(subMatch)) {
                    subBSRs.push(subMatch);
                }
            }

            // Image Count cleaning (Custom Template mapping: image_count is an HTML string of <li> tags)
            let imageCount = 0;
            if (rawData.image_count) {
                // Count the number of <li> or <img> tags or imageThumbnail classes
                const matches = rawData.image_count.toString().match(/<li[^>]*>/g);
                imageCount = matches ? matches.length : parseInt(rawData.imageCount || rawData.imagesCount || 0);
            }

            // Standard fields (Custom Template mapping: Title, category, sold_by, Main_Image, Rating)
            let rating = parseFloat(rawData.rating || 0);
            let reviews = parseInt(rawData.reviews || rawData.reviewCount || 0);
            let ratingBreakdown = { fiveStar: 0, fourStar: 0, threeStar: 0, twoStar: 0, oneStar: 0 };

            if (rawData.Rating) {
                const ratingStr = rawData.Rating.toString();
                const ratingMatch = ratingStr.match(/([\d.]+) out of 5/);
                if (ratingMatch) rating = parseFloat(ratingMatch[1]);

                const reviewMatch = ratingStr.match(/([\d,]+) global ratings/);
                if (reviewMatch) reviews = parseInt(reviewMatch[1].replace(/,/g, ''));

                // Extract sequential 5 percentages for 5, 4, 3, 2, and 1 star
                const breakdownMatch = ratingStr.match(/(\d+)%(\d+)%(\d+)%(\d+)%(\d+)%/);
                if (breakdownMatch) {
                    ratingBreakdown = {
                        fiveStar: parseInt(breakdownMatch[1]),
                        fourStar: parseInt(breakdownMatch[2]),
                        threeStar: parseInt(breakdownMatch[3]),
                        twoStar: parseInt(breakdownMatch[4]),
                        oneStar: parseInt(breakdownMatch[5])
                    };
                }
            }
            let bulletPoints = parseInt(rawData.bulletPoints || rawData.bulletPointsCount || 0);
            if (rawData.bullet_points) {
                // Split by 2 or more spaces as bullet points in string form are separated by spaces
                const points = rawData.bullet_points.toString().split(/\s{2,}/).filter(p => p.trim().length > 3);
                if (points.length > 0) bulletPoints = points.length;
            }

            const title = (rawData.Title || rawData.title || asin.title || '').trim();
            const description = rawData.description || asin.description;
            const category = (rawData.category || asin.category || '').trim();

            let hasAplus = rawData.hasAplus === true || rawData.hasAplus === 'true';
            if (rawData.A_plus) {
                hasAplus = rawData.A_plus.toString().trim().length > 20;
            }
            const imageUrl = rawData.Main_Image || rawData.mainImage || rawData.imageUrl || asin.imageUrl;

            // Custom sold_by
            const buyBoxSellerId = rawData.sold_by ? rawData.sold_by.trim() : asin.buyBoxSellerId;

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
                category,
                mrp: mrp > 0 ? mrp : asin.mrp,
                currentPrice: price > 0 ? price : asin.currentPrice,
                currentASP: price > 0 ? price : asin.currentASP,
                bsr: bsr > 0 ? bsr : asin.bsr,
                subBSRs,
                rating: rating > 0 ? rating : asin.rating,
                reviewCount: reviews > 0 ? reviews : asin.reviewCount,
                ratingBreakdown: ratingBreakdown.fiveStar > 0 ? ratingBreakdown : asin.ratingBreakdown,
                imagesCount: imageCount > 0 ? imageCount : asin.imagesCount,
                imageUrl,
                buyBoxSellerId,
                hasAplus,
                bulletPoints,
                descLength: description ? description.length : 0,
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
                descriptionLength: description ? description.length : 0,
                bulletPoints
            };

            Object.assign(asin, updates);
            await asin.save();

            return asin;
        } catch (error) {
            console.error('❌ ASIN Update Error:', error.message);
            throw error;
        }
    }

    /**
     * Maps external raw data to internal ASIN model metrics using ASIN Code instead of Mongo ID.
     */
    async updateAsinMetricsByCode(asinCode, rawData) {
        try {
            const asin = await Asin.findOne({ asinCode });
            if (!asin) {
                console.warn(`[MarketDataSync] ASIN ${asinCode} not found in DB. Skipping update.`);
                return null;
            }
            return await this.updateAsinMetrics(asin._id, rawData);
        } catch (error) {
            console.error('❌ ASIN By Code Update Error:', error.message);
            throw error;
        }
    }

    /**
     * Helper to process an array of scraped items from Octoparse
     */
    async processOctoparseResults(results) {
        let processed = 0;
        let failed = 0;
        for (const row of results) {
            // Octoparse usually outputs the ASIN field. Provide fallbacks if naming differs.
            const asinCode = row.asin || row.Asin || row.ASIN || row.asinCode;
            if (!asinCode) {
                failed++;
                continue;
            }
            try {
                const updated = await this.updateAsinMetricsByCode(asinCode, row);
                if (updated) processed++;
                else failed++;
            } catch (err) {
                failed++;
            }
        }
        return { processed, failed };
    }
}

module.exports = new MarketDataSyncService();
