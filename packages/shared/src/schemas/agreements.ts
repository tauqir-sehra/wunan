// Agreements (FR-022 to FR-026): recorded by a listing's owner with another member.
import { z } from 'zod';
import { memberRef, optionalText } from './common.ts';
import { ListingType, Unit } from './listings.ts';

export const CreateAgreement = z.object({
  otherMemberId: z.uuid({ message: 'Please choose who you agreed with.' }),
  /** Gift/Trade with an amount: how much of it. */
  amount: z
    .union([z.number(), z.string().trim()])
    .transform((value) => String(value).replace(',', '.'))
    .refine((value) => /^\d{1,9}(\.\d{1,3})?$/.test(value) && Number(value) > 0, { message: 'Please enter a number above 0, like 2 or 2.5.' })
    .nullish(),
  /** Lend: when it should come back (YYYY-MM-DD). */
  returnDue: z.iso.date({ message: 'Please choose the return date.' }).nullish(),
  /** Service: how many sessions (default 1). */
  sessions: z.coerce.number({ message: 'Please enter a whole number of 1 or more.' }).int('Please enter a whole number of 1 or more.').min(1, 'Please enter a whole number of 1 or more.').nullish(),
  note: optionalText(500, 'Please keep the note to 500 characters or fewer.')
});
export type CreateAgreement = z.infer<typeof CreateAgreement>;

export const AgreementOutcome = z.enum(['lent', 'gifted', 'traded', 'provided']);
export const AgreementConfirmation = z.enum(['pending', 'confirmed', 'disputed', 'cancelled']);
/** How the agreement looks from my side, for grouping my history. */
export const AgreementGroup = z.enum(['given', 'received', 'lent', 'borrowed', 'provided']);

export const Agreement = z.object({
  id: z.string(),
  listing: z.object({ id: z.string(), title: z.string(), type: ListingType, unit: Unit.nullable() }),
  owner: memberRef,
  otherMember: memberRef,
  outcome: AgreementOutcome,
  amount: z.string().nullable(),
  sessions: z.number().nullable(),
  returnDue: z.string().nullable(),
  returnedAt: z.string().nullable(),
  confirmation: AgreementConfirmation,
  note: z.string().nullable(),
  createdAt: z.string(),
  myRole: z.enum(['owner', 'other', 'mediator']),
  group: AgreementGroup.nullable(),
  overdue: z.boolean(),
  /** Requests for help about this agreement (only on the single-agreement endpoint). */
  reports: z.array(z.object({ id: z.string(), status: z.enum(['open', 'resolved']), outcomeNote: z.string().nullable() })).optional()
});
export type Agreement = z.infer<typeof Agreement>;

export const AgreementCandidate = memberRef;
