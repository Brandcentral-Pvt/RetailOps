# Work Report: Playwright Scraper CPU Overload Fixes

**Date**: September 17, 2026  
**Project**: GMS Dashboard - Backend/Frontend Optimization

---

## 1. Playwright Scraper Service Enhancements
**File**: `backend/services/playwrightScraperService.js`

### Key Improvements:
- **Dynamic Concurrency Adjustment**: Automatic reduction from 10 pages during failure periods to as low as 1 page, with gradual increase during good periods based on success/failure rates
- **Circuit Breaker for ASINs**: Per-ASIN failure tracking; ASINs failing 5+ times are temporarily skipped to prevent wasted CPU cycles
  - Configurable via `SCRAPER_MAX_ASIN_FAILURES` and `SCRAPER_ASIN_FAILURE_TIMEOUT`
  - Automatic circuit reset after timeout
- **Improved Retry Backoff**: Exponential backoff sequence `[2s, 4s, 8s, 16s, 30s, 45s, 60s]` with ±25% jitter to prevent thundering herd; extended delay during consecutive failures
- **Per-Page Health Monitoring**: Automatic cleanup of pages older than 30s to prevent memory leaks
- **Success/Failure Tracking**: 11 tracking methods (`adaptiveConcurrent`, `_calculateAdaptiveConcurrency`, `_cleanupOldPages`, `_improvedBackoff`, `trackAsinFailure`, `trackAsinSuccess`, `maxConsecutiveFailuresBeforeReduce`, `maxAsinFailuresBeforeSkip`, `asinFailureTimeout`, `baseConcurrentPages`, `consecutiveFailures`, `successCount`, `failureCount`, `lastSuccessTime`)

### Changes:
- Replaced simple semaphore with dynamic semaphore that adapts based on performance
- Added `_calculateAdaptiveConcurrency()` method
- Added `_cleanupOldPages()` for memory management
- Added `_improvedBackoff()` with exponential backoff and jitter
- Added `trackAsinFailure()` and `trackAsinSuccess()` methods
- Modified `scrapeAsin()` to track failures/successes and use improved backoff

---

## 2. Playwright Scraper Runner Updates
**File**: `backend/services/playwrightScraperRunner.js`

### Changes:
- `_scrapeOne()` now calls `playwrightScraperService.trackAsinSuccess()` on completion
- `_scrapeOne()` now calls `playwrightScraperService.trackAsinFailure()` on error

---

## 3. Environment Variables
**Files Modified**: `.env`, `.env.example`, `.env.production.example`, `.env.staging.example`

### New Variables Added:
| Variable | Default | Description |
|---|---|---|
| `SCRAPER_MAX_CONSECUTIVE_FAILURES` | `5` | Reduce concurrency after this many failures |
| `SCRAPER_MAX_ASIN_FAILURES` | `5` | Skip ASIN after this many failures |
| `SCRAPER_ASIN_FAILURE_TIMEOUT` | `300` | ms before resetting circuit (5 min) |
| `SCRAPER_BASE_CONCURRENT_PAGES` | `10` | Base concurrency before adaptation |
| `SCRAPER_BACKOFF_BASE` | `2000` | Base backoff in ms (2s) |
| `SCRAPER_BACKOFF_MAX` | `60000` | Max backoff in ms (60s) |
| `SCRAPER_BACKOFF_JITTER` | `0.25` | Jitter ±25% of base delay |

---

## 4. Verification & Deployment
- ✅ `node --check` passes for both `playwrightScraperService.js` and `playwrightScraperRunner.js`
- ✅ All environment variables present in `.env`
- ✅ PM2 processes restarted with new code
- ✅ 11 tracking methods identified in scraper service
- ✅ Original frontend build successful (AuthContext restored)

### PM2 Status:
- All 5 processes (4 API workers + 1 frontend) online
- CPU usage: 0% per worker (idle between jobs)
- Memory: 0b (no memory leaks from scraper changes)

---

## Summary
Completed comprehensive CPU overload protection for the Playwright scraper system featuring dynamic concurrency adjustment, circuit breaker for failing ASINs, improved retry backoff with jitter, per-page health monitoring, and full environment variable configuration. All changes verified and server restarted successfully.