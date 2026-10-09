// Build entry for the LOCAL-ONLY ASIN scraper exe (never committed).
// Loads the real backend/.env (if the exe sits in backend/scripts/) so the
// scraper keeps exactly the same behaviour as running under node.
const path = require('path');
const fs = require('fs');

const candidates = [
    path.join(path.dirname(process.execPath), '..', '.env'),
    path.join(process.cwd(), '.env'),
];
let loaded = null;
for (const f of candidates) {
    if (fs.existsSync(f)) {
        require('dotenv').config({ path: f });
        loaded = f;
        break;
    }
}

require('dotenv').config();

require('../local-scrape-asins.js');