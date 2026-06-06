// Problem reports: asking for help with an agreement (FR-027 to FR-029b). Help comes from the
// invite chain in a shared conversation. A report never changes anyone's access or visibility.
import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { agreement } from './agreements.ts';
import { member } from './members.ts';

/** inviter → inviters_inviter → founders (the last step). */
export const escalationLevel = pgEnum('escalation_level', ['inviter', 'inviters_inviter', 'founders']);
/** A report may stay open indefinitely; nobody is penalised either way. */
export const reportStatus = pgEnum('report_status', ['open', 'resolved']);

export const problemReport = pgTable(
  'problem_report',
  {
    id: uuid().primaryKey().defaultRandom(),
    agreementId: uuid()
      .notNull()
      .references(() => agreement.id),
    reporterId: uuid()
      .notNull()
      .references(() => member.id),
    reportedMemberId: uuid()
      .notNull()
      .references(() => member.id),
    description: text().notNull(),
    escalationLevel: escalationLevel().notNull().default('inviter'),
    status: reportStatus().notNull().default('open'),
    outcomeNote: text(),
    resolvedById: uuid().references(() => member.id),
    /** Set once when the reporter or reported member lets the mediators read the proposal's messages. */
    proposalMessagesSharedAt: timestamp({ withTimezone: true }),
    proposalMessagesSharedById: uuid().references(() => member.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('problem_report_description_length', sql`char_length(${t.description}) between 1 and 2000`),
    check('problem_report_outcome_length', sql`${t.outcomeNote} is null or char_length(${t.outcomeNote}) <= 1000`),
    check('problem_report_resolved_has_note', sql`${t.status} <> 'resolved' or ${t.outcomeNote} is not null`),
    index('problem_report_agreement_idx').on(t.agreementId)
  ]
);
