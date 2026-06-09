// Messages, contact sharing, and call times (001 FR-018 to FR-020). Every thread belongs to a
// proposal or a problem report (002 FR-022); there is no inbox and no starting a thread directly.
import { z } from 'zod';
import { memberRef } from './common.ts';

/** The most characters a private message can have. */
export const MESSAGE_LIMIT = 4000;

/**
 * One message: text, and anything added with "+": exactly the chosen saved contact details
 * (001 FR-019) and a suggested time to call (001 FR-020). At least one of them.
 */
export const SendMessage = z
  .object({
    body: z
      .string()
      .trim()
      .max(MESSAGE_LIMIT, `Please keep your message to ${MESSAGE_LIMIT} characters or fewer.`)
      .default(''),
    contact: z.object({ phone: z.boolean().default(false), email: z.boolean().default(false) }).optional(),
    proposedTime: z.iso.datetime({ offset: true, message: 'Please choose a day and a time.' }).optional()
  })
  .refine((v) => v.body || v.contact?.phone || v.contact?.email || v.proposedTime, {
    message: 'Please write a message.',
    path: ['body']
  });
export type SendMessage = z.infer<typeof SendMessage>;

export const MessageKind = z.enum([
  'text',
  'call_accepted',
  'system',
  // Written by the API when a proposal changes (002 FR-016, FR-020, FR-022a).
  'detail_changed',
  'accepted',
  'declined',
  'withdrawn',
  'closed',
  'messages_shared'
]);

export const Message = z.object({
  id: z.string(),
  conversationId: z.string(),
  kind: MessageKind,
  body: z.string(),
  /** Contact details shared with this message, exactly as they were when sent. */
  contact: z.object({ phone: z.string().nullable(), email: z.string().nullable() }).nullable(),
  /** A suggested time to call (on a text message), or the time accepted (`call_accepted`). */
  proposedTime: z.string().nullable(),
  /** For suggested call times: whether the other person has accepted it. */
  accepted: z.boolean(),
  createdAt: z.string(),
  author: memberRef.nullable()
});
export type Message = z.infer<typeof Message>;

export const ConversationSummary = z.object({
  id: z.string(),
  participants: z.array(memberRef),
  offering: z.object({ id: z.string(), title: z.string() }).nullable(),
  isMediation: z.boolean(),
  proposalId: z.string().nullable(),
  /** False once its proposal is declined, withdrawn, or closed, or for mediators reading shared messages. */
  canWrite: z.boolean(),
  lastMessage: z.object({ preview: z.string(), createdAt: z.string(), author: memberRef.nullable() }).nullable(),
  unread: z.boolean()
});
export type ConversationSummary = z.infer<typeof ConversationSummary>;

export const MessagesPage = z.object({
  conversation: ConversationSummary,
  items: z.array(Message),
  nextCursor: z.string().nullable()
});
export type MessagesPage = z.infer<typeof MessagesPage>;

export const Summary = z.object({
  proposalsWithNews: z.number(),
  agreementsNeedingAttention: z.number(),
  unseenFlags: z.number(),
  /** Issues raised about my requests that I haven't seen (003 FR-022). */
  unseenRequestFlags: z.number()
});
export type Summary = z.infer<typeof Summary>;
