const { chromium } = require('playwright');

async function testAjioPage() {
    const testCodes = ['703016831006'];

    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-IN',
        extraHTTPHeaders: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
            'Referer': 'https://www.google.com/',
        },
    });

    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };
    });

    for (const code of testCodes) {
        const page = await context.newPage();
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(45000);
        
        const url = `https://www.ajio.com/p/${code}`;
        console.log(`Testing: ${url}`);
        
        try {
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            console.log(`Response: ${response?.status()}`);
            
            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(3000); // Wait for dynamic content
            
            // Search for rating/review in entire HTML
            const html = await page.content();
            const fs = require('fs');
            fs.writeFileSync(`debug-ajio-${code}-full.html`, html);
            
            // Search for rating patterns
            const ratingPatterns = [
                /rating/i,
                /review/i,
                /star/i,
                /"aggregateRating"/i,
                /ratingValue/i,
                /reviewCount/i,
            ];
            
            for (const pattern of ratingPatterns) {
                const matches = [...html.matchAll(new RegExp(pattern, 'gi'))];
                if (matches.length > 0) {
                    console.log(`Found "${pattern.source}": ${matches.length} matches`);
                    // Show context around first few matches
                    matches.slice(0, 3).forEach(m => {
                        const start = Math.max(0, m.index - 100);
                        const end = Math.min(html.length, m.index + 200);
                        console.log(`  ...${html.substring(start, end)}...`);
                    });
                }
            }
            
            // Also check for API calls
            const networkCalls = [];
            page.on('response', resp => {
                if (resp.url().includes('rating') || resp.url().includes('review') || 
                    resp.url().includes('product') || resp.url().includes('api')) {
                    networkCalls.push({
                        url: resp.url(),
                        status: resp.status(),
                        type: resp.request().resourceType()
                    });
                }
            });
            
            // Reload to capture network
            await page.reload({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
            await page.waitForTimeout(3000);
            
            console.log('\n=== Network Calls ===');
            networkCalls.slice(0, 20).forEach(c => console.log(`  ${c.status} ${c.type} ${c.url}`));
            
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