// PM2 Ecosystem Config — Production (/var/www/retail-ops)
// Usage: cd /var/www/retail-ops/backend && pm2 start ecosystem.config.js
// Recovery: the stale boilerplate (brand-central template) was replaced with this.

const path = require('path');

const LOG_DIR = '/var/www/retail-ops/logs';

module.exports = {
  apps: [
    {
      name: 'retailops-api',
      script: './server.js',
      cwd: '/var/www/retail-ops/backend',
      instances: 4,
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      node_args: '--max-old-space-size=1536',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DB_POOL_MAX: 80,
        DB_POOL_MIN: 5,
      },
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      error_file: `${LOG_DIR}/api-error.log`,
      out_file: `${LOG_DIR}/api-out.log`,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      watch: false,
      time: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      wait_ready: false,
      autorestart: true,
    },
    {
      name: 'grownext',
      script: 'npx',
      args: 'next start',
      cwd: '/var/www/grownext.in',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_TELEMETRY_DISABLED: 1,
      },
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      error_file: `${LOG_DIR}/grownext-error.log`,
      out_file: `${LOG_DIR}/grownext-out.log`,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      watch: false,
      time: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      wait_ready: false,
      autorestart: true,
    },
  ],
};