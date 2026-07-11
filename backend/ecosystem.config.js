// PM2 Ecosystem Config — Production Deployment
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'brand-central-api',
      script: './server.js',
      cwd: '/opt/brand-central/backend',
      instances: 1, // Single instance (stateful sessions)
      exec_mode: 'fork',
      max_memory_restart: '3G',
      node_args: '--max-old-space-size=4096',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // Restart policies
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 5000,
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
    },
  ],
};
