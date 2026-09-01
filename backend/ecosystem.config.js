// PM2 Ecosystem Config — Production Ready
// Server: srv888283 (31.97.62.95)
// Usage: pm2 start ecosystem.config.js

const os = require('os');
const path = require('path');

const isProduction = process.platform === 'linux';

// Paths
const PROD_ROOT = '/var/www/retail-ops';
const DEV_ROOT = 'G:\\Brandcentral Development\\RetailOps_V2.1\\RetailOps_V2.1\\retail-ops';

const backendCwd = isProduction ? `${PROD_ROOT}/backend` : `${DEV_ROOT}\\backend`;
const frontendCwd = isProduction ? `${PROD_ROOT}/frontend` : `${DEV_ROOT}\\frontend`;
const logDir = isProduction ? `${PROD_ROOT}/logs` : path.join(__dirname, 'logs');

// Worker count: cap at 8 for SQL connection pool safety
const cpuCount = os.cpus().length;
const maxWorkers = Math.min(cpuCount, isProduction ? 8 : 2);

module.exports = {
  apps: [
    // ─────────────────────────────────────────────
    // Backend API (Cluster Mode)
    // ─────────────────────────────────────────────
    {
      name: 'retailops-api',
      script: './server.js',
      cwd: backendCwd,
      instances: maxWorkers,
      exec_mode: 'cluster',

      // Memory: 1536MB heap × 1.35 overhead ≈ 2GB RSS
      max_memory_restart: '2G',
      node_args: '--max-old-space-size=1536',

      env: {
        NODE_ENV: isProduction ? 'production' : 'development',
        PORT: 3001,

        // SQL Connection Pool (per worker)
        // 8 workers × 40 = 320 max connections
        DB_POOL_MAX: 40,
        DB_POOL_MIN: 10,
        DB_ACQUIRE_TIMEOUT_MS: 10000,
        DB_CONNECT_TIMEOUT_MS: 15000,
        DB_REQUEST_TIMEOUT_MS: 60000,

        // Redis Cache
        CACHE_DEFAULT_TTL: 300,
        CACHE_PREFIX: 'retailops:',

        // Rate Limiting
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

        // Request Deduplication
        DEDUP_TTL_MS: 5000,

        // Queue Settings
        QUEUE_PREFIX: 'retailops:queue:',
      },

      // Restart Policies
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,

      // Logging
      error_file: `${logDir}/api-error.log`,
      out_file: `${logDir}/api-out.log`,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      log_type: 'json',

      // Production Settings
      watch: false,
      time: true,
      autorestart: true,

      // Graceful Shutdown
      kill_timeout: 10000,
      listen_timeout: 15000,
      wait_ready: false,

      // Health Check
      health_check: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
      },
    },

    // ─────────────────────────────────────────────
    // Frontend (Fork Mode)
    // ─────────────────────────────────────────────
    {
      name: 'retailops-frontend',
      script: isProduction ? 'npx' : 'npx',
      args: isProduction ? 'vite preview --port 5173 --host 0.0.0.0' : 'vite --port 5173 --host 0.0.0.0',
      cwd: frontendCwd,
      instances: 1,
      exec_mode: 'fork',

      max_memory_restart: '800M',
      node_args: '--max-old-space-size=800',

      env: {
        NODE_ENV: isProduction ? 'production' : 'development',
        PORT: 5173,
      },

      // Restart Policies
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,

      // Logging
      error_file: `${logDir}/frontend-error.log`,
      out_file: `${logDir}/frontend-out.log`,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      log_type: 'json',

      // Production Settings
      watch: false,
      time: true,
      autorestart: true,

      // Graceful Shutdown
      kill_timeout: 10000,
      listen_timeout: 15000,
      wait_ready: false,

      // Health Check
      health_check: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
      },
    },
  ],
};
