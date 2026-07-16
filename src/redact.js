// Auto-redaction middleware — strips common secrets from payload strings
// before they are saved to SQLite.

const PATTERNS = [
  // AWS access keys
  { regex: /AKIA[A-Z0-9]{16}/g, replacement: '[REDACTED:AWS_KEY]' },
  // AWS secret-looking long base64 strings next to "secret"
  { regex: /(aws_secret_access_key["\s:=]+)[A-Za-z0-9/+]{40}/gi, replacement: '$1[REDACTED]' },
  // Bearer tokens in JSON values or plain strings
  { regex: /(Bearer\s+)[A-Za-z0-9\-_.~+/]+=*/gi, replacement: '$1[REDACTED]' },
  // Private / certificate blocks
  { regex: /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, replacement: '[REDACTED:PRIVATE_KEY]' },
  // JSON fields: "password", "secret", "token", "api_key", "apiKey", "authorization"
  {
    regex: /"(password|secret|token|api_?key|auth(?:orization)?|private_?key)"(\s*:\s*)"[^"]{4,}"/gi,
    replacement: '"$1"$2"[REDACTED]"',
  },
  // Email addresses
  { regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, replacement: '[REDACTED:EMAIL]' },
  // Generic high-entropy looking tokens: 32+ hex chars
  { regex: /\b[0-9a-f]{32,64}\b/g, replacement: '[REDACTED:TOKEN]' },
];

/**
 * Redact known secret patterns from a string.
 * Returns { redacted: string, changed: boolean }
 */
export function redact(str) {
  if (!str || typeof str !== 'string') return { redacted: str, changed: false };
  let result = str;
  for (const { regex, replacement } of PATTERNS) {
    result = result.replace(regex, replacement);
  }
  return { redacted: result, changed: result !== str };
}
