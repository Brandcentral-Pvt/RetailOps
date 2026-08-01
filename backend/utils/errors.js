class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource', id = null) {
    const msg = id ? `${resource} not found (${id})` : `${resource} not found`;
    super(msg, 404, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class AuthError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTH_ERROR');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMITED');
  }
}

class TransitionError extends AppError {
  constructor(fromStatus, toStatus) {
    super(`Invalid transition: ${fromStatus} → ${toStatus}`, 400, 'INVALID_TRANSITION');
  }
}

class DependencyError extends AppError {
  constructor(message = 'External service unavailable', details = null) {
    super(message, 502, 'DEPENDENCY_ERROR', details);
  }
}

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const requestId = req.requestId || req.headers?.['x-request-id'] || null;

  if (!err.isOperational || statusCode >= 500) {
    const logger = require('./logger');
    logger.error(`[${code}] ${err.message}`, {
      requestId,
      statusCode,
      code,
      url: req.originalUrl,
      method: req.method,
      userId: req.userId || req.user?.Id || null,
      stack: err.stack?.split('\n').slice(0, 6).join('|'),
    });
  }

  if (res.headersSent) return;

  const body = {
    success: false,
    error: err.message,
    code,
    requestId,
  };

  if (statusCode === 400 && err.details) {
    body.details = err.details;
  }

  if (process.env.NODE_ENV === 'development' && statusCode >= 500) {
    body.stack = err.stack?.split('\n').slice(0, 10);
  }

  res.status(statusCode).json(body);
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  AuthError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  TransitionError,
  DependencyError,
  errorHandler,
};
