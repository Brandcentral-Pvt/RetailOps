const { chromium } = require('playwright');

/**
 * Playwright Scraper Service — Amazon India (amazon.in) product-page scraper.
 * Replaces Octoparse for in-house scraping. Uses real Chromium via Playwright,
 * with stealth-flavored launch args, per-ASIN retries, and configurable proxies.
 */
class PlaywrightScraperService {
    constructor() {
        this.headless = process.env.SCRAPER_HEADLESS !== 'false';
        this.maxRetries = parseInt(process.env.SCRAPER_MAX_RETRIES || '3', 10);
        this.requestTimeout = parseInt(process.env.SCRAPER_REQUEST_TIMEOUT || '30000', 10);
        this.navigationTimeout = parseInt(process.env.SCRAPER_NAVIGATION_TIMEOUT || '45000', 10);
        this.concurrentPages = parseInt(process.env.SCRAPER_CONCURRENT_PAGES || '2', 10);
        this.proxyUrl = process.env.PROXY_URL || null;

        this.browser = null;
        this.busy = 0;
        this.waiters = [];
    }

    /**
     * Lazy-launch a shared Chromium instance (persistent for the process lifetime).
     */
    async getBrowser() {
        if (this.browser) return this.browser;
        this.browser = await chromium.launch({
            headless: this.headless,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
            proxy: this.proxyUrl ? { server: this.proxyUrl } : undefined,
        });
        this.browser.on('disconnected', () => { this.browser = null; });
        return this.browser;
    }

    async close() {
        if (this.browser) {
            await this.browser.close().catch(() => {});
            this.browser = null;
        }
    }

    /**
     * Simple semaphore — cap simultaneously-open pages at concurrentPages.
     */
    async acquire() {
        while (this.busy >= this.concurrentPages) {
            await new Promise(r => setTimeout(r, 500));
        }
        this.busy++;
    }

    release() {
        this.busy = Math.max(0, this.busy - 1);
    }

    /**
     * Scrape a single ASIN from the live Amazon.in product page.
     * @param {string} asin - 10-char Amazon product identifier.
     * @param {object} [opts] - { proxyOverride } extra options.
     * @returns {Promise<object>} normalized extracted data.
     * @throws {Error} after retries exhausted.
     */
    async scrapeAsin(asin, opts = {}) {
        if (!asin || !/^[A-Z0-9]{10}$/i.test(asin)) {
            throw new Error(`Invalid ASIN: ${asin}`);
        }

        const url = `https://www.amazon.in/dp/${asin}`;
        let attempt = 0;
        let lastError;

        while (attempt <= this.maxRetries) {
            if (attempt > 0) {
                const backoff = Math.min(15000, (attempt) * 5000 + Math.floor(Math.random() * 2000));
                await new Promise(r => setTimeout(r, backoff));
            }
            attempt++;

            await this.acquire();
            let context = null;
            try {
                const browser = await this.getBrowser();
                context = await browser.newContext({
                    userAgent: this._getRandomUserAgent(),
                    locale: 'en-IN',
                    viewport: { width: 1366, height: 768 },
                    extraHTTPHeaders: {
                        'Accept-Language': 'en-US,en;q=0.9',
                    },
                });
                await context.addInitScript(() => {
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                });

                const page = await context.newPage();
                page.setDefaultTimeout(this.navigationTimeout);

                const response = await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: this.navigationTimeout,
                });

                if (!response || response.status() >= 400) {
                    const code = response ? response.status() : 'NO_RESPONSE';
                    if (response && response.status() === 503) {
                        // CAPTCHA / robot check — Amazon answers 503 with a puzzle page
                        throw new Error('CAPTCHA_CHALLENGE');
                    }
                    throw new Error(`HTTP ${code}`);
                }

                // Detect CAPTCHA / robot page
                const title = await page.title().catch(() => '');
                const bodyText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
                if (/Type the characters you see in this image/i.test(bodyText) ||
                    /api\/services\/captcha/i.test(await page.content().catch(() => ''))) {
                    throw new Error('CAPTCHA_CHALLENGE');
                }

                // Wait for the canonical title element to appear (page fully rendered)
                await page.waitForSelector('#productTitle', { timeout: this.navigationTimeout }).catch(() => {});

                const extracted = await this._extractFromPage(page, asin);
                if (!extracted.title) {
                    throw new Error('TITLE_NOT_FOUND');
                }

                extracted.asin = asin.toUpperCase();
                extracted.scrapedAt = new Date().toISOString();
                return extracted;
            } catch (err) {
                lastError = err;
                if (/CAPTCHA_CHALLENGE/i.test(err.message)) {
                    // Don't hammer retries on a live CAPTCHA block — fail fast.
                    throw err;
                }
            } finally {
                if (context) await context.close().catch(() => {});
                this.release();
            }
        }

        throw lastError || new Error(`Failed to scrape ${asin}`);
    }

    /**
     * Extract all desired fields from a rendered product page.
     */
    async _extractFromPage(page, asin) {
        const helpers = {
            text: async (selector) => {
                const el = page.locator(selector).first();
                return (await el.innerText({ timeout: 4000 }).catch(() => '' )) || '';
            },
            attrs: async (selector, attr) => {
                const el = page.locator(selector).first();
                return (await el.getAttribute(attr, { timeout: 4000 }).catch(() => null)) || '';
            },
            count: async (selector) => {
                return await page.locator(selector).count().catch(() => 0);
            },
            exists: async (selector) => {
                return await page.locator(selector).first().count().then(c => c > 0).catch(() => false);
            },
        };

        const title = (await helpers.text('#productTitle')).trim();

        // Price — the buybox "priceToPay" value first, then wide fallbacks
        const priceSelectors = [
            '.apexPriceToPay .a-offscreen',
            'span.a-price span.a-offscreen',
            '#priceblock_ourprice',
            '#priceblock_dealprice',
            '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
        ];
        let currentPrice = 0;
        for (const sel of priceSelectors) {
            const raw = (await helpers.text(sel)).trim();
            currentPrice = this._parsePrice(raw);
            if (currentPrice > 0) break;
        }

        // MRP — list price
        let mrp = 0;
        const mrpText = (await helpers.text('#corePriceDisplay_desktop_feature_div .basisPrice, .priceToPay .a-price .a-offscreen, #priceblock_ourprice + .a-section .a-offscreen')).trim();
        const mrpMatch = mrpText.match(/M\.?R\.?P\.?\s*:?\s*₹?([\d,]+(?:\.\d{1,2})?)/i) || mrpText.match(/₹([\d,]+(?:\.\d{1,2})?)/i);
        if (mrpMatch) {
            mrp = this._parsePrice(mrpMatch[1]);
        }
        if (!mrp) mrp = currentPrice;

        let mrpHigh = 0;
        const listPrice = (await helpers.text('.a-price.a-text-price .a-offscreen, .priceToPay > .a-offscreen')).trim();
        if (listPrice) {
            mrpHigh = this._parsePrice(listPrice);
        }

        const effectiveMrp = mrpHigh || mrp || currentPrice;
        let discountPercentage = 0;
        if (effectiveMrp > currentPrice && currentPrice > 0) {
            discountPercentage = Math.round(((effectiveMrp - currentPrice) / effectiveMrp) * 10000) / 100;
        }

        // Rating + reviews
        let rating = 0;
        let reviewCount = 0;
        const ratingRaw = (await helpers.text('#acrPopover, span[data-hook="rating-out-of-text"]')).replace(/\s+/g, ' ').trim();
        const ratingMatch = ratingRaw.match(/([0-5](?:[.,]\d{1,2})?)\s*out\s*of\s*5/i);
        if (ratingMatch) rating = parseFloat(ratingMatch[1].replace(',', '.'));
        const reviewRaw = (await helpers.text('#acrCustomerReviewText, #averageCustomerReviews a span.a-size-base')).replace(/,/g, '').trim();
        const reviewMatch = reviewRaw.match(/([\d.]+)\s*(?:ratings?|global ratings?)/i) || reviewRaw.match(/^([\d.]+)\s*(?:reviews?)?/i);
        if (reviewMatch) reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''), 10) || 0;
        // Fallback: aria label "x ratings"
        if (!reviewCount) {
            const aria = (await helpers.text('#acrCustomerReviewText'));
            reviewCount = this._parseInt(aria);
        }

        // A+ content
        const hasAplus = await helpers.exists('#aplus') || await helpers.exists('#aplus_feature_div');

        // Image count + main image (note: enumerate all hi-res thumbnails)
        const imageCount = await helpers.count('#altImages img');
        let mainImage = (await helpers.attrs('#landingImage', 'src')) || (await helpers.attrs('#imgTagWrapperId img', 'src'));
        if (imageCount > 0 && !mainImage) {
            mainImage = await page.locator('#altImages img').first().getAttribute('src').catch(() => '');
        }

        // Brand — breadcrumb link in "> Visit the X Store" or productByline
        let brand = '';
        const brandLinkSel = '#bylineInfo';
        const byline = (await helpers.text(brandLinkSel)).trim();
        const brandMatch = byline.match(/Visit the\s+([^\s]+)/i) || byline.match(/Brand:\s*([^,]+)/i);
        if (brandMatch) brand = brandMatch[1].trim();

        // Category — last breadcrumb
        let category = '';
        const breadcrumbLinks = page.locator('#wayfinding-breadcrumbs_feature_div li');
        const bcCount = await breadcrumbLinks.count().catch(() => 0);
        if (bcCount > 0) {
            category = (await breadcrumbLinks.nth(bcCount - 1).innerText().catch(() => '')).trim();
        }
        if (!category) {
            const crumb = (await helpers.text('#wayfinding-breadcrumbs_feature_div ul')).split(/\n|›/).filter(Boolean);
            category = crumb[crumb.length - 1]?.trim() || '';
        }

        // Availability — primary availability message
        let availability = '';
        const availOpts = [
            '#availability span.a-color-success',
            '#availability span',
            '#availability',
            '#outOfStock > div',
        ];
        for (const sel of availOpts) {
            const text = (await helpers.text(sel)).trim();
            if (text) { availability = text; break; }
        }

        // SoldBy — merchant/buybox seller
        let soldBy = '';
        const merchantSelectors = [
            '#merchantInfoFeature_feature_div a',
            '#sellerProfileTriggerId',
            '#sellerProfileTriggerId2',
            '#tabular-buybox-widget_feature_div a[href*="/sp?marketplaceID="]',
        ];
        for (const sel of merchantSelectors) {
            const text = (await helpers.text(sel)).trim();
            if (text && text.toLowerCase() !== 'amazon') { soldBy = text; break; }
        }
        // Default when sold directly by Amazon
        if (!soldBy) {
            const buyboxContainer = await helpers.text('#buybox').catch(() => '');
            if (/sold by amazon/i.test(buyboxContainer)) soldBy = 'Amazon';
        }

        // Deal badge
        let dealBadge = '';
        const dealSel = '#dealBadgeSupportingText, span[data-hook="deal-badge"], .a-color-price .dealText, #dealBadge_feature_div span[class*="deal"]';
        const dealText = (await helpers.text(dealSel)).replace(/\s+/g, ' ').trim();
        if (/deal/i.test(dealText)) dealBadge = dealText;

        let dealPrice = 0;
        const dealPriceRaw = (await helpers.text('.apexPriceToPay .a-offscreen, #priceblock_dealprice, .priceToPay .a-offscreen')).trim();
        dealPrice = this._parsePrice(dealPriceRaw);

        // Savings amount (from "Save ₹X" or "(X%)" deal saving strip)
        let savingsAmount = 0;
        const savingsRaw = (await helpers.text('.savingsPercentage, #apex_desktop .a-color-price, .a-price-savings')).replace(/\s+/g, ' ').trim();
        const saveMatch = savingsRaw.match(/save\s+₹([\d,]+(?:\.\d+)?)/i) || savingsRaw.match(/₹([\d,]+(?:\.\d+)?)\s*\(\d+%\)/i);
        if (saveMatch) savingsAmount = this._parsePrice(saveMatch[1]);

        // BSR (main) + sub-BSR
        let bsr = 0;
        let subBsr = 0;
        let subBsrCategory = '';
        const bsrRows = page.locator('#productDetails_detailBullets_sections1 tr, #productDetails_detailBullets_sections1 .prodDetAttrValue');
        const bsrCount = await bsrRows.count().catch(() => 0);
        for (let i = 0; i < bsrCount; i++) {
            const rowText = (await bsrRows.nth(i).innerText().catch(() => '')) || '';
            const m = rowText.match(/#([\d,]+)\s*in\s+([^(]+)\(?(?:PAID|FREE)?\)?/i);
            if (m) {
                const rank = this._parseInt(m[1]);
                if (bsr === 0) bsr = rank;
                else { subBsr = rank; subBsrCategory = m[2].trim(); break; }
            }
        }
        // Fallback: zg_hrsr block
        if (!bsr) {
            const hr = (await helpers.text('#Sales Rank, #productFactsDesktopExpander ul.zg_hrsr')).replace(/\s+/g, ' ').trim();
            const hrMatch = hr.match(/#([\d,]+)\s+in\s+([^(]+)/i);
            if (hrMatch) { bsr = this._parseInt(hrMatch[1]); }
        }

        return {
            title,
            currentPrice,
            mrp: effectiveMrp,
            discountPercentage,
            rating,
            reviewCount,
            hasAplus,
            imageUrl: mainImage,
            imagesCount: imageCount,
            brand,
            category,
            availability,
            soldBy,
            dealBadge,
            dealPrice,
            savingsAmount,
            bsr,
            subBsr,
            subBsrCategory,
            url: page.url(),
        };
    }

    _parsePrice(value) {
        if (!value) return 0;
        const cleaned = value.toString().replace(/[^\d.]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }

    _parseInt(value) {
        if (!value) return 0;
        const cleaned = value.toString().replace(/[^\d]/g, '');
        const parsed = parseInt(cleaned, 10);
        return isNaN(parsed) ? 0 : parsed;
    }

    _getRandomUserAgent() {
        const agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        ];
        return agents[Math.floor(Math.random() * agents.length)];
    }
}

module.exports = new PlaywrightScraperService();