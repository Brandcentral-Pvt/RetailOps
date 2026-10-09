/**
 * LOCAL diagnostic — dump price-related DOM for a given ASIN (untracked).
 * Usage: node scripts/diagnose-price.js B0FP99TYDH
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
global.logger = { info: console.log, warn: console.warn, error: console.error };
const path = require('path');
const service = require(path.join(__dirname, '..', 'services', 'playwrightScraperService.js'));

const asin = process.argv[2] || 'B0FP99TYDH';
const url = `https://www.amazon.in/dp/${asin}`;

async function main() {
    const browser = await service.getBrowser();
    const context = await service.getContext();
    const page = await context.newPage();
    page.setDefaultTimeout(service.navigationTimeout);
    await service._navigateToProduct(page, url);

    const dump = await page.evaluate(() => {
        const txt = (el) => (el ? (el.textContent || '').trim().replace(/\s+/g, ' ') : '');
        const out = { title: txt(document.querySelector('#productTitle')), regions: [] };

        const core = document.querySelector('#corePriceDisplay_desktop_feature_div');
        if (core) {
            const offs = [...core.querySelectorAll('.a-offscreen')].map(txt);
            out.regions.push({ name: 'corePrice offscreen', html: core.innerHTML.slice(0, 2500), offs });
        }

        const apex = document.querySelector('.apexPriceToPay');
        if (apex) out.regions.push({ name: 'apexPriceToPay', html: apex.innerHTML.slice(0, 1800) });

        const allOff = [...document.querySelectorAll('span.a-price span.a-offscreen')].map(txt).slice(0, 12);
        out.regions.push({ name: 'all a-offscreen (first 12)', offs: allOff });

        const any545 = [...document.querySelectorAll('*')].filter(e => /545/i.test(txt(e))).slice(0, 10).map(e => ({ tag: e.tagName, cls: e.className, txt: txt(e).slice(0, 80), id: e.id }));
        out.regions.push({ name: 'elements mentioning 545', nodes: any545 });

        const priceblock = document.querySelector('#priceblock_dealprice, #priceblock_ourprice, #price');
        out.regions.push({ name: 'priceblock', html: priceblock ? priceblock.innerHTML.slice(0, 800) : null });

        const dealNodes = [...document.querySelectorAll('[id*="deal" i], [class*="deal" i], [data-hook*="deal" i], [class*="savings" i]')]
            .map(e => ({ id: e.id, cls: e.className, txt: txt(e).slice(0, 90) }))
            .filter(n => n.txt)
            .slice(0, 15);
        out.regions.push({ name: 'deal/savings elements', nodes: dealNodes });

        const buybox = document.querySelector('#buybox');
        out.regions.push({ name: 'buybox head', html: buybox ? buybox.innerHTML.slice(0, 1200) : null });

        return out;
    });

    console.log(JSON.stringify(dump, null, 2));
    await page.close().catch(() => {});
    await service.close();
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });