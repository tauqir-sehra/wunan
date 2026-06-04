// Reads and checks the API's settings from environment variables once, at startup.
// A missing or malformed setting stops the API with a clear message instead of failing later.
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  DATA_ENCRYPTION_KEY: z
    .string()
    .refine((value) => Buffer.from(value, 'base64').length === 32, {
      message: 'DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)'
    }),
  SITE_URL: z.string().url(),
  API_PORT: z.coerce.number().int().positive().default(3000),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().min(1),
  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_SUBJECT: z.string().optional().default(''),
  PHOTOS_DIR: z.string().min(1).default('./photos'),
  NODE_ENV: z.string().optional().default('development')
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
  console.error(`wunan API settings are not valid:\n${problems.join('\n')}`);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  // Trailing slashes would produce links like "https://site//join/…".
  SITE_URL: parsed.data.SITE_URL.replace(/\/+$/, '')
};
