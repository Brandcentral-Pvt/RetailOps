// PM2 Ecosystem Config — Production Deployment
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'brand-central-api',
      script: './server.js',
      cwd: 'G:\\Brandcentral Development\\RetailOps_V2.1\\RetailOps_V2.1\\retail-ops\\backend',
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      node_args: '--max-old-space-size=4096',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // Restart policies
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 3000,
      // Logging
      error_file: '/opt/brand-central/logs/api-error.log',
      out_file: '/opt/brand-central/logs/api-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Watch disabled in production
      watch: false,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Auto-restart on file changes (disabled in prod)
      autorestart: true,
      // Cluster settings
      env: {
        NODE_APP_INSTANCE: 0,
      },
    },
  ],
};
