# Amazon.in Scraper (standalone)

One-file product-page scraper for **amazon.in**. No database, no web server, no
login — it reads a plain list of ASINs, scrapes the public product page with a
real Chromium (via Playwright), and writes results to CSV/Excel + JSON.

Results are **always** saved — on normal completion, on Ctrl+C (SIGINT), and on
any crash — so a partial run never loses the ASINs already scraped.

---

## 1. Install (one time)

Requires **Node.js 18+**.

```bash
npm install                 # installs playwright + exceljs + dotenv
npm run install:browser     # downloads Chromium
```

On Linux servers add system libraries with the package manager first:

```bash
npm run install:browser:linux
```

## 2. Run

```bash
node amazon-scraper.js --file asins.txt --out results/scrape-results.csv
```

Excel output (formatted, auto-filter, frozen header, ₹ formats):

```bash
node amazon-scraper.js --file asins.txt --out results/scrape-results.xlsx
```

## 3. Options

| Flag            | Default             | Purpose                                   |
|-----------------|---------------------|-------------------------------------------|
| `--file <path>` | `./asins.txt`       | Input list, one ASIN per line, `#` = comment |
| `--out <path>`  | `./results/scrape-results.csv` | `.xlsx` → Excel workbook, else CSV. A `.json` with full records is always written next to it |
| `--delay <ms>`  | `2500`              | Pause between ASINs. **Higher = safer** |
| `--limit <n>`   | all                 | Scrape only the first *n* ASINs           |
| `--headed`      | off                 | Show the browser window (debugging)       |
| `--max-retries <n>` | `3`              | Retries per ASIN on network noise         |

Environment variables (see `.env.example`) also work: `SCRAPER_HEADLESS`,
`PROXY_URL`, `SCRAPER_MAX_RETRIES`, `SCRAPER_REQUEST_TIMEOUT`,
`SCRAPER_NAVIGATION_TIMEOUT`, `SCRAPER_DELAY_MS`. Copy `.env.example` to `.env`
if you want to set any of these.

## 4. Output

**CSV/Excel columns:** `asin, title, currentPrice (₹), mrp (₹), discountPercentage (%), soldBy, dealBadge, availability, status, error`

`soldBy` and `dealBadge` are resolved from the buybox. Deal badge carries the
**real deal label** ("Mega Festival Deal", "Lightning Deal", "Deal of the Day",
"Great Indian Festival", "Limited time deal"...), not just the "-71%" savings
piece — the percentage is used only when Amazon renders no label at all.

The companion **`.json`** contains the full record per ASIN, including:
`rating`, `reviewCount`, `hasAplus`, `imageUrl`, `imagesCount`, `brand`,
`category`, `dealPrice`, `savingsAmount`, `bsr`, `subBsr`, `subBsrCategory`,
`bulletPoints`, `bulletPointsText`, `description`, `url`, `scrapedAt`.

## 5. Staying under the radar (important)

Amazon actively blocks data scrapers. Practical mitigations, in order:

1. **Delay** — keep `--delay` at 3000–4000ms+ for a residential IP. The script
   is sequential on purpose.
2. **Proxy** — for volume work use a residential/mobile proxy
   (`PROXY_URL=http://user:pass@host:port`). A single datacenter IP will be
   blocked fast.
3. **Small batches** — prefer a few per minute over many at once.
4. If you hit CAPTCHA (errors say `CAPTCHA_CHALLENGE`), **stop, wait several
   hours, and slow down** — the script fails fast on captcha instead of
   retrying into a block.

## 6. Troubleshooting

- `browserType.launch: Executable doesn't exist` → you skipped
  `npm run install:browser`.
- `HTTP 503` / `CAPTCHA_CHALLENGE` → IP is throttled or blocked. Wait, add a
  proxy, and raise `--delay`.
- Something breaks mid-run → output is still written (Ctrl+C and crashes
  included). Check the `.json` next to your output file.
- Want to watch what's happening → add `--headed`.

## 7. Note

Only public product data (price, title, rating, seller, availability) is read.
Keep volumes modest and comply with Amazon's terms of service and applicable
laws for the target market.