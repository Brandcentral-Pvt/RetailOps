const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const asyncLocalStorage = require('./asyncStorage');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../logs');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const REQUEST_ID_PREFIX = process.env.REQUEST_ID_PREFIX || 'retailops';
const PRETTY_PRINT = process.env.LOG_PRETTY !== 'false';

const customLevels = {
  levels: { fatal: 0, error: 1, warn: 2, info: 3, debug: 4, trace: 5 },
  colors: { fatal: 'red', error: 'red', warn: 'yellow', info: 'cyan', debug: 'blue', trace: 'gray' },
};

const formatRequestId = () => {
  const store = asyncLocalStorage.getStore();
  if (!store) return '';
  const rid = store.requestId;
  const userId = store.userId || '-';
  return rid ? `[${rid}][${userId}]` : '';
};

const getCaller = () => {
  const stack = new Error().stack.split('\n');
  // Skip winston internals + this function
  for (const line of stack.slice(3)) {
    const match = line.match(/at\s+(.+)\s+\((.+):(\d+):(\d+)\)/) || line.match(/at\s+(.+):(\d+):(\d+)/);
    if (match && !match[0].includes('winston') && !match[0].includes('logger') && !match[0].includes('asyncLocalStorage')) {
      const file = match[2] ? path.basename(match[2]) : match[1];
      const line = match[3] || match[2];
      return file && line ? `[${file}:${line}]` : '';
    }
  }
  return '';
};

const formatMeta = (meta) => {
  if (!meta || Object.keys(meta).length === 0) return '';
  try {
    return PRETTY_PRINT ? ` ${JSON.stringify(meta, null, 2)}` : ` ${JSON.stringify(meta)}`;
  } catch {
    return ` [Object]`;
  }
};

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, requestId, service, ...meta }) => {
    const rid = requestId || formatRequestId();
    const caller = getCaller();
    const metaStr = formatMeta(meta);
    const levelStr = level.toUpperCase().padEnd(6);
    const serviceStr = service ? `[${service}]` : '';
    const parts = [
      `\x1b[90m${timestamp}\x1b[0m`,
      levelStr,
      serviceStr,
      rid ? `\x1b[90m${rid}\x1b[0m` : '',
      caller ? `\x1b[90m${caller}\x1b[0m` : '',
      message,
      metaStr,
    ].filter(Boolean);
    return parts.join(' ');
  }),
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS Z' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, requestId, service, ...meta }) => {
    const rid = requestId || formatRequestId();
    const metaStr = formatMeta(meta);
    const serviceStr = service ? `[${service}]` : '';
    return `${timestamp} ${level.toUpperCase().padEnd(6)} ${serviceStr} ${rid} ${message}${metaStr}`;
  }),
);

const transports = [];

transports.push(new winston.transports.Console({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.colorize({ colors: customLevels.colors, all: true }),
    consoleFormat,
  ),
}));

transports.push(new DailyRotateFile({
  level: 'debug',
  filename: path.join(LOG_DIR, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '100m',
  maxFiles: '30d',
  format: fileFormat,
  zippedArchive: true,
}));

transports.push(new DailyRotateFile({
  level: 'error',
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '100m',
  maxFiles: '90d',
  format: fileFormat,
  zippedArchive: true,
}));

transports.push(new DailyRotateFile({
  level: 'fatal',
  filename: path.join(LOG_DIR, 'fatal-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '365d',
  format: fileFormat,
  zippedArchive: true,
}));

const logger = winston.createLogger({
  levels: customLevels.levels,
  level: LOG_LEVEL,
  transports,
  exitOnError: false,
});

const createChild = (meta = {}) => logger.child(meta);

module.exports = logger;

module.exports.middleware = (req, res, next) => {
  const store = asyncLocalStorage.getStore();
  if (!store) return next();
  store.requestId = store.requestId || `${REQUEST_ID_PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  store.userId = req.user?.Id || req.user?._id || '-';
  next();
};

module.exports.service = (serviceName) => logger.child({ service: serviceName });
module.exports.createChild = createChild;