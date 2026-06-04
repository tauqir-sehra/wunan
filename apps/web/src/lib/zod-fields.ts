// Turns a shared-schema validation failure into `{ field: "Plain message." }` for a form,
// matching what the API would answer (same schemas, same words).
import type { z } from 'zod';

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') continue;
    const name = issue.path.join('.') || 'form';
    fields[name] ??= issue.message.startsWith('Invalid') ? 'Please check this.' : issue.message;
  }
  return fields;
}
