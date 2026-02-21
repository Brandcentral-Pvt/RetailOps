const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }});
  const page = await context.newPage();
  
  try {
    // Attempt local login or assume no auth required for localhost
    await page.goto('http://localhost:5173/asin-tracker', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'asin-table-ui.png', fullPage: true });
    console.log('✅ Screenshot captured as asin-table-ui.png');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
