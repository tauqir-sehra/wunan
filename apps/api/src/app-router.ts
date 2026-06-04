// Creates a Hono router whose request-validation failures use wunan's error shape.
// Every route file builds its routes on one of these; app.ts mounts them under /api/v1.
import { OpenAPIHono } from '@hono/zod-openapi';
import { validationError } from './lib/errors.ts';
import type { AppEnv } from './lib/require-member.ts';

export function createRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result) => {
      if (!result.success) throw validationError(result.error);
    }
  });
}
