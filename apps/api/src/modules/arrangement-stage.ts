// Where an arrangement stands (004 research §2, §3): its stage, whether it needs a member, which
// group of the list it belongs to, and its timeline. All worked out from stored facts and today's
// date, never stored, so nothing goes stale. Pure functions: no database access here.
import type { ArrangementStage, TimelineStep } from '@wunan/shared';

type Facts = {
  status: 'open' | 'agreed' | 'declined' | 'withdrawn' | 'closed';
  loanStartsAt: Date | null;
  loanEndsAt: Date | null;
  returnedAt: Date | null;
  doneAt: Date | null;
};

/** A loan past its end and not marked returned. Said to members as "It was due back …". */
export const isOverdue = (a: Facts, now = new Date()) => a.status === 'agreed' && a.loanEndsAt !== null && !a.returnedAt && a.loanEndsAt <= now;

/**
 * - open → `arranging`
 * - agreed loan → `agreed` before it starts, `on_loan` after, `returned` once marked
 * - agreed gift, trade or service → `agreed`, or `done` once a member marked it
 * - declined, withdrawn, closed → `ended`
 */
export function stageOf(a: Facts, now = new Date()): ArrangementStage {
  if (a.status === 'open') return 'arranging';
  if (a.status !== 'agreed') return 'ended';
  if (a.loanStartsAt) {
    if (a.returnedAt) return 'returned';
    return a.loanStartsAt <= now ? 'on_loan' : 'agreed';
  }
  return a.doneAt ? 'done' : 'agreed';
}

/**
 * Whether this member can or must do something (spec FR-003):
 * - an unread message from the other member (notes that wunan writes never count);
 * - the requester, while details they can fix are missing or don't fit;
 * - the lister, when nothing blocks accepting;
 * - the owner of a loan past its due date.
 * Never because a gift, trade or service hasn't been marked as done (FR-009a).
 */
export function needsMe(
  a: Facts,
  me: { role: 'requester' | 'lister'; unreadFromOther: boolean },
  issues: { field: string }[],
  now = new Date()
): boolean {
  if (me.unreadFromOther) return true;
  if (a.status === 'open') {
    // An offering that is paused or closed is nobody's detail to fill in.
    if (me.role === 'requester') return issues.some((issue) => issue.field !== 'offering');
    return issues.length === 0;
  }
  return me.role === 'lister' && isOverdue(a, now);
}

/** The list's three headings: "Waiting on you", "In progress", "Finished". */
export function groupOf(stage: ArrangementStage, needs: boolean): 'needsYou' | 'inProgress' | 'finished' {
  if (needs) return 'needsYou';
  return stage === 'returned' || stage === 'done' || stage === 'ended' ? 'finished' : 'inProgress';
}

type Person = { id: string; displayName: string };
/** A note wunan wrote in the arrangement's conversation: only what it was, when, and who did it. */
export type Note = { kind: string; at: Date; by: Person | null };
export type HelpRequest = { askedAt: Date; askedBy: Person | null; resolvedAt: Date | null; resolvedBy: Person | null };

const noteSteps: Record<string, TimelineStep['step']> = {
  asked: 'asked',
  accepted: 'agreed',
  declined: 'declined',
  withdrawn: 'withdrawn',
  closed: 'closed',
  returned: 'returned'
};

/**
 * What has happened, oldest first, then what is still expected (with `at: null`). Built from the
 * conversation's notes, the loan dates and requests for help; never from a note's text, so a helper
 * who may not read the messages learns nothing from it (FR-021a).
 * - "Details changed" shows once: the latest change since the most recent ask.
 * - "Done" that was later taken back isn't shown.
 * - After asking again, the earlier ask and how it ended stay.
 */
export function timelineOf(notes: Note[], a: Facts, help: HelpRequest[] = []): TimelineStep[] {
  type Dated = { step: TimelineStep['step']; at: Date; by: Person | null };
  const steps: Dated[] = [];
  let change: Dated | null = null;
  let done: Dated | null = null;
  const flushChange = () => {
    if (change) steps.push(change);
    change = null;
  };
  for (const note of [...notes].sort((x, y) => x.at.getTime() - y.at.getTime())) {
    if (note.kind === 'detail_changed') change = { step: 'details_changed', at: note.at, by: note.by };
    else if (note.kind === 'done') done = { step: 'done', at: note.at, by: note.by };
    else if (note.kind === 'not_done') done = null;
    else if (noteSteps[note.kind]) {
      // A change made before this step is kept with it; a new ask starts counting changes afresh,
      // so only the latest change since the most recent ask is ever shown.
      if (note.kind === 'asked') {
        change = null;
        for (let i = steps.length - 1; i >= 0; i -= 1) if (steps[i]!.step === 'details_changed') steps.splice(i, 1);
      } else flushChange();
      steps.push({ step: noteSteps[note.kind]!, at: note.at, by: note.by });
    }
  }
  flushChange();
  if (done && a.doneAt) steps.push(done);
  if (a.status === 'agreed' && a.loanStartsAt && a.loanEndsAt) {
    steps.push({ step: 'lent', at: a.loanStartsAt, by: null }, { step: 'due_back', at: a.loanEndsAt, by: null });
  }
  for (const request of help) {
    steps.push({ step: 'help_asked', at: request.askedAt, by: request.askedBy });
    if (request.resolvedAt) steps.push({ step: 'help_outcome', at: request.resolvedAt, by: request.resolvedBy });
  }
  // A stable sort keeps same-moment steps in the order they were added.
  steps.sort((x, y) => x.at.getTime() - y.at.getTime());

  const expected: TimelineStep['step'][] = [];
  if (a.status === 'open') expected.push('agreed');
  if (a.status === 'agreed' && a.loanStartsAt && !a.returnedAt) expected.push('returned');
  if (a.status === 'agreed' && !a.loanStartsAt && !a.doneAt) expected.push('done');
  return [
    ...steps.map((s) => ({ step: s.step, at: s.at.toISOString(), by: s.by })),
    ...expected.map((step) => ({ step, at: null, by: null }))
  ];
}
