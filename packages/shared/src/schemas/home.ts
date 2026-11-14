// Home (007): what needs the signed-in member right now, in four groups, and the body for saying a
// line on Home was pressed. Worked out by the API each time; see specs/007-home-needs-you/data-model.md.
import { z } from 'zod';
import { ArrangementSummary } from './arrangements.ts';
import { memberRef } from './common.ts';

const titled = z.object({ id: z.string(), title: z.string() });

/** A loan due back within 2 days, or late, for the borrower (requester) or lender (lister). */
export const DueBack = z.object({
  arrangementId: z.string(),
  myRole: z.enum(['requester', 'lister']),
  otherMember: memberRef,
  offering: titled,
  loanEndsAt: z.string(),
  overdue: z.boolean()
});
export type DueBack = z.infer<typeof DueBack>;

/** New offerings linked to one of my open requests that I haven't pressed on Home yet. */
export const OffersOnRequest = z.object({
  request: titled,
  count: z.number().int().min(1),
  /** Distinct, oldest first. */
  helpers: z.array(memberRef),
  firstOffering: titled,
  since: z.string()
});
export type OffersOnRequest = z.infer<typeof OffersOnRequest>;

/** Requests to change something about one of my offerings or requests, not pressed on Home yet. */
export const AskedToChange = z.object({
  subject: z.enum(['offering', 'request']),
  id: z.string(),
  title: z.string(),
  count: z.number().int().min(1),
  since: z.string()
});
export type AskedToChange = z.infer<typeof AskedToChange>;

export const Home = z.object({
  arrangements: z.array(ArrangementSummary),
  dueBack: z.array(DueBack),
  offers: z.array(OffersOnRequest),
  askedToChange: z.array(AskedToChange)
});
export type Home = z.infer<typeof Home>;

/** Which Home line was pressed. */
export const HomePressed = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('offers'), requestId: z.uuid() }),
  z.object({ kind: z.literal('askedToChange'), subject: z.enum(['offering', 'request']), id: z.uuid() })
]);
export type HomePressed = z.infer<typeof HomePressed>;
