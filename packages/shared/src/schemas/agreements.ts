// Agreements (001 FR-025, FR-026; 002 FR-018 to FR-021): made when a lister accepts a proposal.
// An agreement is confirmed from the start; owners mark loans returned.
import { z } from 'zod';
import { memberRef } from './common.ts';
import { Handover, OfferingType, SessionLengthUnit, Unit } from './offerings.ts';
import { PlaceView } from './places.ts';

export const AgreementOutcome = z.enum(['lent', 'gifted', 'traded', 'provided']);
/** How the agreement looks from my side, for grouping my history. */
export const AgreementGroup = z.enum(['given', 'received', 'lent', 'borrowed', 'provided']);

export const AgreementOfferSnapshot = z.object({
  items: z.array(z.object({ description: z.string(), amount: z.string().nullable(), unit: Unit.nullable() })),
  own: z.object({ description: z.string(), amount: z.string().nullable(), unit: Unit.nullable() }).nullable()
});
export type AgreementOfferSnapshot = z.infer<typeof AgreementOfferSnapshot>;

export const Agreement = z.object({
  id: z.string(),
  proposalId: z.string(),
  offering: z.object({ id: z.string(), title: z.string(), type: OfferingType, unit: Unit.nullable() }),
  owner: memberRef,
  otherMember: memberRef,
  outcome: AgreementOutcome,
  startsAt: z.string().nullable(),
  hasTime: z.boolean(),
  handover: Handover.nullable(),
  /** In full for the two members and mediators. */
  place: PlaceView.nullable(),
  amount: z.string().nullable(),
  sessions: z.number().nullable(),
  sessionLength: z.number().nullable(),
  sessionLengthUnit: SessionLengthUnit.nullable(),
  loanStartsAt: z.string().nullable(),
  loanEndsAt: z.string().nullable(),
  offer: AgreementOfferSnapshot.nullable(),
  returnedAt: z.string().nullable(),
  createdAt: z.string(),
  myRole: z.enum(['owner', 'other', 'mediator']),
  group: AgreementGroup.nullable(),
  overdue: z.boolean(),
  /** For a loan: an earlier loan of the same item is past its end and not marked returned (single endpoint). */
  earlierLoanNotBack: z.object({ endsAt: z.string() }).nullable().optional(),
  /** Requests for help about this agreement (only on the single-agreement endpoint). */
  reports: z.array(z.object({ id: z.string(), status: z.enum(['open', 'resolved']), outcomeNote: z.string().nullable() })).optional()
});
export type Agreement = z.infer<typeof Agreement>;
