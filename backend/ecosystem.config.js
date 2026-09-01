// PM2 Ecosystem Config — Production (/var/www/retail-ops) & Local Dev
// Usage (production): cd /var/www/retail-ops/backend && pm2 start ecosystem.config.js --env production
// Usage (local dev):  pm2 start ecosystem.config.js

const path = require('path');
const os = require('os');

// Auto-detect: Linux = production VPS, Windows = local dev machine
const isProduction = process.platform === 'linux';

const PROD_ROOT = '/var/www/retail-ops';
const DEV_BACKEND = 'G:\\Brandcentral Development\\RetailOps_V2.1\\RetailOps_V2.1\\retail-ops\\backend';
const PROD_FRONTEND = '/var/www/retail-ops/frontend';
const DEV_FRONTEND = 'G:\\Brandcentral Development\\RetailOps_V2.1\\RetailOps_V2.1\\retail-ops\\frontend';

const cwd = isProduction ? `${PROD_ROOT}/backend` : DEV_BACKEND;
const frontendCwd = isProduction ? PROD_FRONTEND : DEV_FRONTEND;
const logDir = isProduction ? `${PROD_ROOT}/logs` : path.join(__dirname, 'logs');

// Calculate optimal worker count
// Use CPU cores but cap at 8 for SQL connection pool limits
const cpuCount = os.cpus().length;
const maxWorkers = Math.min(cpuCount, isProduction ? 8 : 2);

module.exports = {
  apps: [
    {
      name: 'brand-central-api',
      script: './server.js',
      cwd,
      // Cluster mode: one worker per CPU core — spreads load & prevents single-process heap blowups.
      // Instance 0 runs schedulers/background jobs; all others serve API only (see server.js).
      instances: maxWorkers,
      exec_mode: 'cluster',

      // Memory guardrails.
      // Heap cap MUST stay well below max_memory_restart: RSS ≈ JS heap +
      // native overhead (Buffers, JSDOM, XLSX buffers ≈ 1.3–1.5× heap).
      // 1536MB heap × ~1.35 ≈ 2.0GB RSS per worker.
      max_memory_restart: '2G',
      node_args: '--max-old-space-size=1536',

      env: {
        NODE_ENV: isProduction ? 'production' : 'development',
        PORT: 3001,
        // Cap SQL pool per worker — with N cluster workers the previous
        // default (200/worker) could reach N×200 connections to the remote
        // SQL Server, causing connection saturation + worker memory spikes.
        // With 8 workers × 40 = 320 max connections (safe for most SQL Server configs)
        DB_POOL_MAX: 40,
        DB_POOL_MIN: 10,
        DB_ACQUIRE_TIMEOUT_MS: 10000,
        DB_CONNECT_TIMEOUT_MS: 15000,
        DB_REQUEST_TIMEOUT_MS: 60000,
        
        // Redis cache settings
        CACHE_DEFAULT_TTL: 300,
        CACHE_PREFIX: 'retailops:',
        
        // Rate limiting
        GLOBAL_RATE_LIMIT_WINDOW_MS: 60000,
        GLOBAL_RATE_LIMIT_MAX: 1000,
        API_RATE_LIMIT_WINDOW_MS: 60000,
        API_RATE_LIMIT_MAX: 100,
        DASHBOARD_RATE_LIMIT_WINDOW_MS: 60000,
        DASHBOARD_RATE_LIMIT_MAX: 60,
        AUTH_RATE_LIMIT_WINDOW_MS: 900000,
        AUTH_RATE_LIMIT_MAX: 5,
        HEAVY_OP_RATE_LIMIT_WINDOW_MS: 3600000,
        HEAVY_OP_RATE_LIMIT_MAX: 10,
        
        // Request deduplication
        DEDUP_TTL_MS: 5000,
        
        // Queue settings
        QUEUE_PREFIX: 'retailops:queue:',
      },

      // Restart policies
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,

      // Logging
      error_file: `${logDir}/api-error.log`,
      out_file: `${logDir}/api-out.log`,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      watch: false,
      time: true,

      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 15000,
      wait_ready: false,

      // Auto-restart on crash
      autorestart: true,
      
      // Health check
      health_check: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
      },
    },
  },
    {
      name: 'retailops-frontend',
      script: 'vite',
      args: 'preview --port 5173 --host 0.0.0.0',
      cwd: frontendCwd,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '800M',
      node_args: '--max-old-space-size=800',
      env: {
        NODE_ENV: isProduction ? 'production' : 'development',
        PORT: 5173,
      },
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      error_file: `${logDir}/frontend-error.log`,
      out_file: `${logDir}/frontend-out.log`,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      watch: false,
      time: true,
      kill_timeout: 10000,
      listen_timeout: 15000,
      wait_ready: false,
      autorestart: true,
      health_check: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
      },
    },
  ],
};
