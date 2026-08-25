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

// Sanitize a string: strip HTML + dangerous chars, trim
const sanitizeString = (input) => {
  if (typeof input !== 'string') return input;
  return stripHtml(input)
    .replace(/[<>]/g, '')         // residual angle brackets
    .replace(/\{/g, '(')          // prevent JSON injection
    .replace(/\}/g, ')')
    .replace(/`/g, "'")           // prevent template literal injection
    .trim();
};

// SECURITY: credential fields are exempt from sanitization. Mangling {, },
// backticks etc. here made such characters impossible at login for passwords
// that were accepted at creation on un-sanitized paths (reset/with-otp).
// Passwords are never rendered as HTML — they are only bcrypt-compared.
const RAW_PASSTHROUGH_FIELDS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'confirmpassword',
]);

// Deep sanitize an object (all string values)
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (RAW_PASSTHROUGH_FIELDS.has(String(key).toLowerCase())) {
      sanitized[key] = value; // verbatim — never mangle credentials
      continue;
    }
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(v => typeof v === 'string' ? sanitizeString(v) : v);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

module.exports = { sanitizeString, sanitizeObject, stripHtml };
