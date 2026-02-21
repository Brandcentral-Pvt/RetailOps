const axios = require('axios');
const xpath = require('xpath');
const { DOMParser } = require('xmldom');

/**
 * Service for direct web scraping of Amazon India.
 * Specifically handles amazon.in products using ASIN.
 */
class DirectScraperService {
    constructor() {
        this.userAgentList = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        ];
    }

    getRandomUserAgent() {
        return this.userAgentList[Math.floor(Math.random() * this.userAgentList.length)];
    }

    /**
     * Scrapes an Amazon India product page with retries.
     * @param {string} asin - The Amazon Product Identification Number.
     * @param {number} retries - Current retry attempt count.
     * @returns {Object} Extracted data.
     */
    async scrapeAsin(asin, retries = 0) {
        const url = `https://www.amazon.in/dp/${asin}`;
        const MAX_RETRIES = 3;

        try {
            console.log(`🌐 Scraping direct [Attempt ${retries + 1}]: ${url}`);

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.getRandomUserAgent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Device-Memory': '8',
                    'Viewport-Width': '1920'
                },
                timeout: 15000 // Increased timeout
            });

            if (response.status !== 200) {
                throw new Error(`Failed to fetch page: Status ${response.status}`);
            }

            const html = response.data;

            // Check for Amazon Captcha or blocking
            if (html.includes('api/services/captcha') || html.includes('Type the characters you see in this image')) {
                throw new Error(`Amazon CAPTCHA Challenge encountered`);
            }

            const doc = new DOMParser({
                errorHandler: {
                    warning: () => { },
                    error: () => { },
                    fatalError: (msg) => console.warn('Fatal DOM Error:', msg)
                }
            }).parseFromString(html);

            const select = xpath.useNamespaces({ "re": "http://exslt.org/regular-expressions" });

            // Helper to get text by xpath
            const getText = (path) => {
                const node = xpath.select(path, doc);
                if (node && node.length > 0) {
                    return node[0].textContent?.trim() || '';
                }
                return '';
            };

            // Helper to get attribute by xpath
            const getAttr = (path, attr) => {
                const node = xpath.select(path, doc);
                if (node && node.length > 0) {
                    return node[0].getAttribute(attr) || '';
                }
                return '';
            };

            // Basic validation - check if title exists. If not, page might have loaded incorrectly.
            const title = getText('//*[@id="productTitle"]');
            if (!title) {
                throw new Error(`Failed to parse product title - layout mismatch or bot blocker.`);
            }

            // User provided XPaths
            const data = {
                asin: asin,
                title: title,
                rating: getText('//*[@id="averageCustomerReviews"]')?.split('out of')[0]?.trim(),
                price: getText('//*[@id="corePriceDisplay_desktop_feature_div"]/div[1]/span[3]'),
                mrp: getText('//*[@id="corePriceDisplay_desktop_feature_div"]/div[2]/span/span[1]/span[2]/span/span[1]'),
                bsr: getText('//*[@id="detailBullets_feature_div"]/ul/li[15]/span'),
                imageCount: xpath.select('//*[@id="altImages"]/ul/li', doc)?.length || 0,
                mainImage: getAttr('//*[@id="landingImage"]', 'src'),
                description: getText('//*[@id="productFactsDesktopExpander"]/div[1]/ul'),
                hasAplus: xpath.select('//*[@id="aplus"]', doc)?.length > 0,
                category: getText('//*[@id="wayfinding-breadcrumbs_feature_div"]/ul'),
                boughtLastMonth: getText('//*[@id="socialProofingAsinFaceout_feature_div"]/div/div'),
                soldBy: getText('//*[@id="merchantInfoFeature_feature_div"]/div[2]/div[1]/span'),
                scrapedAt: new Date().toISOString()
            };

            // Parse numeric values
            data.price = parseFloat(data.price.replace(/[^\d.]/g, '')) || 0;
            data.rating = parseFloat(data.rating) || 0;

            // Extract BSR from complicated string "15 in Electronics (See Top 100 in Electronics)"
            if (data.bsr) {
                const match = data.bsr.match(/#([\d,]+)/) || data.bsr.match(/(\d+) in/);
                if (match) {
                    data.bsr = parseInt(match[1].replace(/,/g, ''));
                }
            }

            console.log(`✅ Scraped successfully: ${data.title.substring(0, 30)}...`);
            return data;
        } catch (error) {
            console.error(`⚠️ Direct Scrape Warning for ${asin}:`, error.message);
            if (retries < MAX_RETRIES) {
                const backoffDelay = (retries + 1) * 3000; // 3s, 6s, 9s backoff
                console.log(`⏳ Retrying ${asin} in ${backoffDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                return this.scrapeAsin(asin, retries + 1);
            } else {
                console.error(`❌ Direct Scrape FAILED for ${asin} after ${MAX_RETRIES} retries.`);
                throw error;
            }
        }
    }
}

module.exports = new DirectScraperService();
