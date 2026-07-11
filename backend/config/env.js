const requiredEnvVars = [
  'DB_USER',
  'DB_PASSWORD',
  'DB_SERVER',
  'JWT_SECRET'
];

const missing = requiredEnvVars.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy backend/.env.example to backend/.env and fill in your values');
  process.exit(1);
}

module.exports = {
  port: parseInt(process.env.PORT || '3001', 10),
  db: {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME || 'retailops',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    options: {
      encrypt: true,
      trustServerCertificate: false,
      enableArithAbort: true,
      useUTC: false
    },
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '50', 10),
      min: parseInt(process.env.DB_POOL_MIN || '5', 10),
      idleTimeoutMillis: 10000
    },
    requestTimeout: 120000,
    connectionTimeout: 60000
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    expiresIn: '2h',
    refreshExpiresIn: '7d'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  marketSync: {
    username: process.env.MARKET_SYNC_USERNAME,
    password: process.env.MARKET_SYNC_PASSWORD,
    apiKey: process.env.MARKET_SYNC_API_KEY
  },
  ai: {
    openaiKey: process.env.OPENAI_API_KEY,
    perplexityKey: process.env.PERPLEXITY_API_KEY,
    nimKey: process.env.NIM_API_KEY
  },
  octoparse: {
    apiKey: process.env.OCTOPARSE_API_KEY
  }
};
