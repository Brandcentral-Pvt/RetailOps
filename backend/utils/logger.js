const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const asyncLocalStorage = require('./asyncStorage');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../logs');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const REQUEST_ID_PREFIX = process.env.REQUEST_ID_PREFIX || 'retailops';

const customLevels = {
  levels: { fatal: 0, error: 1, warn: 2, info: 3, debug: 4, trace: 5 },
  colors: { fatal: 'red', error: 'red', warn: 'yellow', info: 'green', debug: 'blue', trace: 'gray' },
};

const formatRequestId = () => {
  const store = asyncLocalStorage.getStore();
  if (!store) return '';
  const rid = store.requestId;
  const userId = store.userId || '-';
  return rid ? `[${rid}][${userId}]` : '';
};

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS Z' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
    const rid = requestId || formatRequestId();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level.toUpperCase().padEnd(6)} ${rid} ${message}${metaStr}`;
  }),
);

const transports = [];

transports.push(new winston.transports.Console({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.colorize({ colors: customLevels.colors }),
    logFormat,
  ),
}));

transports.push(new DailyRotateFile({
  level: 'debug',
  filename: path.join(LOG_DIR, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '100m',
  maxFiles: '30d',
  format: logFormat,
  zippedArchive: true,
}));

transports.push(new DailyRotateFile({
  level: 'error',
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '100m',
  maxFiles: '90d',
  format: logFormat,
  zippedArchive: true,
}));

transports.push(new DailyRotateFile({
  level: 'fatal',
  filename: path.join(LOG_DIR, 'fatal-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '365d',
  format: logFormat,
  zippedArchive: true,
}));

const logger = winston.createLogger({
  levels: customLevels.levels,
  level: LOG_LEVEL,
  transports,
  exitOnError: false,
});

const child = (meta = {}) => logger.child(meta);

logger.child = child;

module.exports = logger;

module.exports.middleware = (req, res, next) => {
  const store = asyncLocalStorage.getStore();
  if (!store) return next();
  store.requestId = store.requestId || `${REQUEST_ID_PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  store.userId = req.user?.Id || req.user?._id || '-';
  next();
};
