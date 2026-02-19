// Profit calculation engine for Revenue Calculator
// Refactored to use backend API
import { db } from './db';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch Keepa data for ASINs
 * @param {AsinItem[]} asins
 * @param {boolean} [forceRefresh=false]
 */
export const fetchKeepaData = async (asins, forceRefresh = false) => {
  // Keeping fetchKeepaData client-side for now as it uses the user's local API key
  // This logic is complex but works well client-side to avoid sharing API keys with server if privacy is concern
  // Or we can move this to backend later if we want centralized key management

  const targets = forceRefresh
    ? asins
    : asins.filter(a => a.status === 'pending' || a.status === 'error');

  if (targets.length === 0) return;

  const apiKey = db.getKeepaKey().trim();
  if (!apiKey) {
    console.warn("Skipping Keepa Fetch: Missing API Key.");
    return;
  }

  const chunkSize = 100;
  for (let i = 0; i < targets.length; i += chunkSize) {
    const chunk = targets.slice(i, i + chunkSize);
    const validAsins = chunk.map(a => a.asin.trim()).filter(a => /^[A-Z0-9]{10}$/i.test(a));

    if (validAsins.length === 0) {
      for (const item of chunk) await db.updateAsin(item.id, { status: 'error', errorMessage: 'Invalid ASIN format' });
      continue;
    }

    const asinList = validAsins.join(',');
    let attempts = 0;
    const maxAttempts = 5;
    let success = false;

    console.log(`[Keepa] Fetching chunk ${i / chunkSize + 1} (${validAsins.length} items): ${asinList}`);

    while (attempts < maxAttempts && !success) {
      try {
        const url = `https://api.keepa.com/product?key=${apiKey}&domain=10&asin=${asinList}&stats=1&history=0&offersSuccessful=1`;
        const response = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });

        if (response.status === 429) {
          attempts++;
          const waitTime = 5000 * Math.pow(2, attempts);
          await delay(waitTime);
          continue;
        }

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const textResponse = await response.text();
        const data = JSON.parse(textResponse);

        if (data.error) {
          if (data.error.message && data.error.message.toLowerCase().includes('token')) {
            attempts++;
            const waitTime = 5000 * Math.pow(2, attempts);
            await delay(waitTime);
            continue;
          }
          throw new Error(data.error.message);
        }

        const products = data.products || [];
        for (const item of chunk) {
          const product = products.find(p => p.asin.toUpperCase() === item.asin.toUpperCase());

          if (product) {
            let rawPrice = -1;
            const stats = product.stats;
            if (stats && stats.current) {
              const buyBox = stats.buyBoxPrice;
              const newPrice = stats.current[1];
              const amazonPrice = stats.current[0];
              if (typeof buyBox === 'number' && buyBox > 0) rawPrice = buyBox;
              else if (typeof newPrice === 'number' && newPrice > 0) rawPrice = newPrice;
              else if (typeof amazonPrice === 'number' && amazonPrice > 0) rawPrice = amazonPrice;
            }

            const price = rawPrice > 0 ? rawPrice / 100 : 0;

            const itemWeight = product.itemWeight || 0;
            const packageWeight = product.packageWeight || 0;

            const l = product.packageLength || 0;
            const w = product.packageWidth || 0;
            const h = product.packageHeight || 0;
            const lCm = l / 10;
            const wCm = w / 10;
            const hCm = h / 10;
            const volumetricWeight = Math.round((lCm * wCm * hCm) / 5000);

            let finalWeight = 0;
            if (packageWeight > 0) finalWeight = packageWeight;
            else finalWeight = volumetricWeight;

            const title = product.title || `ASIN ${item.asin}`;
            const brand = product.brand || 'Unknown';
            const image = product.imagesCSV ? `https://images-na.ssl-images-amazon.com/images/I/${product.imagesCSV.split(',')[0]}` : '';

            let category = 'Uncategorized';
            let categoryPath = '';
            let categoryId = '';

            if (product.categoryTree && product.categoryTree.length > 0) {
              const leaf = product.categoryTree[product.categoryTree.length - 1];
              category = leaf.name;
              categoryPath = product.categoryTree.map(c => c.name).join(' > ');
              categoryId = String(leaf.catId);
            } else if (product.categories && product.categories.length > 0) {
              categoryId = String(product.categories[product.categories.length - 1]);
            }

            await db.updateAsin(item.id, {
              title, brand, category, categoryPath, categoryId, image, price,
              weight: finalWeight, volumetricWeight,
              dimensions: `${lCm.toFixed(1)}x${wCm.toFixed(1)}x${hCm.toFixed(1)} cm`,
              status: 'fetched'
            });
          } else {
            await db.updateAsin(item.id, { status: 'error', errorMessage: 'ASIN not found in Keepa return data' });
          }
        }
        success = true;
      } catch (error) {
        if (error.message.includes('403') || error.message.includes('key')) {
          for (const item of chunk) await db.updateAsin(item.id, { status: 'error', errorMessage: 'Invalid API Key' });
          return;
        }
        attempts++;
        await delay(5000);
        if (attempts >= maxAttempts) {
          for (const item of chunk) await db.updateAsin(item.id, { status: 'error', errorMessage: error.message });
        }
      }
    }
    await delay(2000);
  }
};

/**
 * Calculate profits for ASINs by calling backend API
 * @param {AsinItem[]} asins
 */
export const calculateProfits = async (asins) => {
  try {
    console.log('[FeeCalc] Triggering backend calculation...');
    // If asins array provided, pass IDs, otherwise empty array triggers all
    const ids = asins ? asins.map(a => a.id).filter(Boolean) : [];
    await db.calculateProfits(ids);
    console.log('[FeeCalc] Backend calculation initiated');
  } catch (error) {
    console.error('[FeeCalc] Calculation error:', error);
    throw error;
  }
};
