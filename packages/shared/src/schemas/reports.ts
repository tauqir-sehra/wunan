// Asking for help with an agreement (FR-027 to FR-029b).
import { z } from 'zod';
import { memberRef } from './common.ts';

export const CreateReport = z.object({
  description: z
    .string({ message: 'Please describe what happened.' })
    .trim()
    .min(1, 'Please describe what happened.')
    .max(2000, 'Please keep this to 2000 characters or fewer.')
});

export const ResolveReport = z.object({
  outcomeNote: z
    .string({ message: 'Please write a short note about how it was settled.' })
    .trim()
    .min(1, 'Please write a short note about how it was settled.')
    .max(1000, 'Please keep the note to 1000 characters or fewer.')
});

export const EscalationLevel = z.enum(['inviter', 'inviters_inviter', 'founders']);

export const ProblemReport = z.object({
  id: z.string(),
  agreementId: z.string(),
  listingTitle: z.string(),
  description: z.string(),
  status: z.enum(['open', 'resolved']),
  escalationLevel: EscalationLevel,
  outcomeNote: z.string().nullable(),
  reporter: memberRef,
  reportedMember: memberRef,
  mediators: z.array(memberRef),
  conversationId: z.string(),
  /** The reporter or reported member let the mediators read the proposal's messages (002 FR-022a). */
  proposalMessagesShared: z.boolean(),
  proposalConversationId: z.string().nullable(),
  canShareProposalMessages: z.boolean(),
  canEscalate: z.boolean(),
  canResolve: z.boolean(),
  createdAt: z.string()
});
export type ProblemReport = z.infer<typeof ProblemReport>;
