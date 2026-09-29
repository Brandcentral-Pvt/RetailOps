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
        // Global page cap — bound in the constructor so the adaptive semaphore
        // actually throttles (previously this was read but never assigned, so
        // concurrency was NaN and open pages were effectively unlimited).
        // Default CPU-aware: 1 page per core (this box also runs the Octoparse
        // pipeline + live sync), overridable but hard-capped to keep it stable.
        const cpuCount = require('os').cpus().length;
        const defaultCap = Math.max(2, cpuCount);
        const rawCap = parseInt(process.env.SCRAPER_BASE_CONCURRENT_PAGES || process.env.SCRAPER_CONCURRENT_PAGES || String(defaultCap), 10);
        this.baseConcurrentPages = Math.min(Math.max(1, rawCap), parseInt(process.env.SCRAPER_MAX_CONCURRENT_PAGES || String(Math.max(2, cpuCount * 2)), 10));
        this.proxyUrl = process.env.PROXY_URL || null;

        this.browser = null;
        this._context = null;
        this.busy = 0;
        this._slotSeq = 0;
        this.waiters = [];

        // Dynamic concurrency tracking
        this.successCount = 0;
        this.failureCount = 0;
        this.lastSuccessTime = Date.now();
        this.consecutiveFailures = 0;
        this.maxConsecutiveFailuresBeforeReduce = parseInt(
            process.env.SCRAPER_MAX_CONSECUTIVE_FAILURES || '5',
            10
        );

        // Per-ASIN failure tracking (circuit breaker)
        this.asinFailureMap = new Map(); // asin -> {failures, lastFailure}
        this.maxAsinFailuresBeforeSkip = parseInt(
            process.env.SCRAPER_MAX_ASIN_FAILURES || '5',
            10
        );
        this.asinFailureTimeout = parseInt(
            process.env.SCRAPER_ASIN_FAILURE_TIMEOUT * 1000 || '900000',
            10
        ); // ms before resetting circuit

        // CPU/memory safeguard: track page creation time and cleanup
        this.activePages = new Map(); // page -> {createdAt, asin}
        this.maxPageAgeMs = 30000; // 30s max per page before forced cleanup
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
        this.browser.on('disconnected', () => { this.browser = null; this._context = null; });
        return this.browser;
    }

    /**
     * Get (and lazily create) a shared, session-persistent context.
     * Amazon's bot-check interstitial sets a session cookie when "Continue
     * shopping" is clicked; keeping one context warm lets subsequent ASIN
     * loads skip the interstitial instead of re-doing it on every scrape.
     */
    async getContext() {
        const browser = await this.getBrowser();
        if (this._context && this._context.browser() === browser) return this._context;
        this._context = await browser.newContext({
            userAgent: this._getRandomUserAgent(),
            locale: 'en-IN',
            viewport: { width: 1366, height: 768 },
            extraHTTPHeaders: {
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });
        await this._context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        });
        return this._context;
    }

    async close() {
        if (this._context) {
            await this._context.close().catch(() => {});
            this._context = null;
        }
        if (this.browser) {
            await this.browser.close().catch(() => {});
            this.browser = null;
        }
    }

    /**
     * Dynamic semaphore — cap simultaneously-open pages at a calculated concurrency
     * that adapts based on success/failure rates to prevent CPU overload.
     * Returns a promise that resolves when a page slot is available.
     */
    async acquire() {
        // Periodic resource check: restart the browser if idle and either the
        // restart interval elapsed or memory exceeds thresholds. Guarded by
        // activePages so we never tear down in-flight navigations.
        if (this.activePages.size === 0) {
            await this.maybeRestartBrowser();
            if (await this.checkMemoryPressure()) {
                this.busy = 0;
                this.activePages.clear();
            }
        }

        // Calculate adaptive concurrency based on recent performance
        const adaptiveConcurrent = this._calculateAdaptiveConcurrency();

        while (this.busy >= adaptiveConcurrent) {
            // Wait with jitter to avoid thundering herd
            const waitTime = 500 + Math.random() * 200;
            await new Promise(r => setTimeout(r, waitTime));
        }
        this.busy++;
        // A unique token per slot. Keying by the `busy` counter made entries
        // collide, so a finishing page could delete a different page's entry.
        const token = ++this._slotSeq;
        this.activePages.set(token, { createdAt: Date.now(), asin: null });
        return token;
    }

    release(token) {
        if (token !== undefined && token !== null) {
            this.activePages.delete(token);
        }
        this.busy = Math.max(0, this.busy - 1);
        // Periodic cleanup of stale/abandoned slots
        this._cleanupOldPages();
    }

    _calculateAdaptiveConcurrency() {
        // Base concurrency
        let concurrency = this.baseConcurrentPages;

        // If we've had many recent failures, reduce concurrency
        const timeSinceLastSuccess = Date.now() - this.lastSuccessTime;
        const failureRate = this.failureCount > 0 ? this.successCount / (this.successCount + this.failureCount) : 1;

        // Reduce concurrency if:
        // - Recent failure rate is low (< 70% success)
        // - Or many consecutive failures
        if (failureRate < 0.7 || this.consecutiveFailures >= this.maxConsecutiveFailuresBeforeReduce) {
            concurrency = Math.max(1, this.baseConcurrentPages - 3);
            // Exponential reduction if really struggling
            if (this.consecutiveFailures >= this.maxConsecutiveFailuresBeforeReduce * 2) {
                concurrency = Math.max(1, Math.floor(this.baseConcurrentPages / 2));
            }
        } else if (failureRate > 0.9 && timeSinceLastSuccess > 30000) {
            // Good recovery - gradually increase
            concurrency = Math.min(
                this.baseConcurrentPages + 1,
                this.baseConcurrentPages + 3
            );
        }

        return concurrency;
    }

    _cleanupOldPages() {
        const now = Date.now();
        for (const [key, info] of this.activePages) {
            if (now - info.createdAt > this.maxPageAgeMs) {
                // Drop the stale entry so activePages can return to 0 and the
                // browser-restart / memory-pressure checks become reachable again.
                //
                // `busy` is deliberately NOT decremented here: the page behind
                // this entry is usually still navigating (it just exceeded the
                // soft maxPageAgeMs). Decrementing it inflated the real in-flight
                // count downward, so the acquire() gate admitted far more
                // concurrent amazon.in pages than configured — which is what
                // drove the bot-protection failures.
                this.activePages.delete(key);
            }
        }
    }

    /**
     * Click the "Continue shopping" button on Amazon's anti-bot interstitial.
     * Returns true if a button was found and clicked, false otherwise.
     */
    async _clickContinueShopping(page) {
        try {
            const btn = page.getByRole('button', { name: /continue shopping/i });
            const count = await btn.count().catch(() => 0);
            if (!count) return false;
            await btn.first().click({ timeout: 8000 }).catch(() => {});
            await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(1500);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Navigate a page to the product URL, transparently clearing Amazon's
     * bot-check interstitial (up to 2 rounds of click-through + re-navigate)
     * and waiting until the canonical title has rendered. Throws on hard
     * failures (HTTP errors, image-CAPTCHA) so the caller can retry.
     */
    async _navigateToProduct(page, url) {
        const PICK = 8000;
        const GOTO = 20000;
        let response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: GOTO,
        });

        if (!response || response.status() >= 400) {
            const code = response ? response.status() : 'NO_RESPONSE';
            if (response && response.status() === 503) throw new Error('CAPTCHA_CHALLENGE');
            throw new Error(`HTTP ${code}`);
        }

        // Fast race: product page elements OR interstitial button (8 s).
        await Promise.race([
            page.waitForSelector('#productTitle, #centerCol, #aplus, #aplus_feature_div', { timeout: PICK }),
            page.getByRole('button', { name: /continue shopping/i }).first().waitFor({ state: 'attached', timeout: PICK }),
        ]).catch(() => {});

        // Image CAPTCHA
        const html = await page.content().catch(() => '');
        if (/api\/services\/captcha/i.test(html)) throw new Error('CAPTCHA_CHALLENGE');

        // Interstitial loop — at most 2 rounds (each ≤ ~18 s).
        for (let round = 0; round < 2; round++) {
            const hasContinueBtn = (await page.locator('button').filter({ hasText: /continue shopping/i }).count().catch(() => 0)) > 0;
            if (!hasContinueBtn) break;
            await this._clickContinueShopping(page);
            response = await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: GOTO,
            }).catch(() => null);
            if (!response) throw new Error('INTERSTITIAL_REDIRECT_FAILED');
            if (response.status() >= 400) {
                if (response.status() === 503) throw new Error('CAPTCHA_CHALLENGE');
                throw new Error('INTERSTITIAL_REDIRECT_FAILED');
            }
            await Promise.race([
                page.waitForSelector('#productTitle, #centerCol, #aplus, #aplus_feature_div', { timeout: PICK }),
                page.getByRole('button', { name: /continue shopping/i }).first().waitFor({ state: 'attached', timeout: PICK }),
            ]).catch(() => {});
        }

        // Final guard: a real product page renders a meaningful DOM.
        const bodyLen = await page.locator('body').evaluate(el => el.innerHTML.length, { timeout: 8000 }).catch(() => 0);
        const productEls = await page.locator('#productTitle, #centerCol, #aplus, #aplus_feature_div, #averageCustomerReviews, #productDetails_feature_div').count().catch(() => 0);
        if (bodyLen < 1000 && productEls === 0) throw new Error('TITLE_NOT_FOUND');
        return true;
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

        // Circuit breaker: skip ASINs that have been failing repeatedly
        const failureEntry = this.asinFailureMap.get(asin);
        if (failureEntry && failureEntry.failures >= this.maxAsinFailuresBeforeSkip) {
            const timeSinceLastFailure = Date.now() - failureEntry.lastFailure;
            if (timeSinceLastFailure < this.asinFailureTimeout) {
                throw new Error(`ASIN ${asin} skipped due to circuit breaker (${failureEntry.failures} recent failures)`);
            }
            // Timeout exceeded, reset circuit
            this.asinFailureMap.delete(asin);
        }

        const url = `https://www.amazon.in/dp/${asin}`;
        let attempt = 0;
        let lastError;

        while (attempt <= this.maxRetries) {
            if (attempt > 0) {
                const backoff = await this._improvedBackoff(attempt);
                await new Promise(r => setTimeout(r, backoff));
            }
            attempt++;

            const slot = await this.acquire();
            let page = null;
            try {
                const context = await this.getContext();
                page = await context.newPage();
                page.setDefaultTimeout(this.navigationTimeout);

                await this._navigateToProduct(page, url);

                const extracted = opts.full
                    ? await this._extractFullFromPage(page, asin)
                    : await this._extractFromPage(page, asin);
                if (!extracted.title) {
                    throw new Error('TITLE_NOT_FOUND');
                }

                extracted.asin = asin.toUpperCase();
                extracted.scrapedAt = new Date().toISOString();
                
                // Track success for dynamic concurrency and circuit breaker
                this.trackAsinSuccess(asin);
                this.consecutiveFailures = 0;
                
                return extracted;
            } catch (err) {
                lastError = err;
                // Track failure for circuit breaker
                this.trackAsinFailure(asin);

                if (/CAPTCHA_CHALLENGE/i.test(err.message)) {
                    // Don't hammer retries on a live CAPTCHA block — fail fast.
                    throw err;
                }
            } finally {
                if (page) await page.close().catch(() => {});
                this.release(slot);
            }
        }

        throw lastError || new Error(`Failed to scrape ${asin}`);
    }

    /**
     * Extract the three fields the Creators API cannot provide:
     * A+ content flag, star rating, and review count.
     * Title is returned only as a page-validity guard; the API supplies
     * the real title, price, BSR, etc. Text is read via textContent so
     * CSS-hidden (unrendered) elements still resolve.
     */
    async _extractFromPage(page, asin) {
        const textContent = async (selector) => {
            const count = await page.locator(selector).count().catch(() => 0);
            if (!count) return '';
            const value = await page.locator(selector).first().evaluate((node) => node.textContent || '', null, { timeout: 5000 }).catch(() => '');
            return String(value).trim();
        };

        // Title — validity check only
        const title = await textContent('#productTitle');

        // A+ content
        const hasAplus = (await page.locator('#aplus, #aplus_feature_div').count().catch(() => 0)) > 0;

        // Star rating
        let rating = null;
        const ratingRaw = (await textContent('#acrPopover')).replace(/\s+/g, ' ');
        const ratingMatch = ratingRaw.match(/([0-5](?:[.,]\d{1,2})?)\s*out\s*of\s*5/i);
        if (ratingMatch) rating = parseFloat(ratingMatch[1].replace(',', '.'));

        // Review count — exactly like "(4)", "4 ratings", or "1,234".
        let reviewCount = null;
        let reviewRaw = (await textContent('#acrCustomerReviewText')).replace(/\s+/g, ' ');
        if (!reviewRaw) {
            reviewRaw = (await textContent('#averageCustomerReviews a span.a-size-base, #acrCustomerReviewLink')).replace(/\s+/g, ' ');
        }
        const reviewText = reviewRaw.trim();
        let reviewNumText = null;
        let m;
        const paren = reviewText.match(/\(([\d,]+)\)/);
        if (paren) reviewNumText = paren[1];
        else if ((m = reviewText.match(/([\d,]+)\s*(?:customer\s+)?ratings?/i))) reviewNumText = m[1];
        else if ((m = reviewText.match(/([\d,]+)\s*reviews?/i))) reviewNumText = m[1];
        else if (/^[\d,]+$/.test(reviewText)) reviewNumText = reviewText;
        if (reviewNumText) reviewCount = parseInt(reviewNumText.replace(/,/g, ''), 10) || null;

        return { title, rating, reviewCount, hasAplus };
    }

    /**
     * Full product scrape used when the Creators/PA-API cannot serve an ASIN
     * (e.g. "The ItemId X is not accessible through the Product Advertising
     * API"). Extracts the full field set the API normally provides. All text
     * reads use textContent so CSS-hidden elements still resolve.
     */
    async _extractFullFromPage(page, asin) {
        const count = async (sel) => (await page.locator(sel).count().catch(() => 0));
        const textContent = async (selector) => {
            if (!(await count(selector))) return '';
            const value = await page.locator(selector).first().evaluate((node) => node.textContent || '', null, { timeout: 5000 }).catch(() => '');
            return String(value).trim();
        };
        const collectTexts = async (selector) => {
            const n = await count(selector);
            const out = [];
            for (let i = 0; i < n; i++) {
                const t = await page.locator(selector).nth(i).evaluate((node) => (node.textContent || '').trim(), null, { timeout: 3000 }).catch(() => '');
                if (t) out.push(t);
            }
            return out;
        };

        // Title — also serves as page-validity guard
        const title = await textContent('#productTitle');

        // Price — buybox first, then wide fallbacks
        const priceSelectors = [
            '.apexPriceToPay .a-offscreen',
            'span.a-price span.a-offscreen',
            '#priceblock_ourprice',
            '#priceblock_dealprice',
            '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
        ];
        let currentPrice = 0;
        for (const sel of priceSelectors) {
            currentPrice = this._parsePrice(await textContent(sel));
            if (currentPrice > 0) break;
        }

        // MRP — label "M.R.P.: ₹X" in the core price display (avoids the
        // "per piece" unit price ₹49.75 red herring), then a-text-price
        // fallbacks that actually exceed the selling price.
        let mrp = 0;
        const corePriceTexts = await collectTexts('#corePriceDisplay_desktop_feature_div span.aok-offscreen, #corePriceDisplay_desktop_feature_div .a-offscreen');
        const corePriceText = corePriceTexts.join(' | ');
        const mrpMatch = corePriceText.match(/M\.?R\.?P\.[:\s]*₹?([\d,]+(?:\.\d{1,2})?)/i);
        if (mrpMatch) mrp = this._parsePrice(mrpMatch[1]);
        if (!mrp) {
            const listPrices = await collectTexts('.a-price.a-text-price .a-offscreen, .priceToPay > .a-offscreen');
            for (const lp of listPrices) {
                const p = this._parsePrice(lp);
                if (p > currentPrice) { mrp = p; break; }
            }
        }
        if (!mrp) mrp = currentPrice;
        const effectiveMrp = mrp;
        // Discount % from "with N percent savings" text, else computed
        let discountPercentage = 0;
        const savingsMatch = corePriceText.match(/with\s+([\d]+)\s*percent\s+savings/i);
        if (savingsMatch) {
            discountPercentage = parseInt(savingsMatch[1], 10) || 0;
        } else if (effectiveMrp > currentPrice && currentPrice > 0) {
            discountPercentage = Math.round(((effectiveMrp - currentPrice) / effectiveMrp) * 10000) / 100;
        }

        // Rating + reviews
        let rating = null;
        const ratingRaw = (await textContent('#acrPopover, span[data-hook="rating-out-of-text"]')).replace(/\s+/g, ' ');
        const ratingMatch = ratingRaw.match(/([0-5](?:[.,]\d{1,2})?)\s*out\s*of\s*5/i);
        if (ratingMatch) rating = parseFloat(ratingMatch[1].replace(',', '.'));

        let reviewCount = null;
        const reviewRaw = (await textContent('#acrCustomerReviewText, #averageCustomerReviews a span.a-size-base')).replace(/\s+/g, ' ').trim();
        const reviewMatch = reviewRaw.match(/([\d,]+)\s*(?:customer\s+)?(?:ratings?|global ratings?)/i)
            || reviewRaw.match(/\(([\d,]+)\)/)
            || reviewRaw.match(/^([\d,]+)\s*(?:reviews?)?/i);
        if (reviewMatch) reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''), 10) || null;

        // A+ content
        const hasAplus = (await count('#aplus, #aplus_feature_div')) > 0;

        // Image count + main image
        const imageCount = await count('#altImages img');
        let mainImage = '';
        const landingImg = await page.locator('#landingImage').first().getAttribute('src', { timeout: 5000 }).catch(() => null);
        if (!landingImg) {
            mainImage = await page.locator('#imgTagWrapperId img, #altImages img').first().getAttribute('src', { timeout: 5000 }).catch(() => '');
        } else {
            mainImage = landingImg;
        }

        // Brand — buybox byline "Visit the X Store"
        let brand = '';
        const byline = await textContent('#bylineInfo');
        const brandMatch = byline.match(/Visit the\s+([^\s,]+)/i) || byline.match(/Brand:\s*([^,]+)/i);
        if (brandMatch) brand = brandMatch[1].trim();

        // Category — last breadcrumb
        let category = '';
        const bcCount = await count('#wayfinding-breadcrumbs_feature_div li');
        if (bcCount > 0) {
            category = (await page.locator('#wayfinding-breadcrumbs_feature_div li').nth(bcCount - 1).evaluate((n) => n.textContent || '', null, { timeout: 5000 }).catch(() => '')).trim();
        }
        if (!category) {
            const crumbs = (await textContent('#wayfinding-breadcrumbs_feature_div ul')).split(/\n|›/).filter(Boolean);
            category = crumbs[crumbs.length - 1]?.trim() || '';
        }

        // Availability
        let availability = '';
        const availOpts = ['#availability span.a-color-success', '#availability span', '#availability', '#outOfStock > div'];
        for (const sel of availOpts) {
            const t = await textContent(sel);
            if (t) { availability = t; break; }
        }

        // SoldBy — buybox merchant
        let soldBy = '';
        const merchantSelectors = [
            '#merchantInfoFeature_feature_div a',
            '#sellerProfileTriggerId',
            '#sellerProfileTriggerId2',
            '#tabular-buybox-widget_feature_div a[href*="/sp?marketplaceID="]',
        ];
        for (const sel of merchantSelectors) {
            const t = await textContent(sel);
            if (t && t.toLowerCase() !== 'amazon') { soldBy = t; break; }
        }
        if (!soldBy && /sold by amazon/i.test(await textContent('#buybox'))) soldBy = 'Amazon';

        // Deal badge
        let dealBadge = '';
        const dealText = (await textContent('#dealBadgeSupportingText, span[data-hook="deal-badge"], .a-color-price .dealText, #dealBadge_feature_div span[class*="deal"]')).replace(/\s+/g, ' ').trim();
        if (/deal/i.test(dealText)) dealBadge = dealText;

        let dealPrice = 0;
        const dealPriceRaw = await textContent('.apexPriceToPay .a-offscreen, #priceblock_dealprice, .priceToPay .a-offscreen');
        dealPrice = this._parsePrice(dealPriceRaw);

        // Savings amount
        let savingsAmount = 0;
        const savingsRaw = (await textContent('.savingsPercentage, #apex_desktop .a-color-price, .a-price-savings')).replace(/\s+/g, ' ').trim();
        const saveMatch = savingsRaw.match(/save\s+₹([\d,]+(?:\.\d+)?)/i) || savingsRaw.match(/₹([\d,]+(?:\.\d+)?)\s*\(\d+%\)/i);
        if (saveMatch) savingsAmount = this._parsePrice(saveMatch[1]);

        // BSR (main) + sub-BSR
        let bsr = 0;
        let subBsr = 0;
        let subBsrCategory = '';
        const bsrRows = page.locator('#productDetails_detailBullets_sections1 tr, #productDetails_detailBullets_sections1 .prodDetAttrValue');
        const bsrCount = await bsrRows.count().catch(() => 0);
        for (let i = 0; i < bsrCount; i++) {
            const rowText = (await bsrRows.nth(i).evaluate((n) => n.textContent || '', null, { timeout: 5000 }).catch(() => '')).replace(/\s+/g, ' ');
            const m = rowText.match(/#([\d,]+)\s*in\s+([^(]+)\(?(?:PAID|FREE)?\)?/i);
            if (m) {
                const rank = this._parseInt(m[1]);
                if (bsr === 0) bsr = rank;
                else { subBsr = rank; subBsrCategory = m[2].trim(); break; }
            }
        }
        if (!bsr) {
            const hr = (await textContent('#Sales Rank, #productFactsDesktopExpander ul.zg_hrsr')).replace(/\s+/g, ' ').trim();
            const hrMatch = hr.match(/#([\d,]+)\s+in\s+([^(]+)/i);
            if (hrMatch) bsr = this._parseInt(hrMatch[1]);
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
    /**
     * Improved retry backoff with jitter and adaptive delays.
     * @param {number} attempt - Current attempt number (1-indexed)
     * @returns {number} - Delay in milliseconds
     */
    _improvedBackoff(attempt) {
        // Base backoff with exponential growth and generous jitter
        // Attempts: 1->2s, 2->4s, 3->8s, 4->16s, 5->30s, 6->45s, 7->60s (capped)
        const baseBackoffs = [2000, 4000, 8000, 16000, 30000, 45000, 60000];
        const baseIndex = Math.min(attempt - 1, baseBackoffs.length - 1);
        const baseDelay = baseBackoffs[baseIndex];

        // Add jitter: ±25% of the base delay to avoid thundering herd
        const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1); // -25% to +25%
        const delayed = Math.max(1000, baseDelay + jitter); // minimum 1s

        // If we've had many consecutive failures, extend the delay further
        if (this.consecutiveFailures >= this.maxConsecutiveFailuresBeforeReduce) {
            const extendedFactor = Math.min(2, 1 + (this.consecutiveFailures - this.maxConsecutiveFailuresBeforeReduce) * 0.3);
            return delayed * extendedFactor;
        }

        return delayed;
    }

    /**
     * Track an ASIN failure for circuit breaker purposes.
     * If an ASIN exceeds the failure threshold, it gets skipped temporarily.
     */
    trackAsinFailure(asin) {
        const now = Date.now();
        const entry = this.asinFailureMap.get(asin) || { failures: 0, lastFailure: 0 };

        entry.failures += 1;
        entry.lastFailure = now;
        this.asinFailureMap.set(asin, entry);

        // Check if we should skip this ASIN temporarily
        if (entry.failures >= this.maxAsinFailuresBeforeSkip) {
            // Schedule reset after timeout
            setTimeout(() => {
                this.asinFailureMap.delete(asin);
            }, this.asinFailureTimeout);
        }

        // Update overall failure tracking
        this.failureCount++;
        this.consecutiveFailures = Math.max(
            this.consecutiveFailures,
            entry.failures
        );
        this.successCount = Math.max(0, this.successCount - 1);
        this.lastSuccessTime = now;
    }

    /**
     * Track an ASIN success for dynamic concurrency and circuit breaker.
     */
    trackAsinSuccess(asin) {
        this.successCount++;
        this.failureCount = Math.max(0, this.failureCount - 1);
        this.consecutiveFailures = 0;
        this.lastSuccessTime = Date.now();

        // Clean up circuit breaker entry for this ASIN
        this.asinFailureMap.delete(asin);
    }

    /**
     * Scrape all ASINs for a given seller.
     * @param {string} sellerId - Seller ID
     * @param {object} [opts] - Options: { maxAsins, delayMs, full }
     * @returns {Promise<{scraped: number, failed: number, errors: string[]}>}
     */
    async scrapeAllSellerAsins(sellerId, opts = {}) {
        const { sql, getPool } = require('../database/db');
        const pool = await getPool();
        
        const maxAsins = opts.maxAsins || 500;
        const delayMs = opts.delayMs || 2000;
        const full = opts.full || false;

        const result = await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .query(`
                SELECT TOP (@maxAsins) Id, AsinCode
                FROM Asins 
                WHERE SellerId = @sellerId 
                AND Status IN ('Active', 'Error', 'Scraping')
                AND AsinCode IS NOT NULL
                AND AsinCode LIKE 'B0%'
                ORDER BY 
                    CASE WHEN LastScrapedAt IS NULL THEN 0 ELSE 1 END,
                    LastScrapedAt ASC
            `);

        const asins = result.recordset;
        const errors = [];
        let scraped = 0;
        let failed = 0;

        logger.info(`[Scraper] Starting batch scrape for seller ${sellerId}: ${asins.length} ASINs`);

        for (const asinRecord of asins) {
            try {
                const asinCode = asinRecord.AsinCode;
                await this.scrapeAsin(asinCode, { full });
                
                // Update DB with scraped data
                await pool.request()
                    .input('asin', sql.NVarChar, asinCode)
                    .input('scrapedAt', sql.DateTime, new Date())
                    .query(`
                        UPDATE Asins SET
                            LastScrapedAt = @scrapedAt,
                            ScrapeStatus = 'COMPLETED',
                            Status = 'Active'
                        WHERE AsinCode = @asin
                    `);
                scraped++;
                
                // Rate limiting between ASINs
                if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
            } catch (err) {
                failed++;
                const msg = `ASIN ${asinRecord.AsinCode}: ${err.message}`;
                errors.push(msg);
                logger.warn(`[Scraper] Failed ${asinRecord.AsinCode}: ${err.message}`);
                
                // Update DB with error
                try {
                    await pool.request()
                        .input('asin', sql.NVarChar, asinRecord.AsinCode)
                        .input('error', sql.NVarChar, err.message)
                        .query(`
                            UPDATE Asins SET
                                ScrapeStatus = 'FAILED',
                                LastScrapeError = @error,
                                Status = 'Error'
                            WHERE AsinCode = @asin
                        `);
                } catch (dbErr) {
                    logger.error(`[Scraper] DB update failed for ${asinRecord.AsinCode}:`, dbErr.message);
                }
            }
        }

        logger.info(`[Scraper] Completed seller ${sellerId}: ${scraped} scraped, ${failed} failed`);
        return { scraped, failed, errors };
    }

    /**
     * Memory management: Check if browser should be restarted due to memory pressure
     */
    async checkMemoryPressure() {
        const mem = process.memoryUsage();
        const heapUsedMB = mem.heapUsed / 1024 / 1024;
        const rssMB = mem.rss / 1024 / 1024;
        
        const heapThresholdMB = parseInt(process.env.SCRAPER_MAX_HEAP_MB || '1500', 10);
        const rssThresholdMB = parseInt(process.env.SCRAPER_MAX_RSS_MB || '2000', 10);
        
        if (heapUsedMB > heapThresholdMB || rssMB > rssThresholdMB) {
            logger.warn(`[Scraper] Memory pressure detected: heap=${heapUsedMB.toFixed(0)}MB, rss=${rssMB.toFixed(0)}MB — restarting browser`);
            await this.close();
            this.browser = null;
            this._context = null;
            return true;
        }
        return false;
    }

    /**
     * Periodic browser restart to prevent memory leaks
     */
    async maybeRestartBrowser() {
        const now = Date.now();
        const restartIntervalMs = parseInt(process.env.SCRAPER_BROWSER_RESTART_MS || '1800000', 10); // 30 min default
        
        if (!this._lastBrowserRestart) {
            this._lastBrowserRestart = now;
        }
        
        if (now - this._lastBrowserRestart > restartIntervalMs) {
            logger.info('[Scraper] Periodic browser restart');
            await this.close();
            this.browser = null;
            this._context = null;
            this._lastBrowserRestart = now;
        }
    }

    /**
     * Force cleanup of all resources
     */
    async forceCleanup() {
        await this.close();
        this.browser = null;
        this._context = null;
        this.activePages.clear();
        this.busy = 0;
        if (global.gc) global.gc();
    }
}

module.exports = new PlaywrightScraperService();