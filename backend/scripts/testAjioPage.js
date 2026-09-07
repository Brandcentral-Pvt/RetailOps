const { chromium } = require('playwright');

async function testAjioPage() {
    // Ajio product URLs use numeric codes
    const testCodes = [
        '703016831006', // From database
        '701983589003',
    ];

    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-IN',
    });

    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    for (const code of testCodes) {
        const page = await context.newPage();
        const url = `https://www.ajio.com/p/${code}`;
        console.log(`\nTesting: ${url}`);
        
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
            
            const title = await page.title();
            console.log(`Title: ${title}`);
            console.log(`URL: ${page.url()}`);
            
            // Check for blocked
            const blocked = await page.$('text=/block|robot|captcha/i').catch(() => null);
            if (blocked) console.log('BLOCKED DETECTED');
            
            // Save HTML for analysis
            const html = await page.content();
            const fs = require('fs');
            fs.writeFileSync(`debug-ajio-${code}.html`, html);
            console.log(`Saved HTML (${html.length} chars)`);
            
            // Look for key elements
            const selectors = {
                title: ['h1.prod-name', '.prod-name', 'h1[data-testid]', '.product-title'],
                price: ['.prod-sp', '.price-original', '.price-current', '[data-testid="price"]'],
                mrp: ['.prod-sp-mrp', '.price-mrp', '.was-price'],
                rating: ['.rating-stars', '.ratings', '[data-testid="rating"]', '.average-rating'],
                reviewCount: ['.rating-count', '.review-count', '[data-testid="review-count"]'],
                images: ['.image-grid img', '.product-image img', '[data-testid="image"]'],
                description: ['.prod-desc', '.description', '[data-testid="description"]'],
                category: ['.breadcrumb', '.breadcrumbs', '.category-path'],
                brand: ['.brand-name', '.prod-brand'],
                availability: ['.stock-availability', '.availability', '[data-testid="availability"]'],
            };
            
            for (const [name, selList] of Object.entries(selectors)) {
                for (const sel of selList) {
                    const el = await page.$(sel).catch(() => null);
                    if (el) {
                        const text = await el.textContent().catch(() => '');
                        const href = await el.getAttribute('href').catch(() => '');
                        const src = await el.getAttribute('src').catch(() => '');
                        console.log(`  ${name}: ${sel} => ${text.substring(0, 100) || src.substring(0, 100) || href.substring(0, 100)}`);
                        break;
                    }
                }
            }
            
        } catch (error) {
            console.error(`Error: ${error.message}`);
        } finally {
            await page.close();
        }
    }

    await context.close();
    await browser.close();
}

testAjioPage().catch(console.error);