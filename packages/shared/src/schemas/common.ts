// Small building blocks used by several schemas, each with a plain-language message.
import { z } from 'zod';

export const id = z.uuid({ message: 'That link is not valid.' });

export const email = z
  .string({ message: 'Please enter your email address.' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Please enter a valid email address, like name@example.org.' }));

export const password = z
  .string({ message: 'Please choose a password.' })
  .min(10, 'Please choose a password of at least 10 characters.')
  .max(128, 'Please choose a password of at most 128 characters.');

/** Optional text: trims it, and treats an empty box as "not given". */
export function optionalText(max: number, tooLong: string) {
  return z
    .string()
    .trim()
    .max(max, tooLong)
    .nullish()
    .transform((value) => (value ? value : null));
}

export const memberRef = z.object({ id: z.string(), displayName: z.string() });
export type MemberRef = z.infer<typeof memberRef>;
