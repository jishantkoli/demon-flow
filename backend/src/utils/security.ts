import crypto from 'crypto';

/**
 * Escapes special regex characters in a string to prevent ReDoS attacks.
 * Must be used before passing user input to `new RegExp()`.
 */
export const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Generates a cryptographically secure random token.
 * Replaces Math.random() which is NOT cryptographically secure.
 * @param bytes - Number of random bytes (default 32 = 64 hex chars)
 */
export const generateSecureToken = (bytes: number = 32): string => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Generates a cryptographically secure shareable link slug.
 * Uses URL-safe base64 encoding for shorter, readable slugs.
 * @param bytes - Number of random bytes (default 12 = ~16 chars)
 */
export const generateSecureSlug = (bytes: number = 12): string => {
  return crypto.randomBytes(bytes).toString('base64url');
};

/**
 * Basic XSS sanitization — strips HTML tags and dangerous patterns.
 * For use on user-provided text fields before storage.
 */
export const sanitizeText = (input: string): string => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')  // Remove iframe tags
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')   // Remove inline event handlers (double quotes)
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')   // Remove inline event handlers (single quotes)
    .replace(/javascript\s*:/gi, '')          // Remove javascript: URIs
    .replace(/data\s*:\s*text\/html/gi, ''); // Remove data:text/html URIs
};

/**
 * Sanitize an object's string values recursively (1 level deep).
 * Used on request bodies before processing.
 */
export const sanitizeObject = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized: any = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      sanitized[key] = sanitizeText(val);
    } else if (Array.isArray(val)) {
      sanitized[key] = val.map(item => typeof item === 'string' ? sanitizeText(item) : item);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
};
