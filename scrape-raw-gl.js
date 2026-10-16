// scrape-raw-gl.js — ESM entry point.
//
// package.json sets "type": "module", so this .js file is an ES module and
// cannot use require(). The implementation therefore lives in the CommonJS
// file scrape-raw-gl.cjs. Both entry points behave identically:
//
//   node scrape-raw-gl.js  --input MEELANA.csv --output MEELANA.xlsx --concurrency 3 --delay 2000
//   node scrape-raw-gl.cjs --input MEELANA.csv --output MEELANA.xlsx --concurrency 3 --delay 2000
//
// Importing the .cjs module runs its CLI (it reads process.argv itself).
import './scrape-raw-gl.cjs';
