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
  // Place suggestions (research §1): a Photon server. Empty turns suggestions off.
  PLACES_URL: z.union([z.literal(''), z.string().url()]).optional().default('https://photon.komoot.io'),
  // Optional "lat,lon" so suggestions favour the community's own area.
  PLACES_BIAS: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'PLACES_BIAS must look like 51.5,-0.12')
    .optional()
    .or(z.literal('')),
  // Optional "minLon,minLat,maxLon,maxLat" to keep suggestions inside a box.
  PLACES_BBOX: z
    .string()
    .regex(/^(-?\d+(\.\d+)?,){3}-?\d+(\.\d+)?$/, 'PLACES_BBOX must look like -0.5,51.3,0.3,51.7')
    .optional()
    .or(z.literal('')),
  NODE_ENV: z.string().optional().default('development'),
  // Only for the browser tests, whose many sign-ins and joins all come from one address. Never set in production.
  E2E_RELAXED_LIMITS: z.enum(['true', 'false', '']).optional().transform((value) => value === 'true')
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
  SITE_URL: parsed.data.SITE_URL.replace(/\/+$/, ''),
  PLACES_URL: parsed.data.PLACES_URL.replace(/\/+$/, '')
};
