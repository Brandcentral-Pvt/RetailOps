// PM2 Ecosystem Config — Windows Production Deployment
// Usage: pm2 start ecosystem.config.js
// Cluster mode: one worker per CPU core (server.js already runs the
// scheduler/background jobs ONLY on worker [0], see server.js).

module.exports = {
  apps: [
    {
      name: 'brand-central-api',
      script: './server.js',
      cwd: 'F:/Retailops/RetailOps/backend',
      instances: 'max', // one worker per CPU core (6 on this box)
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      node_args: '--max-old-space-size=4096',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        // Cap SQL pool per worker — with 6 cluster workers the previous
        // default (200/worker) could reach 1200 connections to the remote
        // SQL Server, causing connection saturation + worker memory spikes.
        DB_POOL_MAX: 40,
        DB_POOL_MIN: 5,
      },
      // Restart policies
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 5000,
      // Logging
      error_file: 'F:/Retailops/RetailOps/logs/api-error.log',
      out_file: 'F:/Retailops/RetailOps/logs/api-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Watch disabled in production
      watch: false,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Auto-restart on crash
      autorestart: true,
    },
  ],
};
