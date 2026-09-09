// PM2 Ecosystem Config — Production (/var/www/retail-ops) & Local Dev
// Usage (production): cd /var/www/retail-ops/backend && pm2 start ecosystem.config.js --env production
// Usage (local dev):  pm2 start ecosystem.config.js

const path = require('path');
const os = require('os');

// Auto-detect: Linux = production VPS, Windows = local dev machine
const isProduction = process.platform === 'linux';

const PROD_ROOT = '/var/www/retail-ops';

// Dev paths via environment variables (fallback to relative paths)
const DEV_BACKEND = process.env.DEV_BACKEND_PATH || path.join(__dirname);
const DEV_FRONTEND = process.env.DEV_FRONTEND_PATH || path.join(__dirname, '..', 'frontend');

const backendCwd = isProduction ? `${PROD_ROOT}/backend` : DEV_BACKEND;
const frontendCwd = isProduction ? `${PROD_ROOT}/frontend` : DEV_FRONTEND;
const logDir = isProduction ? `${PROD_ROOT}/logs` : path.join(__dirname, 'logs');

// Use available CPU cores for clustering, capped to prevent memory exhaustion
// Cap at 8 workers to limit total memory (8 * 1.5GB heap ≈ 12GB RSS) and SQL connections
const cpuCores = Math.min(os.cpus().length, 8);

module.exports = {
  apps: [
    {
      name: 'retailops-api',
      script: './server.js',
      cwd: backendCwd,
      // Cluster mode: one worker per CPU core — spreads load & prevents single-process heap blowups.
      // Instance 0 runs schedulers/background jobs; all others serve API only (see server.js).
      instances: cpuCores,
      exec_mode: 'cluster',

      // Memory guardrails.
      // Heap cap MUST stay well below max_memory_restart: RSS ≈ JS heap +
      // native overhead (Buffers, JSDOM, XLSX buffers ≈ 1.3–1.5× heap).
      // The previous 4096MB heap vs 2G restart guaranteed PM2 hard-killed
      // workers mid-request (exports/imports aborted) instead of letting
      // GC relieve pressure first. 1536MB heap × ~1.35 ≈ 2.0GB RSS.
      max_memory_restart: '2G',
      node_args: '--max-old-space-size=1536',

      env: {
        NODE_ENV: isProduction ? 'production' : 'development',
        PORT: 3001,
        // Cap SQL pool per worker — with N cluster workers the previous
        // default (200/worker) could reach N×200 connections to the remote
        // SQL Server, causing connection saturation + worker memory spikes.
        // Scale inversely with worker count to keep total connections ~320.
        DB_POOL_MAX: Math.max(10, Math.floor(320 / cpuCores)),
        DB_POOL_MIN: 5,
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
      kill_timeout: 5000,
      listen_timeout: 10000,
      wait_ready: false,

      // Auto-restart on crash
      autorestart: true,
    },
    {
      name: 'retailops-frontend',
      script: 'npm',
      args: 'npm run dev',
      cwd: frontendCwd,
      // Next.js handles clustering internally; use 1 instance to avoid port conflicts.
      // For horizontal scaling, run multiple PM2 instances behind nginx/load balancer.
      instances: 1,
      exec_mode: 'fork',

      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',

      env: {
        NODE_ENV: isProduction ? 'production' : 'development',
        PORT: 3000,
        NEXT_TELEMETRY_DISABLED: 1,
      },

      // Restart policies
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,

      // Logging
      error_file: `${logDir}/frontend-error.log`,
      out_file: `${logDir}/frontend-out.log`,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      watch: false,
      time: true,

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      wait_ready: false,

      // Auto-restart on crash
      autorestart: true,
    },
  ],
};
