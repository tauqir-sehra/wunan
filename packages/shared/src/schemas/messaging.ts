// Messages, contact sharing, and call times (FR-018 to FR-020).
import { z } from 'zod';
import { memberRef } from './common.ts';

export const StartConversation = z.object({
  memberId: z.uuid({ message: 'That member could not be found.' }),
  listingId: z.uuid().nullish()
});

export const SendMessage = z.object({
  body: z
    .string({ message: 'Please write a message.' })
    .trim()
    .min(1, 'Please write a message.')
    .max(4000, 'Please keep your message to 4000 characters or fewer.')
});

export const ShareContact = z
  .object({ phone: z.boolean().default(false), email: z.boolean().default(false) })
  .refine((value) => value.phone || value.email, { message: 'Please choose what to share.', path: ['phone'] });

export const ProposeCall = z.object({
  proposedTime: z.iso.datetime({ offset: true, message: 'Please choose a date and time.' })
});

export const MessageKind = z.enum(['text', 'contact_shared', 'call_proposed', 'call_accepted', 'system']);

export const Message = z.object({
  id: z.string(),
  conversationId: z.string(),
  kind: MessageKind,
  body: z.string(),
  proposedTime: z.string().nullable(),
  /** For call proposals: whether the other person has accepted it. */
  accepted: z.boolean(),
  createdAt: z.string(),
  author: memberRef.nullable()
});
export type Message = z.infer<typeof Message>;

export const ConversationSummary = z.object({
  id: z.string(),
  participants: z.array(memberRef),
  listing: z.object({ id: z.string(), title: z.string() }).nullable(),
  isMediation: z.boolean(),
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
  unreadConversations: z.number(),
  agreementsNeedingAttention: z.number(),
  unseenFlags: z.number()
});
export type Summary = z.infer<typeof Summary>;
