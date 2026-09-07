require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sql, getPool } = require('../database/db');
const fs = require('fs');

const SELLER_ID = '69e8612f1e4de9e2dc81f78d';

async function exportToCsv() {
    const pool = await getPool();
    
    const result = await pool.request()
        .input('sellerId', sql.VarChar, SELLER_ID)
        .query(`
            SELECT 
                Asin,
                Rating,
                ReviewCount,
                HasAplus,
                VerifiedAsin,
                Title,
                Price,
                BSR,
                LastScrapedAt
            FROM AsinScrapeData 
            WHERE SellerId = @sellerId 
            ORDER BY LastScrapedAt
        `);

    const headers = ['Asin', 'Rating', 'ReviewCount', 'HasAplus', 'VerifiedAsin', 'Title', 'Price', 'BSR', 'LastScrapedAt'];
    const rows = result.recordset.map(r => [
        r.Asin,
        r.Rating,
        r.ReviewCount,
        r.HasAplus ? 'Yes' : 'No',
        r.VerifiedAsin || '',
        `"${(r.Title || '').replace(/"/g, '""')}"`,
        r.Price,
        r.BSR || '',
        r.LastScrapedAt ? new Date(r.LastScrapedAt).toISOString() : ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const filename = `bharvita-scraped-${new Date().toISOString().split('T')[0]}.csv`;
    fs.writeFileSync(filename, csv);
    
    console.log(`Exported ${rows.length} ASINs to ${filename}`);
    console.log(`File size: ${(csv.length / 1024).toFixed(2)} KB`);
}

exportToCsv().catch(console.error).finally(() => process.exit(0));