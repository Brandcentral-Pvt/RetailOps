/**
 * Input Sanitization Utility
 * Strips HTML tags, script tags, and dangerous special characters
 */

// Strip HTML tags (including encoded variants)
const stripHtml = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/<[^>]*>/gi, '')                    // HTML tags
    .replace(/&lt;|&gt;|&amp;|&quot;|&#x27;/gi, '') // Encoded tags
    .replace(/javascript:/gi, '')                 // javascript: URIs
    .replace(/on\w+\s*=/gi, '')                  // Event handlers
    .replace(/data:/gi, '')                       // data: URIs
    .trim();
};

// Field names whose values are JSON / serialized objects / free-form text.
// These MUST NOT have their `{}` stripped or they become unparseable.
const JSON_FIELDS = new Set([
  'rules', 'conditions', 'actions', 'scope', 'lastRunSummary', 'summary',
  'subTasks', 'tags', 'asins', 'metadata', 'sop', 'config', 'filters',
  'description', 'message', 'notes', 'errorMessage',
]);

// Sanitize a string: strip HTML + dangerous chars, trim
const sanitizeString = (input) => {
  if (typeof input !== 'string') return input;
  return stripHtml(input)
    .replace(/[<>]/g, '')         // residual angle brackets
    .replace(/`/g, "'")           // prevent template literal injection
    .trim();
};

// Sanitize a string that may contain JSON (preserve braces/brackets/quotes)
const sanitizeJsonString = (input) => {
  if (typeof input !== 'string') return input;
  // Only strip HTML tags / event handlers — do not touch JSON punctuation.
  return stripHtml(input).trim();
};

// Deep sanitize an object (all string values)
const sanitizeObject = (obj, keyHint = null) => {
  if (!obj || typeof obj !== 'object') return obj;
  // Arrays: sanitize string items; recurse into objects
  if (Array.isArray(obj)) {
    return obj.map((v) => {
      if (typeof v === 'string') {
        // If parent key is a JSON field, preserve JSON punctuation for items too
        return JSON_FIELDS.has(keyHint) ? sanitizeJsonString(v) : sanitizeString(v);
      }
      if (v && typeof v === 'object') return sanitizeObject(v, keyHint);
      return v;
    });
  }
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const isJsonField = JSON_FIELDS.has(key);
    if (typeof value === 'string') {
      sanitized[key] = isJsonField ? sanitizeJsonString(value) : sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(v => {
        if (typeof v === 'string') return isJsonField ? sanitizeJsonString(v) : sanitizeString(v);
        if (v && typeof v === 'object') return sanitizeObject(v, key);
        return v;
      });
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, key);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

module.exports = { sanitizeString, sanitizeObject, stripHtml };
