// Public threads (003 FR-023): short messages on a request or an offering that every member can
// read and post in. Plain text, 1–240 characters. Only the author can remove their own.
import { z } from 'zod';
import { memberRef } from './common.ts';

export const PUBLIC_MESSAGE_LIMIT = 240;

export const PostPublicMessage = z.object({
  body: z
    .string({ message: 'Please write a message.' })
    .trim()
    .min(1, 'Please write a message.')
    .superRefine((value, ctx) => {
      if (value.length > PUBLIC_MESSAGE_LIMIT) {
        ctx.addIssue({ code: 'custom', message: `Please keep it to ${PUBLIC_MESSAGE_LIMIT} characters; this is ${value.length}.` });
      }
    })
});

export const PublicMessage = z.object({
  id: z.string(),
  author: memberRef,
  /** Empty when removed. */
  body: z.string(),
  removed: z.boolean(),
  createdAt: z.string(),
  mine: z.boolean(),
  /** Issues raised about it; only on the caller's own messages. */
  flags: z.array(z.object({ id: z.string(), request: z.string(), from: memberRef, createdAt: z.string() })).optional()
});
export type PublicMessage = z.infer<typeof PublicMessage>;

export const PublicThread = z.object({
  items: z.array(PublicMessage),
  /** There are older messages; ask with `?before=<first id>`. */
  hasEarlier: z.boolean(),
  canPost: z.boolean()
});
export type PublicThread = z.infer<typeof PublicThread>;

export const ThreadQuery = z.object({ before: z.uuid().optional() });
