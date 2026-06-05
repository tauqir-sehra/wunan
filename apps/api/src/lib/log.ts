// Structured JSON logs on stdout. By design, callers pass only operational fields:
// never emails, tokens, message bodies, contact details, or full URLs (constitution III).
type Fields = Record<string, string | number | boolean | null | undefined>;

// Safety net: drop any field whose name suggests personal data, even if a caller passes it.
const FORBIDDEN = /email|token|password|body|phone|contact|secret|authorization|cookie/i;

// Second net: error messages from other systems (e.g. a mail server's "550 <name@example.org>:
// recipient rejected") can contain email addresses; they are blanked out wherever they appear.
const EMAIL_ADDRESS = /[^\s<>"'(),;:@]+@[^\s<>"'(),;:@]+\.[a-z]{2,}/gi;

function write(level: 'info' | 'warn' | 'error', event: string, fields: Fields = {}) {
  const safe: Fields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (FORBIDDEN.test(key)) continue;
    safe[key] = typeof value === 'string' ? value.replace(EMAIL_ADDRESS, '[email]') : value;
  }
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...safe });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: Fields) => write('info', event, fields),
  warn: (event: string, fields?: Fields) => write('warn', event, fields),
  error: (event: string, fields?: Fields) => write('error', event, fields)
};
