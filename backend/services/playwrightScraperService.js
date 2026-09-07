const { chromium } = require('playwright');
const { sql, getPool } = require('../database/db');
const logger = require('../utils/logger');

class PlaywrightScraperService {
    constructor() {
        this.browser = null;
        this.context = null;
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        ];
        this.proxyList = this.parseProxyList();
        this.proxyIndex = 0;
        this.maxRetries = parseInt(process.env.SCRAPER_MAX_RETRIES) || 3;
        this.requestTimeout = parseInt(process.env.SCRAPER_REQUEST_TIMEOUT) || 30000;
        this.navigationTimeout = parseInt(process.env.SCRAPER_NAVIGATION_TIMEOUT) || 45000;
        this.concurrentPages = parseInt(process.env.SCRAPER_CONCURRENT_PAGES) || 3;
        this.isInitialized = false;
        this.initLock = null;
    }

    parseProxyList() {
        const proxyEnv = process.env.SCRAPER_PROXY_LIST || process.env.PROXY_URL;
        if (!proxyEnv) return [];
        
        return proxyEnv.split(',').map(p => p.trim()).filter(p => p.length > 0);
    }

    getNextProxy() {
        if (this.proxyList.length === 0) return null;
        const proxy = this.proxyList[this.proxyIndex];
        this.proxyIndex = (this.proxyIndex + 1) % this.proxyList.length;
        return proxy;
    }

    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    async initialize() {
        if (this.isInitialized && this.browser && this.browser.isConnected()) {
            return;
        }

        if (this.initLock) {
            await this.initLock;
            return;
        }

        this.initLock = (async () => {
            try {
                const launchOptions = {
                    headless: process.env.SCRAPER_HEADLESS !== 'false',
                    args: [
                        '--disable-blink-features=AutomationControlled',
                        '--disable-features=IsolateOrigins,site-per-process',
                        '--disable-site-isolation-trials',
                        '--disable-web-security',
                        '--disable-features=BlockInsecurePrivateNetworkRequests',
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu',
                        '--window-size=1366,768',
                        '--lang=en-US,en',
                    ],
                    ignoreDefaultArgs: ['--enable-automation'],
                };

                if (process.env.SCRAPER_PROXY_SERVER) {
                    launchOptions.proxy = {
                        server: process.env.SCRAPER_PROXY_SERVER,
                    };
                }

                this.browser = await chromium.launch(launchOptions);
                
                this.browser.on('disconnected', () => {
                    logger.warn('Playwright browser disconnected');
                    this.isInitialized = false;
                    this.browser = null;
                });

                this.isInitialized = true;
                logger.info('Playwright browser initialized successfully');
            } catch (error) {
                this.isInitialized = false;
                this.initLock = null;
                logger.error('Failed to initialize Playwright browser', { error: error.message });
                throw error;
            }
        })();

        await this.initLock;
        this.initLock = null;
    }

    async createContext(proxy = null) {
        await this.initialize();

        const contextOptions = {
            userAgent: this.getRandomUserAgent(),
            viewport: { width: 1366, height: 768 },
            locale: 'en-IN',
            timezoneId: 'Asia/Kolkata',
            extraHTTPHeaders: {
                'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
            },
            bypassCSP: true,
            ignoreHTTPSErrors: true,
            javaScriptEnabled: true,
        };

        if (proxy) {
            const proxyUrl = proxy.startsWith('http') ? proxy : `http://${proxy}`;
            try {
                const url = new URL(proxyUrl);
                contextOptions.proxy = {
                    server: `${url.protocol}//${url.host}`,
                    username: url.username || undefined,
                    password: url.password || undefined,
                };
            } catch (e) {
                logger.warn('Invalid proxy format', { proxy });
            }
        }

        const context = await this.browser.newContext(contextOptions);

        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en', 'hi'] });
        });

        return context;
    }

    async createPage(context) {
        const page = await context.newPage();
        
        page.setDefaultTimeout(this.requestTimeout);
        page.setDefaultNavigationTimeout(this.navigationTimeout);

        page.on('console', msg => {
            if (msg.type() === 'error') {
                logger.debug('Page console error', { text: msg.text() });
            }
        });

        page.on('pageerror', error => {
            logger.debug('Page error', { error: error.message });
        });

        return page;
    }

    async scrapeAsin(asin, options = {}) {
        const { retries = 0, proxy = null } = options;
        const startTime = Date.now();
        
        let context = null;
        let page = null;

        try {
            context = await this.createContext(proxy);
            page = await this.createPage(context);

            const url = `https://www.amazon.in/dp/${asin}`;
            
            await this.navigateWithRetry(page, url);

            if (await this.isCaptchaPage(page)) {
                throw new Error('CAPTCHA_CHALLENGE');
            }

            if (await this.isBlockedPage(page)) {
                throw new Error('BLOCKED_OR_REDIRECTED');
            }

            const data = await this.extractProductData(page, asin);
            
            const duration = Date.now() - startTime;
            logger.info('ASIN scraped successfully', { asin, duration, rating: data.rating, hasAplus: data.hasAplus });

            return {
                success: true,
                asin,
                ...data,
                scrapedAt: new Date().toISOString(),
                duration,
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            
            if (error.message === 'CAPTCHA_CHALLENGE') {
                logger.warn('CAPTCHA encountered', { asin, retries });
            } else if (error.message === 'BLOCKED_OR_REDIRECTED') {
                logger.warn('Blocked or redirected', { asin, retries });
            } else {
                logger.error('Scrape failed', { asin, retries, error: error.message, duration });
            }

            if (retries < this.maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 2000, 30000);
                await new Promise(r => setTimeout(r, delay));
                
                const nextProxy = this.proxyList.length > 0 ? this.getNextProxy() : proxy;
                return this.scrapeAsin(asin, { retries: retries + 1, proxy: nextProxy });
            }

            return {
                success: false,
                asin,
                error: error.message,
                scrapedAt: new Date().toISOString(),
                duration,
            };

        } finally {
            if (page) {
                try { await page.close(); } catch (_) {}
            }
            if (context) {
                try { await context.close(); } catch (_) {}
            }
        }
    }

    async navigateWithRetry(page, url, maxNavRetries = 2) {
        for (let i = 0; i <= maxNavRetries; i++) {
            try {
                const response = await page.goto(url, { 
                    waitUntil: 'domcontentloaded',
                    timeout: this.navigationTimeout 
                });
                
                if (response && response.status() >= 400) {
                    throw new Error(`HTTP ${response.status()}`);
                }
                
                await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
                return response;
            } catch (error) {
                if (i === maxNavRetries) throw error;
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            }
        }
    }

    async isCaptchaPage(page) {
        try {
            const captchaSelectors = [
                '#captchacharacters',
                'form[action*="/errors/validateCaptcha"]',
                'img[src*="captcha"]',
                'input[name="amzn"]',
                'input[name="amzn-r"]',
                'div.a-box:has-text("Type the characters")',
                'div:has-text("Enter the characters you see")',
            ];

            for (const selector of captchaSelectors) {
                const element = await page.$(selector).catch(() => null);
                if (element) return true;
            }

            const content = await page.content();
            const captchaIndicators = [
                'api/services/captcha',
                'Type the characters you see',
                'Enter the characters you see',
                'captcha',
            ];
            
            return captchaIndicators.some(indicator => 
                content.toLowerCase().includes(indicator.toLowerCase())
            );
        } catch (_) {
            return false;
        }
    }

    async isBlockedPage(page) {
        try {
            const url = page.url();
            if (url.includes('/errors/') || url.includes('/captcha') || url.includes('/ap/signin')) {
                return true;
            }

            const blockedSelectors = [
                'text=/robot|blocked|unusual traffic/i',
                'div[id*="captcha"]',
                '#captchacharacters',
            ];

            for (const selector of blockedSelectors) {
                const element = await page.$(selector).catch(() => null);
                if (element) {
                    const text = await element.textContent().catch(() => '');
                    // Skip false positives from scripts
                    if (text && text.length < 200) return true;
                }
            }

            // Check if we actually got product content
            const hasProductTitle = await page.$('#productTitle, #title, h1').catch(() => null);
            if (!hasProductTitle) return true;

            return false;
        } catch (_) {
            return false;
        }
    }

    async extractProductData(page, asin) {
        const data = {
            asin,
            rating: 0,
            reviewCount: 0,
            ratingBreakdown: {},
            hasAplus: false,
            aplusDetails: null,
            verifiedAsin: null,
            title: null,
            price: 0,
            bsr: null,
        };

        try {
            data.verifiedAsin = await this.extractAsin(page, asin);
            data.title = await this.extractTitle(page);
            data.price = await this.extractPrice(page);
            data.bsr = await this.extractBSR(page);
            data.rating = await this.extractRating(page);
            data.reviewCount = await this.extractReviewCount(page);
            data.ratingBreakdown = await this.extractRatingBreakdown(page);
            data.hasAplus = await this.extractAplusPresence(page);
            data.aplusDetails = await this.extractAplusDetails(page);
        } catch (error) {
            logger.error('Data extraction error', { asin, error: error.message });
        }

        return data;
    }

    async extractAsin(page, expectedAsin) {
        const selectors = [
            '#ASIN',
            'input[name="ASIN"]',
            '#averageCustomerReviews[data-asin]',
            '#detailBullets_feature_div li:has-text("ASIN")',
            '#productDetails_detailBullets_sections1 th:has-text("ASIN") + td',
            '#prodDetails th:has-text("ASIN") + td',
        ];

        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    let value = await element.getAttribute('value') || await element.getAttribute('data-asin') || await element.textContent();
                    if (value) {
                        const match = value.match(/[A-Z0-9]{10}/);
                        if (match) return match[0];
                    }
                }
            } catch (_) {}
        }

        try {
            const url = page.url();
            const match = url.match(/\/dp\/([A-Z0-9]{10})/);
            if (match) return match[1];
        } catch (_) {}

        return expectedAsin;
    }

    async extractTitle(page) {
        const selectors = [
            '#productTitle',
            '#title',
            'h1#title span',
            '[data-feature-name="title"]',
        ];

        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    if (text && text.trim().length > 0) {
                        return text.trim();
                    }
                }
            } catch (_) {}
        }
        return null;
    }

    async extractPrice(page) {
        const selectors = [
            '.a-price .a-offscreen',
            '#priceblock_ourprice',
            '#priceblock_dealprice',
            '.a-price-whole',
            '#corePrice_feature_div .a-offscreen',
            '.reinventPricePriceToPayMargin .a-offscreen',
        ];

        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    if (text) {
                        const price = parseFloat(text.replace(/[^\d.]/g, ''));
                        if (!isNaN(price) && price > 0) return price;
                    }
                }
            } catch (_) {}
        }
        return 0;
    }

    async extractBSR(page) {
        const selectors = [
            '#productDetails_detailBullets_sections1 th:has-text("Best Sellers Rank") + td',
            '#detailBullets_feature_div li:has-text("Best Sellers Rank")',
            '#SalesRank',
            '.zg_hrsr_ladder li:first-child span',
        ];

        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    if (text) {
                        const match = text.match(/#([\d,]+)/);
                        if (match) return parseInt(match[1].replace(/,/g, ''));
                    }
                }
            } catch (_) {}
        }
        return null;
    }

    async extractRating(page) {
        const selectors = [
            '#averageCustomerReviews #acrPopover .a-size-small.a-color-base',
            '#averageCustomerReviews .a-icon-alt',
            '#acrPopover .a-icon-alt',
            '.cr-widget-TitleRatingsHistogram .a-icon-alt',
            '[data-hook="rating-out-of-text"]',
            '#averageCustomerReviews span.a-icon-alt',
            '.a-star-mini-4 .a-icon-alt',
            '.a-star-mini-5 .a-icon-alt',
            '.a-star-mini-3 .a-icon-alt',
            '.a-star-mini-2 .a-icon-alt',
            '.a-star-mini-1 .a-icon-alt',
        ];

        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    if (text) {
                        const match = text.match(/([0-5](?:[.,]\d+)?)\s*out\s*of\s*5/i);
                        if (match) {
                            return parseFloat(match[1].replace(',', '.'));
                        }
                        const directMatch = text.match(/^([0-5](?:[.,]\d+)?)$/);
                        if (directMatch) {
                            return parseFloat(directMatch[1].replace(',', '.'));
                        }
                    }
                }
            } catch (_) {}
        }
        return 0;
    }

    async extractReviewCount(page) {
        const selectors = [
            '#acrCustomerReviewText',
            '#averageCustomerReviews #reviewCount',
            '[data-hook="total-review-count"]',
            '.cr-widget-TitleRatingsHistogram:has-text("global ratings")',
            '#averageCustomerReviews #acrCustomerReviewLink',
        ];

        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    if (text) {
                        const match = text.match(/([\d,]+)\s*(?:global\s*)?ratings?/i);
                        if (match) {
                            return parseInt(match[1].replace(/,/g, ''));
                        }
                        const ariaLabel = await element.getAttribute('aria-label');
                        if (ariaLabel) {
                            const ariaMatch = ariaLabel.match(/([\d,]+)\s*reviews?/i);
                            if (ariaMatch) {
                                return parseInt(ariaMatch[1].replace(/,/g, ''));
                            }
                        }
                    }
                }
            } catch (_) {}
        }
        return 0;
    }

    async extractRatingBreakdown(page) {
        const breakdown = {};
        try {
            const rows = await page.$$('#histogramTable tr, .cr-histogram-row');
            for (const row of rows) {
                try {
                    const starText = await row.$eval('td:first-child, th:first-child, .a-link-normal', el => el.textContent()).catch(() => '');
                    const percentText = await row.$eval('td:nth-child(2), .a-text-right', el => el.textContent()).catch(() => '');
                    
                    const starMatch = starText.match(/(\d)\s*star/i);
                    const percentMatch = percentText.match(/(\d+)%/);
                    
                    if (starMatch && percentMatch) {
                        breakdown[`${starMatch[1]}Star`] = parseInt(percentMatch[1]);
                    }
                } catch (_) {}
            }
        } catch (_) {}

        if (Object.keys(breakdown).length === 0) {
            for (let star = 5; star >= 1; star--) {
                breakdown[`${star}Star`] = 0;
            }
        }
        return breakdown;
    }

    async extractAplusPresence(page) {
        const aplusSelectors = [
            '#aplus',
            '#aplus3p',
            '#aplus_feature_div',
            '[data-feature-name="aplus"]',
            '#dpx-aplus-product-description_feature_div',
            '.aplus-v2',
            '.celwidget[id*="aplus"]',
        ];

        for (const selector of aplusSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const html = await element.innerHTML();
                    if (html && html.length > 500) {
                        const hasRealContent = await this.verifyAplusContent(page, selector);
                        if (hasRealContent) return true;
                    }
                }
            } catch (_) {}
        }

        try {
            const hasAplusScript = await page.evaluate(() => {
                const scripts = document.querySelectorAll('script');
                for (const script of scripts) {
                    if (script.textContent && script.textContent.includes('aplus')) {
                        return true;
                    }
                }
                return false;
            });
            if (hasAplusScript) return true;
        } catch (_) {}

        return false;
    }

    async verifyAplusContent(page, selector) {
        try {
            const hasImages = await page.$eval(selector, el => 
                el.querySelectorAll('img, picture, [data-a-dynamic-image]').length > 0
            ).catch(() => false);
            
            const hasModules = await page.$eval(selector, el => 
                el.querySelectorAll('.a-carousel, .a-column, .aplus-module, [class*="aplus"]').length > 0
            ).catch(() => false);

            const hasTextContent = await page.$eval(selector, el => 
                el.textContent.trim().length > 200
            ).catch(() => false);

            return hasImages || hasModules || hasTextContent;
        } catch (_) {
            return false;
        }
    }

    async extractAplusDetails(page) {
        try {
            const aplusElement = await page.$('#aplus, #aplus3p, #aplus_feature_div, [data-feature-name="aplus"]');
            if (!aplusElement) return null;

            const html = await aplusElement.innerHTML();
            const moduleCount = await aplusElement.$$('.aplus-module, .a-carousel, [class*="aplus-"]').catch(() => []).then(arr => arr.length);
            const imageCount = await aplusElement.$$eval('img', imgs => imgs.length).catch(() => 0);
            
            return {
                hasContent: html.length > 500,
                moduleCount,
                imageCount,
                htmlLength: html.length,
            };
        } catch (_) {
            return null;
        }
    }

    async scrapeBatch(asins, options = {}) {
        const { 
            concurrency = this.concurrentPages,
            onProgress = null,
            proxyRotation = true 
        } = options;

        const results = [];
        const errors = [];

        for (let i = 0; i < asins.length; i += concurrency) {
            const chunk = asins.slice(i, i + concurrency);
            const proxy = proxyRotation ? this.getNextProxy() : null;

            const promises = chunk.map(asin => this.scrapeAsin(asin, { proxy }));
            const chunkResults = await Promise.allSettled(promises);

            for (const result of chunkResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    errors.push({ asin: 'unknown', error: result.reason.message });
                }
            }

            if (onProgress) {
                onProgress({
                    processed: results.length + errors.length,
                    total: asins.length,
                    successful: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length + errors.length,
                });
            }

            if (i + concurrency < asins.length) {
                const delay = parseInt(process.env.SCRAPER_BATCH_DELAY) || 2000;
                await new Promise(r => setTimeout(r, delay));
            }
        }

        return { results, errors };
    }

    async close() {
        if (this.context) {
            try { await this.context.close(); } catch (_) {}
            this.context = null;
        }
        if (this.browser) {
            try { await this.browser.close(); } catch (_) {}
            this.browser = null;
        }
        this.isInitialized = false;
    }

    async healthCheck() {
        try {
            await this.initialize();
            const context = await this.createContext();
            const page = await this.createPage(context);
            await page.goto('https://www.amazon.in', { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.close();
            await context.close();
            return { status: 'healthy', browser: 'connected' };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
}

module.exports = new PlaywrightScraperService();