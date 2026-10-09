// SEA/exe entry: resolve real .env near the executable, then run the scraper.
const path = require('path');
const fs = require('fs');

const exeDir = path.dirname(process.execPath);
for (const f of [
    path.join(exeDir, '..', '..', '.env'),
    path.join(exeDir, '..', '.env'),
    path.join(process.cwd(), '.env'),
]) {
    if (fs.existsSync(f)) { require('dotenv').config({ path: f }); break; }
}
require('dotenv').config();

require('../local-scrape-asins.js');