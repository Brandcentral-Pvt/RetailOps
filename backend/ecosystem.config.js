// PM2 Ecosystem Config — Production (/var/www/retail-ops) & Local Dev
// Usage (production): cd /var/www/retail-ops/backend && pm2 start ecosystem.config.js --env production
// Usage (local dev):  pm2 start ecosystem.config.js

const path = require('path');

// Auto-detect: Linux = production VPS, Windows = local dev machine
const isProduction = process.platform === 'linux';

const PROD_ROOT = '/var/www/retail-ops';
const DEV_BACKEND = 'G:\\Brandcentral Development\\RetailOps_V2.1\\RetailOps_V2.1\\retail-ops\\backend';

const cwd = isProduction ? `${PROD_ROOT}/backend` : DEV_BACKEND;
const logDir = isProduction ? `${PROD_ROOT}/logs` : path.join(__dirname, 'logs');

module.exports = {
  apps: [
    {
      name: 'brand-central-api',
      script: './server.js',
      cwd,
      // Cluster mode: one worker per CPU core — spreads load & prevents single-process heap blowups.
      // Instance 0 runs schedulers/background jobs; all others serve API only (see server.js).
      instances: 'max',
      exec_mode: 'cluster',

      // Memory guardrails
      max_memory_restart: '2G',           // Restart any worker crossing 2GB RSS
      node_args: '--max-old-space-size=4096',

      env: {
        NODE_ENV: isProduction ? 'production' : 'development',
        PORT: 3001,
        // Cap SQL pool per worker — with N cluster workers the previous
        // default (200/worker) could reach N×200 connections to the remote
        // SQL Server, causing connection saturation + worker memory spikes.
        DB_POOL_MAX: 40,
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
  ],
};
