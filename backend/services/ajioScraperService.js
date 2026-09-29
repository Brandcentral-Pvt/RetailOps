const { chromium } = require("playwright");
const logger = require("../utils/logger").service("ajio-scraper");
const fs = require("fs");
const path = require("path");

const AJIO_SCRAPER_DEBUG = process.env.AJIO_SCRAPER_DEBUG === "true";

/**
 * Canonical call-to-action labels Ajio renders on a product page. The raw
 * button text is normalised to one of these so the AVAILABILITY column shows
 * a stable, filterable value instead of "ADD TO BAG " or "Add To Bag".
 */
const AJIO_CTA_LABELS = {
  addToBag: "ADD TO BAG",
  addToCart: "ADD TO CART",
  outOfStock: "OUT OF STOCK",
  soldOut: "SOLD OUT",
  notifyMe: "NOTIFY ME",
  comingSoon: "COMING SOON",
};

/** Order matters: the first pattern that matches the raw label wins. */
const AJIO_CTA_PATTERNS = [
  [/add\s*to\s*bag/i, "addToBag"],
  [/add\s*to\s*cart/i, "addToCart"],
  [/out\s*of\s*stock/i, "outOfStock"],
  [/sold\s*out/i, "soldOut"],
  [/notify\s*me/i, "notifyMe"],
  [/coming\s*soon/i, "comingSoon"],
];

/** Labels that mean the product cannot currently be bought. */
const AJIO_CTA_OOS = new Set([
  "outOfStock",
  "soldOut",
  "notifyMe",
  "comingSoon",
]);

/**
 * Interpret an Ajio stock signal. Ajio is inconsistent: stock arrives as a
 * numeric level, as "InStock"/"OutOfStock", as "lowStock", or as a boolean.
 * Comparing with === previously missed most of those shapes, which is why
 * availability accuracy was low.
 *
 * @returns {"available"|"out_of_stock"|"unknown"}
 */
function resolveAjioStockSignal(signal) {
  if (signal == null || signal === "") return "unknown";
  if (typeof signal === "boolean") return signal ? "available" : "out_of_stock";

  if (typeof signal === "object") {
    if (typeof signal.isAvailable === "boolean") {
      return signal.isAvailable ? "available" : "out_of_stock";
    }
    return resolveAjioStockSignal(
      signal.stockLevel ?? signal.availability ?? signal.stockLevelStatus,
    );
  }

  const raw = String(signal).trim();
  if (raw === "") return "unknown";

  // A numeric level is the most reliable signal when present.
  const level = Number.parseInt(raw, 10);
  if (!Number.isNaN(level) && /^-?\d+$/.test(raw)) {
    return level > 0 ? "available" : "out_of_stock";
  }

  const key = raw.toLowerCase().replace(/[\s_-]/g, "");
  if (key === "instock" || key === "available" || key === "in") {
    return "available";
  }
  if (
    key === "outofstock" ||
    key === "unavailable" ||
    key === "notavailable" ||
    key === "out" ||
    key === "soldout"
  ) {
    return "out_of_stock";
  }
  if (key === "lowstock" || key === "limitedavailability") {
    return "available";
  }
  if (/notify|comingsoon|unavailable/i.test(raw)) return "out_of_stock";

  return "unknown";
}

/**
 * Reduce every availability signal collected from a product page to one
 * canonical status plus the call-to-action label to display.
 *
 * Signal precedence, most trustworthy first:
 *   1. Variant stock levels (Ajio prices and stocks per size)
 *   2. Product-level stock object
 *   3. The CTA button itself (label + enabled state)
 *   4. Container/schema availability strings
 *
 * @param {object} input
 * @returns {{status: string, label: string|null, ctaKey: string|null}}
 */
function resolveAjioAvailability(input = {}) {
  const {
    variantOptions,
    stock,
    productAvailability,
    containerStockLevel,
    ctaLabel,
    ctaState,
    declaredStatus,
  } = input;

  let ctaKey = null;
  if (ctaLabel) {
    const hit = AJIO_CTA_PATTERNS.find(([re]) => re.test(ctaLabel));
    if (hit) ctaKey = hit[1];
  }

  // Display label: prefer the button text we actually saw, otherwise fall back
  // to a clean canonical label for the resolved status.
  const labelFor = (status) =>
    ctaKey
      ? AJIO_CTA_LABELS[ctaKey]
      : status === "available"
        ? AJIO_CTA_LABELS.addToBag
        : AJIO_CTA_LABELS.outOfStock;

  const done = (status) => ({ status, ctaKey, label: labelFor(status) });

  // 1. Variant stock levels — most reliable on Ajio.
  if (Array.isArray(variantOptions) && variantOptions.length > 0) {
    let sawSignal = false;
    let anyAvailable = false;
    for (const variant of variantOptions) {
      const status = resolveAjioStockSignal(variant && variant.stock);
      if (status === "unknown") continue;
      sawSignal = true;
      if (status === "available") {
        anyAvailable = true;
        break;
      }
    }
    if (sawSignal) return done(anyAvailable ? "available" : "out_of_stock");
  }

  // 2. Product-level stock object.
  const stockStatus = resolveAjioStockSignal(stock);
  if (stockStatus !== "unknown") return done(stockStatus);

  // 3. The CTA button. A disabled or hidden buy button on Ajio means the
  //    product cannot be bought right now, so it counts as out of stock —
  //    previously these fell through and left the row stale.
  if (ctaKey) {
    if (AJIO_CTA_OOS.has(ctaKey)) return done("out_of_stock");
    if (ctaState === "disabled" || ctaState === "hidden") {
      return { status: "out_of_stock", ctaKey, label: AJIO_CTA_LABELS[ctaKey] };
    }
    return done("available");
  }

  // 4. Container / schema availability strings.
  const containerStatus =
    resolveAjioStockSignal(containerStockLevel) !== "unknown"
      ? resolveAjioStockSignal(containerStockLevel)
      : resolveAjioStockSignal(productAvailability);
  if (containerStatus !== "unknown") return done(containerStatus);

  // 5. Whatever the preloaded state declared.
  const declared = resolveAjioStockSignal(declaredStatus);
  if (declared !== "unknown") return done(declared);

  return { status: "unknown", ctaKey, label: null };
}

/**
 * Map a resolved status to the canonical Availability column value and to the
 * display label stored in AvailabilityStatus. Both are written so the
 * AVAILABILITY column shows the button text while downstream consumers keep
 * a machine-readable stock value.
 */
function toAjioAvailabilityFields(resolved) {
  if (!resolved || resolved.status === "unknown") {
    return { availability: null, availabilityStatus: null };
  }

  // A buy CTA that is disabled/hidden is not buyable, so the raw button text
  // ("ADD TO BAG") would be rendered as a green in-stock chip. Fall back to the
  // out-of-stock label so the stored status and the displayed chip agree.
  const isBuyCta =
    resolved.ctaKey === "addToBag" || resolved.ctaKey === "addToCart";
  const label =
    resolved.status === "out_of_stock" && isBuyCta
      ? AJIO_CTA_LABELS.outOfStock
      : resolved.label ||
        (resolved.status === "available"
          ? AJIO_CTA_LABELS.addToBag
          : AJIO_CTA_LABELS.outOfStock);

  return {
    availability: resolved.status === "available" ? "InStock" : "OutOfStock",
    availabilityStatus: label,
  };
}

/**
 * Playwright Scraper Service — Ajio (ajio.com) product-page scraper.
 * Extracts product data from Ajio product pages since there's no public API.
 */
class AjioScraperService {
  constructor() {
    this.headless = process.env.AJIO_SCRAPER_HEADLESS !== "false";
    this.maxRetries = parseInt(process.env.AJIO_SCRAPER_MAX_RETRIES || "3", 10);
    this.requestTimeout = parseInt(
      process.env.AJIO_SCRAPER_REQUEST_TIMEOUT || "30000",
      10,
    );
    this.navigationTimeout = parseInt(
      process.env.AJIO_SCRAPER_NAVIGATION_TIMEOUT || "45000",
      10,
    );

    // Concurrency: Ajio might be more sensitive, start conservative
    const cpuCount = require("os").cpus().length;
    const defaultCap = Math.max(1, Math.floor(cpuCount / 2));
    const rawCap = parseInt(
      process.env.AJIO_SCRAPER_CONCURRENT_PAGES || String(defaultCap),
      10,
    );
    this.baseConcurrentPages = Math.min(
      Math.max(1, rawCap),
      parseInt(
        process.env.AJIO_SCRAPER_MAX_CONCURRENT_PAGES ||
          String(Math.max(2, cpuCount)),
        10,
      ),
    );

    this.proxyUrl = process.env.AJIO_PROXY_URL || process.env.PROXY_URL || null;

    this.browser = null;
    this._context = null;
    this.busy = 0;
    this.waiters = [];

    // Session is established once per context; the cookie survives across pages.
    this._sessionReady = false;

    // Tracks seller IDs with an in-flight batch run so on-demand triggers
    // (Sellers page, /scraper routes) can't stack duplicate runs.
    this._runningSellers = new Set();

    // Dynamic concurrency tracking
    this.successCount = 0;
    this.failureCount = 0;
    this.lastSuccessTime = Date.now();
    this.consecutiveFailures = 0;
    this.maxConsecutiveFailuresBeforeReduce = parseInt(
      process.env.AJIO_SCRAPER_MAX_CONSECUTIVE_FAILURES || "5",
      10,
    );

    // Per-product failure tracking (circuit breaker)
    this.productFailureMap = new Map(); // productId -> {failures, lastFailure}
    this.maxProductFailuresBeforeSkip = parseInt(
      process.env.AJIO_SCRAPER_MAX_PRODUCT_FAILURES || "5",
      10,
    );
    this.productFailureTimeout = parseInt(
      process.env.AJIO_SCRAPER_PRODUCT_FAILURE_TIMEOUT * 1000 || "900000",
      10,
    );

    // CPU/memory safeguard: track page creation time and cleanup
    this.activePages = new Map(); // page -> {createdAt, productId}
    this.maxPageAgeMs = 30000; // 30s max per page before forced cleanup

    // Periodic browser restart
    this._lastBrowserRestart = null;
  }

  /**
   * Lazy-launch a shared Chromium instance (persistent for the process lifetime).
   */
  async getBrowser() {
    if (this.browser) return this.browser;
    this.browser = await chromium.launch({
      headless: this.headless,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process,TranslateUI",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process,TranslateUI",
        "--disable-infobars",
        "--window-size=1366,768",
        "--start-maximized",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-plugins",
        "--disable-popup-blocking",
        "--disable-translate",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-ipc-flooding-protection",
      ],
      proxy: this.proxyUrl ? { server: this.proxyUrl } : undefined,
    });
    this.browser.on("disconnected", () => {
      this.browser = null;
      this._context = null;
    });
    return this.browser;
  }

  /**
   * Get (and lazily create) a shared, session-persistent context.
   * Ajio's bot-check interstitial sets a session cookie when "Continue
   * shopping" is clicked; keeping one context warm lets subsequent ASIN
   * loads skip the interstitial instead of re-doing it on every scrape.
   */
  async getContext() {
    const browser = await this.getBrowser();
    if (this._context && this._context.browser() === browser)
      return this._context;
    this._context = await browser.newContext({
      userAgent: this._getRandomUserAgent(),
      locale: "en-IN",
      viewport: { width: 1366, height: 768 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      colorScheme: "light",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Ch-Ua":
          '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
    });
    await this._context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });
      window.chrome = { runtime: {} };
    });
    // Add cookies to appear more like a real user
    await this._context.addCookies([
      {
        name: "ajio_session",
        value: "test",
        domain: ".ajio.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
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
   * Dynamic semaphore — cap simultaneously-open pages.
   * Returns a promise that resolves when a page slot is available.
   */
  async acquire() {
    const adaptiveConcurrent = this._calculateAdaptiveConcurrency();
    while (this.busy >= adaptiveConcurrent) {
      const waitTime = 500 + Math.random() * 200;
      await new Promise((r) => setTimeout(r, waitTime));
    }
    this.busy++;
    this.activePages.set(`${this.busy}`, {
      createdAt: Date.now(),
      productId: null,
    });
  }

  release(page) {
    this.busy = Math.max(0, this.busy - 1);
    this.activePages.delete(page || "");
    this._cleanupOldPages();
  }

  _calculateAdaptiveConcurrency() {
    let concurrency = this.baseConcurrentPages;

    // If we've had many recent failures, reduce concurrency
    const timeSinceLastSuccess = Date.now() - this.lastSuccessTime;
    const failureRate =
      this.failureCount > 0
        ? this.successCount / (this.successCount + this.failureCount)
        : 1;

    if (
      failureRate < 0.7 ||
      this.consecutiveFailures >= this.maxConsecutiveFailuresBeforeReduce
    ) {
      concurrency = Math.max(1, this.baseConcurrentPages - 1);
      if (
        this.consecutiveFailures >=
        this.maxConsecutiveFailuresBeforeReduce * 2
      ) {
        concurrency = Math.max(1, Math.floor(this.baseConcurrentPages / 2));
      }
    } else if (failureRate > 0.9 && timeSinceLastSuccess > 30000) {
      concurrency = Math.min(
        this.baseConcurrentPages + 1,
        this.baseConcurrentPages + 2,
      );
    }

    return concurrency;
  }

  _cleanupOldPages() {
    const now = Date.now();
    for (const [key, info] of this.activePages) {
      if (now - info.createdAt > this.maxPageAgeMs) {
        this.activePages.delete(key);
        this.busy = Math.max(0, this.busy - 1);
      }
    }
  }

  _getRandomUserAgent() {
    const agents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  /**
   * Visit Ajio homepage first to establish cookies/session.
   */
  async _establishSession(page) {
    try {
      logger.debug("[AjioScraper] Visiting homepage to establish session...");
      await page.goto("https://www.ajio.com", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      // Wait for page to settle
      await page.waitForTimeout(2000).catch(() => {});
      // Handle any initial popups/cookies
      try {
        const cookieBtn = page
          .locator(
            'button:has-text("Accept"), button:has-text("I Agree"), [data-testid="cookie-accept"], button:has-text("Allow all")',
          )
          .first();
        if ((await cookieBtn.count().catch(() => 0)) > 0) {
          await cookieBtn.click({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(1000).catch(() => {});
        }
      } catch {}
      logger.debug("[AjioScraper] Session established");
    } catch (err) {
      logger.warn("[AjioScraper] Session establishment failed:", err.message);
    }
  }

  /**
   * Navigate to Ajio product page, handle any overlays/cookies.
   */
  async _navigateToProduct(page, url) {
    const GOTO = 30000;

    // Establish the session once per process, not per product — the cookies
    // live on the shared context and survive across pages.
    if (!this._sessionReady) {
      await this._establishSession(page);
      this._sessionReady = true;
    }

    let response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: GOTO,
    });

    if (!response || response.status() >= 400) {
      const code = response ? response.status() : "NO_RESPONSE";
      if (code === 403) {
        // Try with a referrer header (session may have expired)
        this._sessionReady = false;
        logger.warn("[AjioScraper] 403 received, retrying with referrer...");
        response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: GOTO,
          referer: "https://www.ajio.com/",
        });
      }
      if (!response || response.status() >= 400) {
        const statusCode = response ? response.status() : "NO_RESPONSE";
        if (statusCode !== 404) this._sessionReady = false;
        throw new Error(`HTTP ${statusCode}`);
      }
    }

    // Wait for key product elements (SSR content is available immediately;
    // the short settle lets React hydrate the gallery/price).
    await page
      .waitForSelector(
        ".dp-shm-pdp-title, .dp-shm-pdp-brand, .dp-shm-pdp-price",
        { timeout: 8000 },
      )
      .catch(() => {});
    await page.waitForTimeout(1200).catch(() => {});

    return true;
  }

  /**
   * Cheap, targeted read of the buy button's rendered text.
   *
   * The full DOM scan is deliberately skipped when core fields already
   * resolved, but the AVAILABILITY column needs the button text on every
   * product. This runs a handful of locator calls rather than the whole
   * extraction, so it stays affordable for every page.
   *
   * @returns {Promise<{ctaLabel: string|null, ctaState: string|null}>}
   */
  async _extractCtaLabel(page) {
    const selectors = [
      '[data-testid="add-to-bag"], [data-testid="add-to-cart"]',
      '[data-testid="buy-now"], .buy-now, .buy-button, .cta-button',
      ".add-to-bag, .add-to-cart, .addtocart",
      'button:has-text("ADD TO BAG"), button:has-text("Add to Bag")',
      'button:has-text("ADD TO CART"), button:has-text("Add to Cart")',
      'button:has-text("OUT OF STOCK"), button:has-text("Sold Out"), button:has-text("NOTIFY ME")',
    ];

    for (const sel of selectors) {
      try {
        const count = await page.locator(sel).count().catch(() => 0);
        if (count === 0) continue;

        for (let i = 0; i < Math.min(count, 3); i++) {
          const btn = page.locator(sel).nth(i);
          const isVisible = await btn.isVisible().catch(() => false);
          const isEnabled = await btn.isEnabled().catch(() => true);
          const text = String((await btn.textContent().catch(() => "")) || "")
            .replace(/\s+/g, " ")
            .trim();

          // Skip hidden pre-render stubs and empty wrappers.
          if (!text) continue;
          if (!isVisible && !/out of stock|sold out|notify me/i.test(text))
            continue;

          let state = "available";
          if (!isVisible) state = "hidden";
          else if (!isEnabled) state = "disabled";
          if (/out of stock|unavailable|sold out|notify me/i.test(text)) {
            state = "out_of_stock";
          }

          const key =
            (AJIO_CTA_PATTERNS.find(([re]) => re.test(text)) || [])[1] || null;

          return { ctaLabel: text, ctaState: key || state };
        }
      } catch {}
    }

    return { ctaLabel: null, ctaState: null };
  }

  /**
   * Scrape a single Ajio product.
   * @param {string} productId - Ajio product ID (from URL /p/<id>)
   * @param {object} [opts] - { full } extra options.
   * @returns {Promise<object>} normalized extracted data.
   * @throws {Error} after retries exhausted.
   */
  async scrapeProduct(productId, opts = {}) {
    if (!productId) {
      throw new Error(`Invalid productId: ${productId}`);
    }

    // Circuit breaker
    const failureEntry = this.productFailureMap.get(productId);
    if (
      failureEntry &&
      failureEntry.failures >= this.maxProductFailuresBeforeSkip
    ) {
      const timeSinceLastFailure = Date.now() - failureEntry.lastFailure;
      if (timeSinceLastFailure < this.productFailureTimeout) {
        throw new Error(
          `Product ${productId} skipped due to circuit breaker (${failureEntry.failures} recent failures)`,
        );
      }
      this.productFailureMap.delete(productId);
    }

    const url = `https://www.ajio.com/p/${productId}`;
    let attempt = 0;
    let lastError;

    while (attempt <= this.maxRetries) {
      if (attempt > 0) {
        const backoff = this._improvedBackoff(attempt);
        await new Promise((r) => setTimeout(r, backoff));
      }
      attempt++;

      await this.acquire();
      let page = null;
      try {
        const context = await this.getContext();
        page = await context.newPage();
        page.setDefaultTimeout(this.navigationTimeout);

        await this._navigateToProduct(page, url);

        const extracted = opts.full
          ? await this._extractFullFromPage(page, productId)
          : await this._extractFromPage(page, productId);

        if (!extracted.title) {
          // Save HTML for debugging
          try {
            const html = await page.content();
            const debugDir = path.join(__dirname, "../../debug");
            if (!fs.existsSync(debugDir))
              fs.mkdirSync(debugDir, { recursive: true });
            const debugFile = path.join(
              debugDir,
              `ajio-${productId}-${Date.now()}.html`,
            );
            fs.writeFileSync(debugFile, html);
            logger.warn(
              `[AjioScraper] Title not found for ${productId}. HTML saved to ${debugFile}`,
            );
          } catch (e) {}
          throw new Error("TITLE_NOT_FOUND");
        }

        extracted.productId = productId.toUpperCase();
        extracted.scrapedAt = new Date().toISOString();
        extracted.marketplace = "ajio";

        this.trackAsinSuccess(productId);
        this.successCount++;
        this.consecutiveFailures = 0;

        return extracted;
      } catch (err) {
        lastError = err;
        this.trackAsinFailure(productId);

        if (/CAPTCHA_CHALLENGE/i.test(err.message)) {
          throw err;
        }
      } finally {
        if (page) await page.close().catch(() => {});
        this.release();
      }
    }

    throw lastError || new Error(`Failed to scrape ${productId}`);
  }

  /**
   * Basic extraction: brand, title, MRP, ASP (discounted price), discount %, add to cart status, sizes, colors.
   * First tries to extract from JSON-LD schema, then falls back to DOM selectors.
   */
  async _extractFromPage(page, productId) {
    // First try to extract from JSON-LD schema (most reliable for Ajio)
    const schemaData = await this._extractFromSchema(page);

    // Also extract from __PRELOADED_STATE__ for rating, reviews, colors, etc.
    const preloadData = await this._extractFromPreloadedState(page, productId);

    if (schemaData && (schemaData.title || schemaData.brand)) {
      let merged = {
        ...(preloadData || {}),
        ...(schemaData || {}),
      }; // schema takes precedence (last wins)

      // If preload has valid data that schema doesn't have, use it
      if (preloadData) {
        if (!merged.rating && preloadData.rating)
          merged.rating = preloadData.rating;
        if (!merged.reviewCount && preloadData.reviewCount)
          merged.reviewCount = preloadData.reviewCount;
        if (!merged.colors && preloadData.colors)
          merged.colors = preloadData.colors;
        if (!merged.sizes && preloadData.sizes)
          merged.sizes = preloadData.sizes;
        if (
          merged.addToCartStatus === "unknown" &&
          preloadData.addToCartStatus !== "unknown"
        )
          merged.addToCartStatus = preloadData.addToCartStatus;
        if (!merged.ctaLabel && preloadData.ctaLabel)
          merged.ctaLabel = preloadData.ctaLabel;
        if (!merged.ctaState && preloadData.ctaState)
          merged.ctaState = preloadData.ctaState;
        if (!merged.description && preloadData.description)
          merged.description = preloadData.description;
        if (!merged.category && preloadData.category)
          merged.category = preloadData.category;
        // Prefer preloaded price for the default/selected size over schema's first offer
        if (preloadData.currentPrice)
          merged.currentPrice = preloadData.currentPrice;
        if (preloadData.mrp) merged.mrp = preloadData.mrp;
        if (preloadData.discountPercentage > 0)
          merged.discountPercentage = preloadData.discountPercentage;
        // Preload exposes the full image gallery (schema/JSON-LD only has the main image)
        if (
          Array.isArray(preloadData.images) &&
          preloadData.images.length >
            (Array.isArray(merged.images) ? merged.images.length : 0)
        )
          merged.images = preloadData.images;
      }

      // Only run the (expensive) full DOM scan when core fields are still missing.
      let domData = null;
      const coreMissing =
        !merged.title ||
        !merged.brand ||
        !(merged.mrp > 0) ||
        !(merged.currentPrice > 0) ||
        merged.addToCartStatus === "unknown";
      if (coreMissing) {
        domData = await this._extractFromDOM(page);
        if (domData) {
          for (const k of Object.keys(domData)) {
            if (
              merged[k] == null ||
              merged[k] === "" ||
              merged[k] === 0 ||
              merged[k] === "unknown"
            ) {
              merged[k] = domData[k];
            }
          }
        }
      }

      // The AVAILABILITY column shows the buy button's text, so probe for it
      // even when the full DOM scan above was skipped.
      if (!merged.ctaLabel) {
        const cta = await this._extractCtaLabel(page);
        if (cta.ctaLabel) {
          merged.ctaLabel = cta.ctaLabel;
          merged.ctaState = cta.ctaState;
          // ctaState is a CTA key ("outOfStock", "soldOut", ...). An explicit
          // out-of-stock button outranks a stale "available" from stock data;
          // a disabled/hidden buy button means it is not purchasable.
          if (
            cta.ctaState &&
            AJIO_CTA_OOS.has(cta.ctaState)
          ) {
            merged.addToCartStatus = "out_of_stock";
          } else if (
            cta.ctaState === "disabled" ||
            cta.ctaState === "hidden"
          ) {
            merged.addToCartStatus = "out_of_stock";
          } else if (
            merged.addToCartStatus === "unknown" &&
            (cta.ctaState === "addToBag" || cta.ctaState === "addToCart")
          ) {
            merged.addToCartStatus = "available";
          }
        }
      }

      // The JSON-LD image array usually only carries the main image; grab the
      // gallery thumbnails from the DOM for an accurate image count.
      if (!Array.isArray(merged.images) || merged.images.length < 3) {
        const gallery = await this._extractGalleryImages(page);
        if (gallery.length > 0) {
          merged.images = gallery;
          merged.imagesCount = gallery.length;
        }
      }

      // Debug: log what each source provides
      AJIO_SCRAPER_DEBUG && console.log(
        "[DEBUG] Schema data:",
        JSON.stringify(
          {
            title: schemaData.title,
            brand: schemaData.brand,
            mrp: schemaData.mrp,
            price: schemaData.currentPrice,
            rating: schemaData.rating,
            reviewCount: schemaData.reviewCount,
            addToCartStatus: schemaData.addToCartStatus,
            sizes: schemaData.sizes,
            colors: schemaData.colors,
          },
          null,
          2,
        ),
      );
      AJIO_SCRAPER_DEBUG && console.log(
        "[DEBUG] Preload data:",
        JSON.stringify(
          {
            title: preloadData?.title,
            brand: preloadData?.brand,
            mrp: preloadData?.mrp,
            price: preloadData?.currentPrice,
            rating: preloadData?.rating,
            reviewCount: preloadData?.reviewCount,
            addToCartStatus: preloadData?.addToCartStatus,
            sizes: preloadData?.sizes,
            colors: preloadData?.colors,
          },
          null,
          2,
        ),
      );
      AJIO_SCRAPER_DEBUG && console.log(
        "[DEBUG] DOM data:",
        JSON.stringify(
          {
            title: domData?.title,
            brand: domData?.brand,
            mrp: domData?.mrp,
            price: domData?.currentPrice,
            rating: domData?.rating,
            reviewCount: domData?.reviewCount,
            addToCartStatus: domData?.addToCartStatus,
            sizes: domData?.sizes,
            colors: domData?.colors,
          },
          null,
          2,
        ),
      );
      AJIO_SCRAPER_DEBUG && console.log(
        "[DEBUG] Merged:",
        JSON.stringify(
          {
            title: merged.title,
            brand: merged.brand,
            mrp: merged.mrp,
            price: merged.currentPrice,
            rating: merged.rating,
            reviewCount: merged.reviewCount,
            addToCartStatus: merged.addToCartStatus,
            sizes: merged.sizes,
            colors: merged.colors,
          },
          null,
          2,
        ),
      );

      return merged;
    }

    // Fallback to DOM-only extraction when schema is empty/invalid
    const domData = await this._extractFromDOM(page);
    if (!domData) return null;
    const merged = { ...(preloadData || {}), ...domData };
    if (
      Array.isArray(preloadData?.images) &&
      preloadData.images.length >
        (Array.isArray(domData.images) ? domData.images.length : 0)
    ) {
      merged.images = preloadData.images;
    }
    if (!Array.isArray(merged.images) || merged.images.length < 3) {
      const gallery = await this._extractGalleryImages(page);
      if (gallery.length > 0) {
        merged.images = gallery;
        merged.imagesCount = gallery.length;
      }
    }
    return merged;
  }

  /**
   * Cheap gallery-image scan used in the basic extraction path. Ajio's JSON-LD
   * image array usually contains only the main image, so the real count must
   * come from the DOM thumbnails. Returns full http(s) image URLs.
   */
  async _extractGalleryImages(page) {
    let images = [];
    try {
      const imgSelectors = [
        '[data-testid="product-image"] img, .product-image img, .prod-img img',
        ".image-gallery img, .main-image img, .product-gallery img",
        'img[itemprop="image"]',
        ".gallery img, .thumbnails img",
      ];
      for (const sel of imgSelectors) {
        const imgEls = page.locator(sel);
        const imgCount = await imgEls.count().catch(() => 0);
        for (let i = 0; i < imgCount; i++) {
          const src = await imgEls
            .nth(i)
            .getAttribute("src", { timeout: 3000 })
            .catch(() => "");
          if (src && src.startsWith("http") && !images.includes(src))
            images.push(src);
        }
        if (images.length > 0) break;
      }
    } catch {}
    return images;
  }

  /**
   * Extract product data from JSON-LD schema.org markup.
   * Ajio embeds rich Product/ProductGroup schema in <script type="application/ld+json"> tags.
   */
  async _extractFromSchema(page) {
    try {
      const scripts = await page
        .locator('script[type="application/ld+json"]')
        .all();
      for (const script of scripts) {
        const content = await script.textContent().catch(() => "");
        if (!content) continue;

        let data;
        try {
          data = JSON.parse(content);
        } catch {
          continue;
        }

        // Handle array of schemas
        const schemas = Array.isArray(data) ? data : [data];

        for (const schema of schemas) {
          const type = schema["@type"] || schema.type;
          if (!type) continue;

          // ProductGroup (main product with variants)
          if (type === "ProductGroup" || type === "Product") {
            const name = schema.name || schema.title;
            const brand = schema.brand?.name || schema.brand;

            // Get price from offers
            let price = 0,
              mrp = 0;
            const offers = schema.offers || schema.offer;
            if (offers) {
              const offerArray = Array.isArray(offers) ? offers : [offers];
              for (const offer of offerArray) {
                const priceVal = this._parsePrice(
                  offer.price || offer.lowPrice || offer.highPrice,
                );
                if (priceVal > 0 && price === 0) price = priceVal;
                const mrpVal = this._parsePrice(
                  offer.highPrice || offer.priceSpecification?.maxPrice,
                );
                if (mrpVal > 0 && mrp === 0) mrp = mrpVal;
              }
            }

            // Also check variant offers for MRP (highPrice) - Ajio puts MRP in variant offers
            const hasVariant =
              schema.hasVariant || schema.variants || schema.productVariants;
            if (hasVariant) {
              const variants = Array.isArray(hasVariant)
                ? hasVariant
                : [hasVariant];
              for (const variant of variants) {
                const variantOffers = variant.offers || variant.offer;
                if (variantOffers) {
                  const variantOfferArray = Array.isArray(variantOffers)
                    ? variantOffers
                    : [variantOffers];
                  for (const vOffer of variantOfferArray) {
                    const mrpVal = this._parsePrice(
                      vOffer.highPrice || vOffer.priceSpecification?.maxPrice,
                    );
                    if (mrpVal > 0 && mrp === 0) mrp = mrpVal;
                    // Also get price from variant if not set
                    const priceVal = this._parsePrice(
                      vOffer.price || vOffer.lowPrice,
                    );
                    if (priceVal > 0 && price === 0) price = priceVal;
                  }
                }
              }
            }

            // Extract variants for sizes/colors
            let sizes = [],
              colors = [];
            const variesBy = schema.variesBy || [];
            if (hasVariant) {
              const variants = Array.isArray(hasVariant)
                ? hasVariant
                : [hasVariant];
              for (const variant of variants) {
                if (variesBy.includes("size") && variant.size)
                  sizes.push(variant.size);
                if (variesBy.includes("color") && variant.color)
                  colors.push(variant.color);
              }
            }

            // Images
            let images = [];
            const imageData = schema.image;
            if (imageData) {
              const imgArray = Array.isArray(imageData)
                ? imageData
                : [imageData];
              for (const img of imgArray) {
                const url =
                  typeof img === "string" ? img : img.url || img.contentUrl;
                if (url) images.push(url);
              }
            }

            // Rating & reviews from aggregateRating
            let rating = null,
              reviewCount = null;
            const aggRating = schema.aggregateRating;
            if (aggRating) {
              rating = this._parsePrice(
                aggRating.ratingValue || aggRating.rating,
              );
              reviewCount = aggRating.reviewCount
                ? parseInt(aggRating.reviewCount, 10)
                : null;
            }

    // Availability
    const schemaAvailability =
      schema.offers?.availability || schema.availability || null;
    // The previous check was /InStock|InStock/ (a duplicated branch, and case
    // sensitive), so lowercase "instock" and "In Stock" never matched.
    const addToCartStatus = resolveAjioStockSignal(schemaAvailability);


            // Description
            let description = "";
            if (schema.description) {
              description = schema.description;
            }

            // Category from category or breadcrumb
            let category = "";
            if (schema.category) {
              category = Array.isArray(schema.category)
                ? schema.category.join(" > ")
                : schema.category;
            }

            if (schema.name || schema.brand || schema.sku) {
              return {
                brand: schema.brand?.name || schema.brand || "",
                title: schema.name || "",
                mrp: mrp || 0,
                currentPrice: price || 0,
                discountPercentage:
                  mrp > 0 && price > 0
                    ? Math.round(((mrp - price) / mrp) * 100)
                    : 0,
                rating: rating || null,
                reviewCount: reviewCount || null,
                addToCartStatus: addToCartStatus,
                sizes: sizes.length > 0 ? sizes : null,
                colors: colors.length > 0 ? colors : null,
                images: images.length > 0 ? images : null,
                description: description || "",
                category: category || "",
                marketplace: "ajio",
              };
            }
          }
        }
      }
    } catch (e) {
      logger.debug("[AjioScraper] Schema extraction failed:", e.message);
    }
    return null;
  }

  /**
   * Extract product data from window.__PRELOADED_STATE__ (Ajio's global state).
   * This contains all product data including rating, reviews, colors, etc.
   */
  async _extractFromPreloadedState(page, productId) {
    try {
      // COST NOTE: window.__PRELOADED_STATE__ is huge (every variant carries
      // full-res image/style payloads). Slicing the parts we need INSIDE the
      // browser keeps the CDP serialization cheap (seconds -> milliseconds).
      const state = await page.evaluate((pid) => {
        const s = window.__PRELOADED_STATE__;
        if (!s || !s.product) return null;
        const product = s.product;
const pd = product.productDetails || product;

        // Ajio's preloaded state exposes ALL product images (imageType +
        // format variants) in pd.images. Group by galleryIndex and keep the
        // highest-resolution URL per unique image.
        let imagesUrls = [];
        try {
          if (Array.isArray(pd.images)) {
            const byIndex = new Map();
            for (const im of pd.images) {
              const gi = im.galleryIndex != null ? im.galleryIndex : 0;
              if (!byIndex.has(gi)) byIndex.set(gi, []);
              byIndex.get(gi).push(im);
            }
            for (const group of byIndex.values()) {
              let best = group[0];
              const res = (m) => {
                const mm = /(\d{2,4})[xX](\d{2,4})/.exec(m || "");
                return mm ? parseInt(mm[1], 10) * parseInt(mm[2], 10) : 0;
              };
              for (const g of group) {
                if (res(g.url) > res(best.url)) best = g;
              }
              if (best && best.url) imagesUrls.push(best.url);
            }
          }
        } catch {}

        const slimNamed = (items) =>
          (Array.isArray(items) ? items : []).map((c) => ({
            colorName: c.colorName,
            color: c.color,
            name: c.name,
            value: c.value,
            size: c.size,
            sizeName: c.sizeName,
          }));

        const slimVariant = (v) => ({
          code: v.code,
          size: v.size,
          sizeName: v.sizeName,
          variantOptionQualifiers: Array.isArray(v.variantOptionQualifiers)
            ? v.variantOptionQualifiers.slice(0, 8)
            : undefined,
          stock: v.stock,
          priceData: v.priceData
            ? {
                value: v.priceData.value,
                wasPrice: v.priceData.wasPrice,
                discountPercent: v.priceData.discountPercent,
              }
            : undefined,
          price: v.price,
          sellingPrice: v.sellingPrice,
          wasPriceData: v.wasPriceData,
          mrp: v.mrp,
        });

        const rr = pd.ratingsResponse;
        const slimRatings = rr
          ? {
              rating: rr.rating,
              averageRating: rr.averageRating,
              average: rr.average,
              value: rr.value,
              total: rr.total,
              totalReviews: rr.totalReviews,
              count: rr.count,
              ratingData: rr.ratingData
                ? { average: rr.ratingData.average }
                : undefined,
              data: rr.data ? { average: rr.data.average } : undefined,
              aggregateRating: rr.aggregateRating
                ? {
                    averageRating: rr.aggregateRating.averageRating,
                    numUserRatings: rr.aggregateRating.numUserRatings,
                  }
                : undefined,
            }
          : undefined;

        return {
          product: {
            selectedSizeStockLevel: product.selectedSizeStockLevel,
            productDetails: {
              ratingsResponse: slimRatings,
              numberOfReviews: pd.numberOfReviews,
              fnlColorVariantData: slimNamed(pd.fnlColorVariantData),
              verticalColor: slimNamed(pd.verticalColor),
              variants: slimNamed(pd.variants),
              variantOptions: Array.isArray(pd.variantOptions)
                ? pd.variantOptions.map(slimVariant)
                : undefined,
              stock: pd.stock,
              availability: pd.availability,
              addToCartStatus: pd.addToCartStatus,
              priceData: pd.priceData
                ? {
                    value: pd.priceData.value,
                    wasPrice: pd.priceData.wasPrice,
                    discountPercent: pd.priceData.discountPercent,
                  }
                : undefined,
              price: pd.price,
              sellingPrice: pd.sellingPrice,
              wasPriceData: pd.wasPriceData,
              mrp: pd.mrp,
              description: pd.description,
              summary: pd.summary,
              categories: pd.categories,
              categoryPath: pd.categoryPath,
              brickCategory: pd.brickCategory,
              brandName: pd.brandName,
              brand: pd.brand,
              name: pd.name,
              title: pd.title,
              imagesUrls: imagesUrls.length ? imagesUrls : undefined,
            },
          },
        };
      }, productId);
      AJIO_SCRAPER_DEBUG && console.log(
        "[DEBUG] __PRELOADED_STATE__ keys:",
        state ? Object.keys(state) : "null",
      );
      if (!state) return null;

      // Navigate to product data in preloaded state
      // Structure: state.product
      const product = state.product;
      if (!product) {
        AJIO_SCRAPER_DEBUG && console.log(
          "[DEBUG] Preloaded state product not found. State keys:",
          Object.keys(state),
        );
        return null;
      }

      AJIO_SCRAPER_DEBUG && console.log("[DEBUG] Preloaded product keys:", Object.keys(product));
      // state.product is a container; the actual product lives in productDetails
      const pd = product.productDetails || product;
      AJIO_SCRAPER_DEBUG && console.log(
        "[DEBUG] productDetails keys:",
        product.productDetails ? Object.keys(product.productDetails) : "n/a",
      );

      // Extract rating from ratingsResponse
      let rating = null;
      AJIO_SCRAPER_DEBUG && console.log(
        "[DEBUG] ratingsResponse:",
        JSON.stringify(pd.ratingsResponse, null, 2),
      );
      if (pd.ratingsResponse) {
        const rr = pd.ratingsResponse;
        // Try multiple possible paths for rating
        if (rr.rating) rating = parseFloat(rr.rating);
        else if (rr.averageRating) rating = parseFloat(rr.averageRating);
        else if (rr.average) rating = parseFloat(rr.average);
        else if (rr.value) rating = parseFloat(rr.value);
        // Check nested structures
        else if (rr.ratingData?.average)
          rating = parseFloat(rr.ratingData.average);
        else if (rr.data?.average) rating = parseFloat(rr.data.average);
        else if (rr.aggregateRating?.averageRating)
          rating = parseFloat(rr.aggregateRating.averageRating);
      }

      // Extract review count from numberOfReviews or ratingsResponse
      let reviewCount = null;
      AJIO_SCRAPER_DEBUG && console.log("[DEBUG] numberOfReviews:", pd.numberOfReviews);
      if (pd.numberOfReviews) {
        reviewCount = parseInt(pd.numberOfReviews, 10);
      } else if (pd.ratingsResponse?.totalReviews) {
        reviewCount = parseInt(pd.ratingsResponse.totalReviews, 10);
      } else if (pd.ratingsResponse?.total) {
        reviewCount = parseInt(pd.ratingsResponse.total, 10);
      } else if (pd.ratingsResponse?.count) {
        reviewCount = parseInt(pd.ratingsResponse.count, 10);
      } else if (pd.ratingsResponse?.aggregateRating?.numUserRatings) {
        reviewCount = parseInt(
          pd.ratingsResponse.aggregateRating.numUserRatings,
          10,
        );
      } else if (pd.textReview?.totalReviews) {
        reviewCount = parseInt(pd.textReview.totalReviews, 10);
      } else if (pd.imageReview?.totalReviews) {
        reviewCount = parseInt(pd.imageReview.totalReviews, 10);
      }

      // Extract colors from fnlColorVariantData
      let colors = [];
      AJIO_SCRAPER_DEBUG && console.log(
        "[DEBUG] fnlColorVariantData:",
        JSON.stringify(pd.fnlColorVariantData, null, 2),
      );
      if (pd.fnlColorVariantData && Array.isArray(pd.fnlColorVariantData)) {
        for (const cv of pd.fnlColorVariantData) {
          // Check multiple possible fields for color name
          const colorName = cv.colorName || cv.color || cv.name || cv.value;
          if (colorName && !colors.includes(colorName)) colors.push(colorName);
        }
      }
      if (pd.verticalColor && Array.isArray(pd.verticalColor)) {
        for (const cv of pd.verticalColor) {
          const colorName = cv.colorName || cv.color || cv.name || cv.value;
          if (colorName && !colors.includes(colorName)) colors.push(colorName);
        }
      }
      if (pd.variants && Array.isArray(pd.variants)) {
        for (const variant of pd.variants) {
          const colorName =
            variant.colorName || variant.color || variant.name || variant.value;
          if (colorName && !colors.includes(colorName)) colors.push(colorName);
        }
      }

      // Also check variantOptions for color qualifiers
      if (pd.variantOptions && Array.isArray(pd.variantOptions)) {
        for (const vo of pd.variantOptions) {
          if (
            vo.variantOptionQualifiers &&
            Array.isArray(vo.variantOptionQualifiers)
          ) {
            for (const q of vo.variantOptionQualifiers) {
              if (q.qualifier === "color") {
                const colorName = q.value;
                if (colorName && !colors.includes(colorName))
                  colors.push(colorName);
              }
            }
          }
        }
      }

      // Extract sizes from variantOptions
      let sizes = [];
      AJIO_SCRAPER_DEBUG && console.log(
        "[DEBUG] variantOptions:",
        JSON.stringify(pd.variantOptions, null, 2),
      );
      if (pd.variantOptions && Array.isArray(pd.variantOptions)) {
        for (const vo of pd.variantOptions) {
          // Check qualifiers for size
          if (
            vo.variantOptionQualifiers &&
            Array.isArray(vo.variantOptionQualifiers)
          ) {
            for (const q of vo.variantOptionQualifiers) {
              if (q.qualifier === "size" || q.qualifier === "standardSize") {
                const sizeName = q.value || q.name || vo.size || vo.sizeName;
                if (sizeName && !sizes.includes(sizeName)) sizes.push(sizeName);
              }
            }
          }
          // Fallback to direct fields
          if (vo.size && !sizes.includes(vo.size)) sizes.push(vo.size);
          if (vo.sizeName && !sizes.includes(vo.sizeName))
            sizes.push(vo.sizeName);
        }
      }
      if (
        pd.variantType === "size" &&
        pd.variants &&
        Array.isArray(pd.variants)
      ) {
        for (const v of pd.variants) {
          if (v.size && !sizes.includes(v.size)) sizes.push(v.size);
          if (v.sizeName && !sizes.includes(v.sizeName)) sizes.push(v.sizeName);
        }
      }

      // Rating from ratingsResponse (if not already set)
      if (!rating && pd.ratingsResponse?.averageRating)
        rating = parseFloat(pd.ratingsResponse.averageRating);
      else if (!rating && pd.ratingsResponse?.average)
        rating = parseFloat(pd.ratingsResponse.average);

      // Review count (if not already set)
      if (!reviewCount && pd.numberOfReviews)
        reviewCount = parseInt(pd.numberOfReviews, 10);
      else if (!reviewCount && pd.ratingsResponse?.totalReviews)
        reviewCount = parseInt(pd.ratingsResponse.totalReviews, 10);

      // Availability. Every signal is collected first and then resolved in
      // one place (resolveAjioAvailability) so precedence is explicit and the
      // same rules apply as in the DOM extractor.
      const preloadedCtaLabel =
        pd.ctaLabel || pd.addToBagLabel || pd.buttonLabel || pd.cta || null;
      const availabilityResolved = resolveAjioAvailability({
        variantOptions: pd.variantOptions,
        stock: pd.stock,
        productAvailability: pd.availability,
        containerStockLevel: product.selectedSizeStockLevel,
        ctaLabel: preloadedCtaLabel,
        ctaState: pd.addToCartStatus,
        declaredStatus: pd.addToCartStatus,
      });
      const addToCartStatus = availabilityResolved.status;
      const ctaLabel = availabilityResolved.label;
      const ctaState = availabilityResolved.ctaKey;

      // Price data — pick the variant matching this product ID (default size),
      // since Ajio prices vary per size. Fall back to the first in-stock variant.
      let currentPrice = 0;
      let mrp = 0;
      const priceVariants = Array.isArray(pd.variantOptions)
        ? pd.variantOptions
        : [];
      let priceVariant = null;
      if (productId) {
        priceVariant =
          priceVariants.find(
            (v) =>
              String(v.code || "").toUpperCase() ===
              String(productId).toUpperCase(),
          ) || null;
      }
      if (!priceVariant) {
        priceVariant =
          priceVariants.find(
            (v) => v.stock && parseInt(v.stock.stockLevel, 10) > 0,
          ) || priceVariants[0] || null;
      }
      if (priceVariant) {
        currentPrice = this._parsePrice(
          priceVariant.priceData?.value ||
            priceVariant.price ||
            priceVariant.sellingPrice,
        );
        mrp = this._parsePrice(
          priceVariant.wasPriceData?.value ||
            priceVariant.mrp ||
            priceVariant.priceData?.wasPrice,
        );
      } else {
        currentPrice = this._parsePrice(
          pd.priceData?.value || pd.price || pd.sellingPrice,
        );
        mrp = this._parsePrice(pd.wasPriceData?.value || pd.mrp);
      }
      let discountPercentage = 0;
      if (mrp > 0 && currentPrice > 0) {
        discountPercentage = Math.round(((mrp - currentPrice) / mrp) * 100);
      }
      if (!discountPercentage && priceVariant?.priceData?.discountPercent) {
        discountPercentage = this._parsePrice(
          priceVariant.priceData.discountPercent,
        );
      }

      AJIO_SCRAPER_DEBUG && console.log("[DEBUG] Preloaded extracted:", {
        rating,
        reviewCount,
        colors,
        sizes,
        addToCartStatus,
        ctaLabel,
        ctaState,
        brand: pd.brandName,
        title: pd.name,
      });

      return {
        rating,
        reviewCount,
        colors: colors.length > 0 ? colors : null,
        sizes: sizes.length > 0 ? sizes : null,
        addToCartStatus,
        ctaLabel,
        ctaState,
        currentPrice,
        mrp,
        discountPercentage,
        images: Array.isArray(pd.imagesUrls) ? pd.imagesUrls : null,
        description: pd.description || pd.summary || "",
        category:
          pd.categories?.join(" > ") ||
          pd.categoryPath ||
          pd.brickCategory ||
          "",
        brand: pd.brandName || pd.brand || "",
        title: pd.name || pd.title || "",
      };
    } catch (e) {
      AJIO_SCRAPER_DEBUG && console.log(
        "[DEBUG] Preloaded state extraction failed:",
        e.message,
        e.stack,
      );
    }
    return null;
  }

  /**
   * Extract product data from DOM selectors (fallback when schema not available).
   */
  async _extractFromDOM(page) {
    const textContent = async (selector) => {
      const count = await page
        .locator(selector)
        .count()
        .catch(() => 0);
      if (!count) return "";
      const value = await page
        .locator(selector)
        .first()
        .evaluate((node) => node.textContent || "", null, { timeout: 5000 })
        .catch(() => "");
      return String(value).trim();
    };

    const getAttribute = async (selector, attr) => {
      const count = await page
        .locator(selector)
        .count()
        .catch(() => 0);
      if (!count) return "";
      const value = await page
        .locator(selector)
        .first()
        .getAttribute(attr, { timeout: 5000 })
        .catch(() => "");
      return String(value || "").trim();
    };

    // 1. Brand name
    let brand = "";
    const brandSelectors = [
      '[data-testid="brand-name"], .brand-name, .prod-brand, .brand',
      ".product-brand, .product-brand-name",
      'a[href*="/brand/"], [data-testid="brand-link"]',
    ];
    for (const sel of brandSelectors) {
      const t = await textContent(sel);
      if (t && t.length > 1) {
        brand = t;
        break;
      }
    }

    // 2. Title
    let title = "";
    const titleSelectors = [
      '[data-testid="product-title"], .prod-name, .product-title, h1.title',
      "h1.prod-name, .product-name, .name",
    ];
    for (const sel of titleSelectors) {
      const t = await textContent(sel);
      if (t && t.length > 3) {
        title = t;
        break;
      }
    }

    // 3. MRP (Original/Striked price)
    let mrp = 0;
    const mrpSelectors = [
      '[data-testid="product-mrp"], .prod-op, .original-price, .strike-price, .was-price',
      ".price-was, .old-price, .mrp-price, .list-price",
      ".price .strike, .price .original, .strike-through",
    ];
    for (const sel of mrpSelectors) {
      mrp = this._parsePrice(await textContent(sel));
      if (mrp > 0) break;
    }

    // 4. ASP / Discounted Price (Current selling price)
    let currentPrice = 0;
    const priceSelectors = [
      '[data-testid="product-price"] .price, .prod-sp .price, .price .prod-sp, .current-price .price',
      ".price-value, .prod-price .price, .selling-price, .discounted-price",
      '[data-testid="product-price"], .price strong, .prod-sp strong, .price',
    ];
    for (const sel of priceSelectors) {
      currentPrice = this._parsePrice(await textContent(sel));
      if (currentPrice > 0) break;
    }

    // If MRP not found but current price exists, MRP might be the same or we look for striked price
    if (mrp === 0 && currentPrice > 0) {
      // Try to find striked price near current price
      const strikeSelectors = [
        ".dp-shm-pdp-price .strike, .dp-shm-pdp-price .strike-through, .dp-shm-pdp-price .was-price",
        ".strike-price, .strike-through, .was-price, .old-price, .list-price",
        '.price-was, .original-price, .strike, [class*="strike"]',
      ];
      for (const sel of strikeSelectors) {
        const strikePrice = this._parsePrice(await textContent(sel));
        if (strikePrice > currentPrice) {
          mrp = strikePrice;
          break;
        }
      }
      // If still no MRP, default to current price
      if (mrp === 0) mrp = currentPrice;
    }

    // 5. Discount Percentage
    let discountPercentage = 0;
    const discountSelectors = [
      '[data-testid="discount"], .discount-percent, .discount-pct, .discount-badge',
      ".discount, .off-percent, .percentage-off, .save-percent",
      ".discount-tag, .offer-tag, .sale-tag",
    ];
    for (const sel of discountSelectors) {
      const discountText = await textContent(sel);
      const match = discountText.match(/(\d+)\s*%/);
      if (match) {
        discountPercentage = parseInt(match[1], 10);
        break;
      }
    }
    // Calculate if not found explicitly
    if (discountPercentage === 0 && mrp > currentPrice && currentPrice > 0) {
      discountPercentage = Math.round(((mrp - currentPrice) / mrp) * 100);
    }

    // 5b. Review Rating & Review Count
    let rating = null;
    const ratingSelectors = [
      '[data-testid="rating"], .rating-score, .avg-rating, .rating-value',
      ".star-rating .value, .rating .score, .rating-number",
      '[data-testid="product-rating"], .product-rating, .average-rating',
      ".stars .score, .rating-stars .value",
    ];
    for (const sel of ratingSelectors) {
      const ratingText = await textContent(sel);
      const match = ratingText.match(/([0-5](?:[.,]\d{1,2})?)/);
      if (match) {
        rating = parseFloat(match[1].replace(",", "."));
        break;
      }
    }
    // Also try to get from star elements (filled stars)
    if (rating === null) {
      try {
        const filledStars = page.locator(
          '.star.filled, .star.active, .star.filled-star, [class*="star"][class*="filled"], .rating-star.filled',
        );
        const filledCount = await filledStars.count().catch(() => 0);
        if (filledCount > 0) rating = filledCount;
        else {
          // Try to find rating from aria-label or data attributes
          const ratingEl = page
            .locator(
              '[aria-label*="rating" i], [data-rating], [data-star-rating]',
            )
            .first();
          const ariaLabel = await ratingEl
            .getAttribute("aria-label", { timeout: 3000 })
            .catch(() => "");
          const dataRating = await ratingEl
            .getAttribute("data-rating", { timeout: 3000 })
            .catch(() => "");
          const dataStar = await ratingEl
            .getAttribute("data-star-rating", { timeout: 3000 })
            .catch(() => "");
          const val = ariaLabel || dataRating || dataStar;
          const match = val.match(/([0-5](?:[.,]\d{1,2})?)/);
          if (match) rating = parseFloat(match[1].replace(",", "."));
        }
      } catch {}
    }

    // Review count
    let reviewCount = null;
    const reviewSelectors = [
      '[data-testid="review-count"], .review-count, .ratings-count, .review-count-value',
      ".rating-count, .reviews-count, .total-reviews",
      '[data-testid="review-total"], .review-total, .total-reviews-count',
    ];
    for (const sel of reviewSelectors) {
      const reviewText = await textContent(sel);
      const match = reviewText.match(/([\d,]+)/);
      if (match) {
        reviewCount = parseInt(match[1].replace(/,/g, ""), 10) || null;
        break;
      }
    }
    // Also try to extract from text like "4.5 (123 reviews)" or "123 ratings"
    if (reviewCount === null) {
      try {
        const bodyText = await page
          .locator("body")
          .textContent()
          .catch(() => "");
        const reviewMatch =
          bodyText.match(/\(([\d,]+)\s*(?:reviews?|ratings?)\)/i) ||
          bodyText.match(/([\d,]+)\s*(?:reviews?|ratings?)/i);
        if (reviewMatch)
          reviewCount = parseInt(reviewMatch[1].replace(/,/g, ""), 10) || null;
      } catch {}
    }

    // 6. Add to Bag / Add to Cart button status
    // Ajio's primary CTA reads "ADD TO BAG"; the old selector list only
    // matched "Add to Cart", so most products resolved to "unknown".
    //
    // addToCartStatus holds the stock verdict ("available" / "out_of_stock" /
    // "unknown"); ctaState holds the CTA key ("addToBag", "soldOut", ...), which
    // is what toAjioAvailabilityFields needs to tell a real buy button apart
    // from an out-of-stock button.
    let addToCartStatus = "unknown";
    let ctaLabel = null;
    let ctaState = null;
    let bestRank = 0;
    const cartSelectors = [
      '[data-testid="add-to-bag"], [data-testid="add-to-cart"]',
      '[data-testid="buy-now"], .buy-now, .buy-button, .cta-button',
      ".add-to-bag, .add-to-cart, .addtocart",
      'button:has-text("ADD TO BAG"), button:has-text("Add to Bag")',
      'button:has-text("ADD TO CART"), button:has-text("Add to Cart"), button:has-text("Add to cart")',
      'button:has-text("OUT OF STOCK"), button:has-text("Sold Out"), button:has-text("NOTIFY ME")',
    ];
    for (const sel of cartSelectors) {
      try {
        const count = await page.locator(sel).count().catch(() => 0);
        if (count === 0) continue;

        for (let i = 0; i < Math.min(count, 3); i++) {
          const btn = page.locator(sel).nth(i);
          const isVisible = await btn.isVisible().catch(() => false);
          const isEnabled = await btn.isEnabled().catch(() => true);
          const text = String(
            (await btn.textContent().catch(() => "")) || "",
          )
            .replace(/\s+/g, " ")
            .trim();

          // A hidden element with no text is usually a generic wrapper or a
          // pre-render stub — never let it win over a real button.
          if (!isVisible && !text) continue;

          const isOos = /out of stock|unavailable|sold out|notify me/i.test(
            text,
          );
          const key =
            (AJIO_CTA_PATTERNS.find(([re]) => re.test(text)) || [])[1] || null;

          // Rank candidates: a usable button beats a disabled one, which beats
          // an explicit out-of-stock label, which beats a hidden leftover.
          const rank = isOos ? 2 : isVisible && isEnabled ? 4 : isVisible ? 3 : 1;
          if (rank <= bestRank) continue;
          bestRank = rank;

          ctaLabel = text || ctaLabel;
          ctaState = key;
          if (isOos) addToCartStatus = "out_of_stock";
          else if (isVisible && isEnabled) addToCartStatus = "available";
          else addToCartStatus = "disabled";

          // A visible, labelled button is decisive — stop looking.
          if (rank === 4) break;
        }
        if (bestRank === 4) break;
      } catch {}
    }
    // Fallback: check for out of stock indicators
    if (addToCartStatus === "unknown") {
      const oosSelectors = [
        ".out-of-stock, .out_of_stock, .sold-out, .unavailable",
        '[data-testid="out-of-stock"], .stock-status.out-of-stock',
      ];
      for (const sel of oosSelectors) {
        const count = await page
          .locator(sel)
          .count()
          .catch(() => 0);
        if (count > 0) {
          addToCartStatus = "out_of_stock";
          ctaState = "outOfStock";
          if (!ctaLabel) ctaLabel = "OUT OF STOCK";
          break;
        }
      }
    }

    // 7. Size options
    let sizes = [];
    const sizeSelectors = [
      '[data-testid="size-option"], .size-option, .size-btn, .size-selector button, .size-selector a',
      ".size-selector [data-size], .sizes button, .sizes a, .size-chip",
      '[data-testid="size-selector"] button, [data-testid="size-selector"] a',
      ".size-variant, .variant-size, .product-size button",
    ];
    for (const sel of sizeSelectors) {
      try {
        const btns = page.locator(sel);
        const count = await btns.count().catch(() => 0);
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const txt = await btns
              .nth(i)
              .evaluate(
                (n) =>
                  n.textContent ||
                  n.getAttribute("data-size") ||
                  n.getAttribute("data-value") ||
                  "",
                { timeout: 3000 },
              )
              .catch(() => "");
            if (txt && txt.trim()) {
              const cleanSize = txt.trim().replace(/\s+/g, " ");
              if (cleanSize && !sizes.includes(cleanSize))
                sizes.push(cleanSize);
            }
          }
          if (sizes.length > 0) break;
        }
      } catch {}
    }
    // Also check for size dropdown/select
    if (sizes.length === 0) {
      try {
        const select = page
          .locator(
            'select[name*="size" i], select[id*="size" i], [data-testid="size-select"]',
          )
          .first();
        if ((await select.count().catch(() => 0)) > 0) {
          const options = select.locator("option");
          const optCount = await options.count().catch(() => 0);
          for (let i = 0; i < optCount; i++) {
            const txt = await options
              .nth(i)
              .textContent()
              .catch(() => "");
            if (txt && txt.trim() && !/select|choose|size/i.test(txt.trim())) {
              sizes.push(txt.trim());
            }
          }
        }
      } catch {}
    }

    // 8. Color options
    let colors = [];
    const colorSelectors = [
      '[data-testid="color-option"], .color-option, .color-btn, .color-selector button, .color-selector a',
      ".color-selector [data-color], .colors button, .colors a, .color-chip, .color-swatch",
      '[data-testid="color-selector"] button, [data-testid="color-selector"] a',
      ".color-variant, .variant-color, .product-color button",
    ];
    for (const sel of colorSelectors) {
      try {
        const btns = page.locator(sel);
        const count = await btns.count().catch(() => 0);
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            // Try multiple ways to get color name
            let txt = await btns
              .nth(i)
              .getAttribute("title", { timeout: 3000 })
              .catch(() => "");
            if (!txt)
              txt = await btns
                .nth(i)
                .getAttribute("aria-label", { timeout: 3000 })
                .catch(() => "");
            if (!txt)
              txt = await btns
                .nth(i)
                .getAttribute("data-color", { timeout: 3000 })
                .catch(() => "");
            if (!txt)
              txt = await btns
                .nth(i)
                .getAttribute("data-value", { timeout: 3000 })
                .catch(() => "");
            if (!txt)
              txt = await btns
                .nth(i)
                .evaluate((n) => n.textContent || "", { timeout: 3000 })
                .catch(() => "");
            if (txt && txt.trim()) {
              const cleanColor = txt.trim().replace(/\s+/g, " ");
              if (cleanColor && !colors.includes(cleanColor))
                colors.push(cleanColor);
            }
          }
          if (colors.length > 0) break;
        }
      } catch {}
    }
    // Also check for color images with alt text
    if (colors.length === 0) {
      try {
        const colorImgs = page.locator(
          '[data-testid="color-swatch"] img, .color-swatch img, .color-option img, [data-color] img',
        );
        const imgCount = await colorImgs.count().catch(() => 0);
        for (let i = 0; i < imgCount; i++) {
          const alt = await colorImgs
            .nth(i)
            .getAttribute("alt", { timeout: 3000 })
            .catch(() => "");
          const title = await colorImgs
            .nth(i)
            .getAttribute("title", { timeout: 3000 })
            .catch(() => "");
          const txt = alt || title;
          if (txt && txt.trim() && !colors.includes(txt.trim()))
            colors.push(txt.trim());
        }
      } catch {}
    }

    return {
      brand,
      title,
      mrp,
      currentPrice,
      discountPercentage,
      rating,
      reviewCount,
      addToCartStatus,
      ctaLabel,
      ctaState,
      sizes: sizes.length > 0 ? sizes : null,
      colors: colors.length > 0 ? colors : null,
      marketplace: "ajio",
    };
  }

  /**
   * Full extraction for fallback when API unavailable.
   * Includes all basic fields plus additional details like images, description, specs, etc.
   */
  async _extractFullFromPage(page, productId) {
    const basic = await this._extractFromPage(page, productId);

    const count = async (sel) =>
      await page
        .locator(sel)
        .count()
        .catch(() => 0);
    const textContent = async (selector) => {
      if (!(await count(selector))) return "";
      const value = await page
        .locator(selector)
        .first()
        .evaluate((node) => node.textContent || "", null, { timeout: 5000 })
        .catch(() => "");
      return String(value).trim();
    };

    // All images
    let images = [];
    try {
      const imgSelectors = [
        '[data-testid="product-image"] img, .product-image img, .prod-img img',
        ".image-gallery img, .main-image img, .product-gallery img",
        'img[itemprop="image"]',
        ".gallery img, .thumbnails img",
      ];
      for (const sel of imgSelectors) {
        const imgEls = page.locator(sel);
        const imgCount = await imgEls.count().catch(() => 0);
        for (let i = 0; i < imgCount; i++) {
          const src = await imgEls
            .nth(i)
            .getAttribute("src", { timeout: 3000 })
            .catch(() => "");
          if (src && src.startsWith("http") && !images.includes(src))
            images.push(src);
        }
        if (images.length > 0) break;
      }
    } catch {}

    // Description
    let description = "";
    const descSelectors = [
      '[data-testid="description"], .product-description, .description',
      ".prod-desc, .product-details, .details-content",
      '[data-testid="product-description"], .about-product',
    ];
    for (const sel of descSelectors) {
      const t = await textContent(sel);
      if (t && t.length > 20) {
        description = t;
        break;
      }
    }

    // Category breadcrumb (full path)
    let categoryPath = "";
    try {
      const breadcrumbs = page.locator(
        '[data-testid="breadcrumb"] a, .breadcrumb a, .breadcrumbs a, .breadcrumb-item, .breadcrumb li',
      );
      const bcCount = await breadcrumbs.count().catch(() => 0);
      const parts = [];
      for (let i = 0; i < bcCount; i++) {
        const txt = await breadcrumbs
          .nth(i)
          .textContent()
          .catch(() => "");
        if (txt && txt.trim()) parts.push(txt.trim());
      }
      categoryPath = parts.join(" > ");
    } catch {}

    // Seller info if available
    let soldBy = "";
    const sellerSelectors = [
      '[data-testid="seller-name"], .seller-name, .sold-by, .merchant-name',
      '[data-testid="seller"], .seller-info',
    ];
    for (const sel of sellerSelectors) {
      const t = await textContent(sel);
      if (t) {
        soldBy = t;
        break;
      }
    }

    // Specifications / features
    let specifications = null;
    try {
      const specRows = page.locator(
        '[data-testid="specifications"] tr, .specifications tr, .spec-table tr, .product-specs tr',
      );
      const specCount = await specRows.count().catch(() => 0);
      if (specCount > 0) {
        specifications = {};
        for (let i = 0; i < specCount; i++) {
          const cells = specRows.nth(i).locator("td, th");
          const cellCount = await cells.count().catch(() => 0);
          if (cellCount >= 2) {
            const key = await cells
              .nth(0)
              .textContent()
              .catch(() => "");
            const val = await cells
              .nth(1)
              .textContent()
              .catch(() => "");
            if (key && val) specifications[key.trim()] = val.trim();
          }
        }
      }
    } catch {}

    return {
      ...basic,
      description,
      categoryPath,
      soldBy,
      specifications,
      images: images.length > 0 ? images : null,
      imagesCount: images.length,
      marketplace: "ajio",
    };
  }

  _parsePrice(value) {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[^\d.]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

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
      const extendedFactor = Math.min(
        2,
        1 +
          (this.consecutiveFailures - this.maxConsecutiveFailuresBeforeReduce) *
            0.3,
      );
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
    const entry = this.productFailureMap.get(asin) || {
      failures: 0,
      lastFailure: 0,
    };

    entry.failures += 1;
    entry.lastFailure = now;
    this.productFailureMap.set(asin, entry);

    // Check if we should skip this ASIN temporarily
    if (entry.failures >= this.maxProductFailuresBeforeSkip) {
      // Schedule reset after timeout
      setTimeout(() => {
        this.productFailureMap.delete(asin);
      }, this.productFailureTimeout);
    }

    // Update overall failure tracking
    this.failureCount++;
    this.consecutiveFailures = Math.max(
      this.consecutiveFailures,
      entry.failures,
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
    this.productFailureMap.delete(asin);
  }

  /**
   * Batch scrape all products for a given seller.
   * @param {string} sellerId - Seller ID
   * @param {object} [opts] - Options: { maxProducts, delayMs, full }
   * @returns {Promise<{scraped: number, failed: number, errors: string[]}>}
   */
  async scrapeAllSellerProducts(sellerId, opts = {}) {
    if (this._runningSellers.has(sellerId)) {
      logger.warn(
        `[AjioScraper] Batch scrape already running for seller ${sellerId} — skipping redundant run`,
      );
      return { scraped: 0, failed: 0, skipped: true, errors: [] };
    }
    this._runningSellers.add(sellerId);
    try {
      return await this._runSellerBatch(sellerId, opts);
    } finally {
      this._runningSellers.delete(sellerId);
    }
  }

  async _runSellerBatch(sellerId, opts = {}) {
    const { sql, getPool } = require("../database/db");
    const pool = await getPool();

    const maxProducts = opts.maxProducts || 500;
    const delayMs = opts.delayMs == null ? 600 : opts.delayMs;
    const full = opts.full || false;

    const result = await pool.request().input("sellerId", sql.VarChar, sellerId)
      .input("maxProducts", sql.Int, maxProducts)
      .query(`
                SELECT TOP (@maxProducts) Id, AsinCode
                FROM Asins 
                WHERE SellerId = @sellerId 
                AND LOWER(Marketplace) = 'ajio'
                AND Status IN ('Active', 'Error', 'Scraping', 'Pending')
                AND AsinCode LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                ORDER BY 
                    CASE WHEN LastScrapedAt IS NULL THEN 0 ELSE 1 END,
                    LastScrapedAt ASC
            `);

    const products = result.recordset;
    const errors = [];
    let scraped = 0;
    let failed = 0;

    logger.info(
      `[AjioScraper] Starting batch scrape for seller ${sellerId}: ${products.length} products`,
    );

    // Bounded worker pool — the internal semaphore (acquire/release) caps the
    // number of live pages at baseConcurrentPages, so we can safely run more
    // queued workers than that.
    const workersCount = Math.max(
      1,
      parseInt(opts.concurrency, 10) || this.baseConcurrentPages,
    );

    const processProduct = async (productRecord) => {
      try {
        const productId = productRecord.AsinCode;
        const extracted = await this.scrapeProduct(productId, { full });

        // Persist scraped product data directly to the Asins table so the
        // app / DB reflects live Ajio data (only real values, never zero out).
        const updates = {
          ...(extracted.title ? { Title: extracted.title } : {}),
          ...(extracted.brand ? { Brand: extracted.brand } : {}),
          // Ajio products don't carry a real manufacturer; surface the brand in
          // the Manufacturer column so it flows to the table, export and filters.
          ...(extracted.brand ? { Manufacturer: extracted.brand } : {}),
          ...(extracted.mrp > 0 ? { Mrp: extracted.mrp } : {}),
          ...(extracted.currentPrice > 0
            ? { CurrentPrice: extracted.currentPrice }
            : {}),
          ...(extracted.discountPercentage > 0
            ? { DiscountPercentage: extracted.discountPercentage }
            : {}),
          ...(extracted.rating != null ? { Rating: extracted.rating } : {}),
          ...(extracted.reviewCount != null
            ? { ReviewCount: extracted.reviewCount }
            : {}),
          ...(extracted.category ? { Category: extracted.category } : {}),
          ...(extracted.description
            ? { ProductDescription: extracted.description }
            : {}),
          ...(Array.isArray(extracted.images) && extracted.images.length > 0
            ? {
                ImageUrl: extracted.images[0],
                Images: JSON.stringify(extracted.images),
                ImagesCount: extracted.images.length,
              }
            : {}),
        };
        // Availability: Availability keeps a machine-readable stock value for
        // downstream consumers, while AvailabilityStatus carries the call to
        // action shown in the AVAILABILITY column (e.g. "ADD TO BAG").
        const { availability, availabilityStatus } = toAjioAvailabilityFields({
          status: extracted.addToCartStatus,
          label: extracted.ctaLabel,
          ctaKey: extracted.ctaState,
        });
        if (availability) {
          updates.Availability = availability;
          updates.AvailabilityStatus = availabilityStatus;
        }

        const setClause = Object.keys(updates)
          .map((k, i) => `${k} = @u${i}`)
          .concat([
            "LastScrapedAt = @scrapedAt",
            "ScrapeStatus = 'COMPLETED'",
            "Status = 'Active'",
            "LastScrapeStatus = 'COMPLETED'",
            "LastScrapeError = NULL",
            "UpdatedAt = @scrapedAt",
          ])
          .join(", ");
        const dbUpdate = pool
          .request()
          .input("productId", sql.NVarChar, productId)
          .input("scrapedAt", sql.DateTime, new Date());
        Object.keys(updates).forEach((k, i) =>
          dbUpdate.input(`u${i}`, updates[k]),
        );
        await dbUpdate.query(
          `UPDATE Asins SET ${setClause} WHERE AsinCode = @productId`,
        );

        // Record today's snapshot so the 7-day price trend chart fills in (same
        // AsinHistory table + pattern Amazon's live sync uses).
        try {
          await pool
            .request()
            .input("asinId", sql.NVarChar, productRecord.Id)
            .input("price", sql.Decimal(18, 2), extracted.currentPrice > 0 ? extracted.currentPrice : null)
            .input("mrp", sql.Decimal(18, 2), extracted.mrp > 0 ? extracted.mrp : null)
            .input("rating", sql.Decimal(3, 2), extracted.rating || null)
            .input("reviewCount", sql.Int, extracted.reviewCount || null)
            .input("source", sql.NVarChar, "AJIO_SCRAPER").query(`
                MERGE AsinHistory AS target
                USING (SELECT @asinId AS AsinId, CAST(dbo.GetEnvDate() AS DATE) AS [Date]) AS src
                ON target.AsinId = src.AsinId AND target.[Date] = src.[Date]
                WHEN MATCHED THEN
                    UPDATE SET
                        Price = ISNULL(@price, target.Price),
                        Mrp = ISNULL(@mrp, target.Mrp),
                        Rating = ISNULL(@rating, target.Rating),
                        ReviewCount = ISNULL(@reviewCount, target.ReviewCount),
                        Source = @source
                WHEN NOT MATCHED THEN
                    INSERT (AsinId, [Date], Price, Mrp, Rating, ReviewCount, Source)
                    VALUES (src.AsinId, src.[Date], @price, @mrp, @rating, @reviewCount, @source);
            `);
        } catch (histErr) {
          logger.warn(
            `[AjioScraper] History snapshot failed for ${productId}:`,
            histErr.message,
          );
        }

        try {
          const SocketService = require("./socketService");
          const io = SocketService.getIo();
          if (io && productRecord.Id) {
            io.emit("scrape_data_ingested", {
              asinId: productRecord.Id,
              asinCode: productId,
              sellerId,
              timestamp: new Date(),
            });
          }
        } catch {}
        scraped++;

        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      } catch (err) {
        failed++;
        const msg = `Product ${productRecord.AsinCode}: ${err.message}`;
        errors.push(msg);
        logger.warn(
          `[AjioScraper] Failed ${productRecord.AsinCode}: ${err.message}`,
        );

        try {
          await pool
            .request()
            .input("productId", sql.NVarChar, productRecord.AsinCode)
            .input("error", sql.NVarChar, err.message).query(`
                            UPDATE Asins SET
                                ScrapeStatus = 'FAILED',
                                LastScrapeStatus = 'FAILED',
                                LastScrapeError = @error,
                                Status = 'Error',
                                UpdatedAt = dbo.GetEnvDate()
                            WHERE AsinCode = @productId
                        `);
        } catch (dbErr) {
          logger.error(
            `[AjioScraper] DB update failed for ${productRecord.AsinCode}:`,
            dbErr.message,
          );
        }
      }
    };

    let nextIndex = 0;
    const runWorker = async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= products.length) return;
        await processProduct(products[i]);
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(workersCount, products.length) },
        () => runWorker(),
      ),
    );

    logger.info(
      `[AjioScraper] Completed seller ${sellerId}: ${scraped} scraped, ${failed} failed`,
    );
    return { scraped, failed, errors };
  }

  async checkMemoryPressure() {
    const mem = process.memoryUsage();
    const heapUsedMB = mem.heapUsed / 1024 / 1024;
    const rssMB = mem.rss / 1024 / 1024;

    const heapThresholdMB = parseInt(
      process.env.AJIO_SCRAPER_MAX_HEAP_MB || "1500",
      10,
    );
    const rssThresholdMB = parseInt(
      process.env.AJIO_SCRAPER_MAX_RSS_MB || "2000",
      10,
    );

    if (heapUsedMB > heapThresholdMB || rssMB > rssThresholdMB) {
      logger.warn(
        `[AjioScraper] Memory pressure: heap=${heapUsedMB.toFixed(0)}MB, rss=${rssMB.toFixed(0)}MB — restarting browser`,
      );
      await this.close();
      this.browser = null;
      this._context = null;
      return true;
    }
    return false;
  }

  async maybeRestartBrowser() {
    const now = Date.now();
    const restartIntervalMs = parseInt(
      process.env.AJIO_SCRAPER_BROWSER_RESTART_MS || "1800000",
      10,
    );

    if (!this._lastBrowserRestart) this._lastBrowserRestart = now;

    if (now - this._lastBrowserRestart > restartIntervalMs) {
      logger.info("[AjioScraper] Periodic browser restart");
      await this.close();
      this.browser = null;
      this._context = null;
      this._lastBrowserRestart = now;
    }
  }

  async forceCleanup() {
    await this.close();
    this.browser = null;
    this._context = null;
    this.activePages.clear();
    this.busy = 0;
    if (global.gc) global.gc();
  }
}

const scraper = new AjioScraperService();

module.exports = scraper;

// Exported for testing the pure availability helpers without a browser.
module.exports.resolveAjioStockSignal = resolveAjioStockSignal;
module.exports.resolveAjioAvailability = resolveAjioAvailability;
module.exports.toAjioAvailabilityFields = toAjioAvailabilityFields;
module.exports.AJIO_CTA_LABELS = AJIO_CTA_LABELS;
