const axios = require('axios');
const xpath = require('xpath');
const { DOMParser } = require('xmldom');
const { HttpsProxyAgent } = require('https-proxy-agent');

/**
 * Service for HIGH-PRECISION direct web scraping of Amazon India.
 * Implements user-provided XPaths for maximum data accuracy.
 */
class DirectScraperService {
    constructor() {
        this.userAgentList = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        console.log('🌐 High-Precision Direct Scraper initialized');
    }

    getRandomUserAgent() {
        return this.userAgentList[Math.floor(Math.random() * this.userAgentList.length)];
    }

    getProxyAgent() {
        const proxyUrl = process.env.PROXY_URL; // e.g. http://user:pass@host:port
        if (proxyUrl) {
            return new HttpsProxyAgent(proxyUrl);
        }
        return null;
    }

    /**
     * Scrapes an Amazon India product page using precise XPaths.
     * @param {string} asin - The Amazon Product Identification Number.
     * @param {number} retries - Current retry attempt count.
     * @returns {Object} Extracted data.
     */
    async scrapeAsin(asin, retries = 0) {
        const url = `https://www.amazon.in/dp/${asin}`;
        const MAX_RETRIES = parseInt(process.env.SCRAPER_MAX_RETRIES) || 3;

        try {
            const agent = this.getProxyAgent();
            const requestConfig = {
                headers: {
                    'User-Agent': this.getRandomUserAgent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 20000,
                httpsAgent: agent,
                proxy: false // Handled by https-proxy-agent
            };

            const response = await axios.get(url, requestConfig);
            const html = response.data;

            if (html.includes('api/services/captcha') || html.includes('Type the characters you see in this image')) {
                throw new Error(`Amazon CAPTCHA Challenge encountered`);
            }

            const doc = new DOMParser({
                errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} }
            }).parseFromString(html);

            // Helper to get text content by precise XPath
            const getText = (path) => {
                const node = xpath.select(path, doc);
                if (node && node.length > 0) {
                    return node[0].textContent?.trim() || '';
                }
                return '';
            };

            // Helper to get raw inner HTML of a node
            const getHtml = (path) => {
                const node = xpath.select(path, doc);
                if (node && node.length > 0) {
                    return node[0].toString() || '';
                }
                return '';
            };

            // Helper to get attribute
            const getAttr = (path, attr) => {
                const node = xpath.select(path, doc);
                if (node && node.length > 0 && node[0].getAttribute) {
                    return node[0].getAttribute(attr) || '';
                }
                return '';
            };

            // User Provided XPaths Implementation
            const extracted = {
                asin: asin,
                title: getText('//h1[@id="title"]'),
                aspRaw: getText('//span[@class="a-price aok-align-center reinventPricePriceToPayMargin priceToPay apex-pricetopay-value"]/span[2]/span[2]'),
                mrpRaw: getText('//span[@class="a-size-small a-color-secondary aok-align-center basisPrice"]/span[1]/span[2]'),
                categoryHtml: getHtml('//ul[@class="a-unordered-list a-horizontal a-size-small"]'),
                soldBy: getText('//div[@id="merchantInfoFeature_feature_div"]/div[2]/div[1]/span[1]/a[1]'),
                mainImage: getAttr('//*[@id="landingImage"]', 'src'),
                imageCountHtml: getHtml('//*[@id="altImages"]/ul'),
                subBsrRaw: getText('//ul[@class="a-unordered-list a-nostyle a-vertical zg_hrsr"]/li[1]/span[1]'),
                ratingRaw: getText('//span[@class="cr-widget-TitleRatingsHistogram"]/div[1]/div[1]/div[1]'),
                aplusRaw: getHtml('//*[@id="aplus"]'),
                bulletPointsHtml: getHtml('//*[@id="productFactsDesktopExpander"]/div[1]/ul'),
                dealBadge: getText('//span[@id="dealBadgeSupportingText"]/span[1]'),
                availability: getText('//span[@class="a-size-medium a-color-success primary-availability-message"]'),
                savingsPercentage: getText('//span[@class="a-size-large a-color-price savingPriceOverride aok-align-center reinventPriceSavingsPercentageMargin savingsPercentage apex-savings-percentage"]'),
                scrapedAt: new Date().toISOString()
            };

            // Post-Processing for Scaled Ingestion
            return this.processExtractedData(extracted);

        } catch (error) {
            if (retries < MAX_RETRIES) {
                const delay = (retries + 1) * 5000;
                await new Promise(r => setTimeout(r, delay));
                return this.scrapeAsin(asin, retries + 1);
            }
            throw error;
        }
    }

    /**
     * Normalizes raw extracted strings into structured data matching the DB model.
     */
    processExtractedData(raw) {
        const data = { ...raw };

        // 1. Clean Numeric Prices
        data.currentPrice = parseFloat(raw.aspRaw?.replace(/[^\d.]/g, '')) || 0;
        data.mrp = parseFloat(raw.mrpRaw?.replace(/[^\d.]/g, '')) || 0;

        // 2. Parse BSR
        if (raw.subBsrRaw) {
            const bsrMatch = raw.subBsrRaw.match(/#([\d,]+)/);
            if (bsrMatch) {
                data.bsr = parseInt(bsrMatch[1].replace(/,/g, ''));
            }
        }

        // 3. Parse Ratings & Reviews
        if (raw.ratingRaw) {
            const ratingMatch = raw.ratingRaw.match(/([0-5](?:[.,]\d+)?)\s*out\s*of\s*5/i);
            const globalMatch = raw.ratingRaw.match(/([\d,]+)\s*global\s*ratings?/i);
            
            data.rating = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : 0;
            data.reviewCount = globalMatch ? parseInt(globalMatch[1].replace(/,/g, '')) : 0;
            
            // Extract percentage breakdown logic
            const breakdown = {};
            ['5', '4', '3', '2', '1'].forEach(star => {
                const pMatch = raw.ratingRaw.match(new RegExp(`${star}\\s*star(\\d+)%`, 'i'));
                if (pMatch) breakdown[`${star}Star`] = parseInt(pMatch[1]);
            });
            data.ratingBreakdown = breakdown;
        }

        // 4. Clean HTML Fragments
        // Category: Extract last breadcrumb
        if (raw.categoryHtml) {
            const categories = raw.categoryHtml.match(/<li[^>]*>(.*?)<\/li>/gi);
            if (categories) {
                const last = categories[categories.length - 1];
                data.category = last.replace(/<[^>]*>/g, '').trim().replace(/^›\s*/, '');
            }
        }

        // Bullet Points: Convert to array
        if (raw.bulletPointsHtml) {
            const liMatches = raw.bulletPointsHtml.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
            data.bulletPointsText = liMatches.map(li => li.replace(/<[^>]*>/g, '').trim()).filter(t => t);
            data.bulletPoints = data.bulletPointsText.length;
        }

        // Image Count
        if (raw.imageCountHtml) {
            data.imagesCount = (raw.imageCountHtml.match(/<li[^>]*>/g) || []).length;
        }

        // A+ Content Presence
        data.hasAplus = raw.aplusRaw.length > 500; // Presence of substantial HTML content

        return data;
    }
}

module.exports = new DirectScraperService();
