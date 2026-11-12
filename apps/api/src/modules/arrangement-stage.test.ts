// Stage, "needs me", grouping and the timeline are pure, so they're tested without a database.
import { describe, expect, it } from 'vitest';
import { groupOf, needsMe, stageOf, timelineOf, type Note } from './arrangement-stage.ts';

const day = 86_400_000;
const now = new Date('2030-03-10T12:00:00Z');
const at = (days: number) => new Date(now.getTime() + days * day);
const facts = (over: Partial<Parameters<typeof stageOf>[0]> = {}) => ({ status: 'open' as const, loanStartsAt: null, loanEndsAt: null, returnedAt: null, doneAt: null, ...over });
const loan = (start: number, end: number, over = {}) => facts({ status: 'agreed', loanStartsAt: at(start), loanEndsAt: at(end), ...over });
const sam = { id: 's', displayName: 'Sam' };
const fay = { id: 'f', displayName: 'Fay' };

describe('stage', () => {
  it('follows the status, the loan dates, and what was marked', () => {
    expect(stageOf(facts(), now)).toBe('arranging');
    expect(stageOf(loan(1, 3), now)).toBe('agreed');
    expect(stageOf(loan(-1, 3), now)).toBe('on_loan');
    expect(stageOf(loan(-5, -1), now)).toBe('on_loan');
    expect(stageOf(loan(-5, -1, { returnedAt: at(-1) }), now)).toBe('returned');
    expect(stageOf(facts({ status: 'agreed' }), now)).toBe('agreed');
    expect(stageOf(facts({ status: 'agreed', doneAt: at(-1) }), now)).toBe('done');
    for (const status of ['declined', 'withdrawn', 'closed'] as const) expect(stageOf(facts({ status }), now)).toBe('ended');
  });
});

describe('needs me', () => {
  const quiet = { unreadFromOther: false };
  const missing = [{ field: 'date' }];

  it('is the requester while details are missing, and the lister once nothing is', () => {
    expect(needsMe(facts(), { role: 'requester', ...quiet }, missing, now)).toBe(true);
    expect(needsMe(facts(), { role: 'lister', ...quiet }, missing, now)).toBe(false);
    expect(needsMe(facts(), { role: 'requester', ...quiet }, [], now)).toBe(false);
    expect(needsMe(facts(), { role: 'lister', ...quiet }, [], now)).toBe(true);
    // A paused offering is nobody's detail to fill in.
    expect(needsMe(facts(), { role: 'requester', ...quiet }, [{ field: 'offering' }], now)).toBe(false);
    expect(needsMe(facts(), { role: 'lister', ...quiet }, [{ field: 'offering' }], now)).toBe(false);
  });

  it('is the owner of a loan only once it is past its due date', () => {
    expect(needsMe(loan(-2, 1), { role: 'lister', ...quiet }, [], now)).toBe(false);
    expect(needsMe(loan(-5, -1), { role: 'lister', ...quiet }, [], now)).toBe(true);
    expect(needsMe(loan(-5, -1), { role: 'requester', ...quiet }, [], now)).toBe(false);
    expect(needsMe(loan(-5, -1, { returnedAt: at(0) }), { role: 'lister', ...quiet }, [], now)).toBe(false);
  });

  it('never is, just because a gift was not marked as done or because it ended', () => {
    for (const role of ['requester', 'lister'] as const) {
      expect(needsMe(facts({ status: 'agreed' }), { role, ...quiet }, [], now)).toBe(false);
      expect(needsMe(facts({ status: 'agreed', doneAt: at(-1) }), { role, ...quiet }, [], now)).toBe(false);
      expect(needsMe(facts({ status: 'declined' }), { role, ...quiet }, [], now)).toBe(false);
    }
  });

  it('always is, with an unread message from the other member', () => {
    for (const a of [facts(), facts({ status: 'agreed', doneAt: at(-1) }), facts({ status: 'declined' }), loan(1, 3)]) {
      expect(needsMe(a, { role: 'requester', unreadFromOther: true }, [], now)).toBe(true);
    }
  });
});

describe('group', () => {
  it('puts what needs me first, then finished stages under finished', () => {
    expect(groupOf('ended', true)).toBe('needsYou');
    expect(groupOf('arranging', false)).toBe('inProgress');
    expect(groupOf('agreed', false)).toBe('inProgress');
    expect(groupOf('on_loan', false)).toBe('inProgress');
    for (const stage of ['returned', 'done', 'ended'] as const) expect(groupOf(stage, false)).toBe('finished');
  });
});

describe('timeline', () => {
  const note = (kind: string, days: number, by: Note['by'] = sam): Note => ({ kind, at: at(days), by });
  const steps = (timeline: ReturnType<typeof timelineOf>) => timeline.map((s) => (s.at ? s.step : `${s.step}?`));

  it('lists what happened, oldest first, then what is still expected', () => {
    expect(steps(timelineOf([note('asked', -3)], facts()))).toEqual(['asked', 'agreed?']);
    const out = timelineOf([note('asked', -6), note('detail_changed', -5), note('accepted', -4, fay)], loan(-3, 2));
    expect(steps(out)).toEqual(['asked', 'details_changed', 'agreed', 'lent', 'due_back', 'returned?']);
    expect(out[2]).toMatchObject({ step: 'agreed', by: fay, at: at(-4).toISOString() });
    const back = timelineOf([note('asked', -6), note('accepted', -4, fay), note('returned', -1, fay)], loan(-3, 2, { returnedAt: at(-1) }));
    expect(steps(back)).toEqual(['asked', 'agreed', 'lent', 'returned', 'due_back']);
  });

  it('shows only the latest detail change since the most recent ask', () => {
    const out = timelineOf([note('asked', -9), note('detail_changed', -8), note('detail_changed', -7), note('detail_changed', -6)], facts());
    expect(steps(out)).toEqual(['asked', 'details_changed', 'agreed?']);
    expect(out[1]!.at).toBe(at(-6).toISOString());
  });

  it('keeps an earlier ask and how it ended after asking again', () => {
    const notes = [note('asked', -9), note('detail_changed', -8), note('declined', -7, fay), note('asked', -2), note('detail_changed', -1)];
    expect(steps(timelineOf(notes, facts()))).toEqual(['asked', 'declined', 'asked', 'details_changed', 'agreed?']);
  });

  it('shows done with who marked it, and not at all once taken back', () => {
    const agreed = [note('asked', -5), note('accepted', -4, fay)];
    const done = timelineOf([...agreed, note('done', -1, sam)], facts({ status: 'agreed', doneAt: at(-1) }));
    expect(steps(done)).toEqual(['asked', 'agreed', 'done']);
    expect(done[2]!.by).toEqual(sam);
    const takenBack = timelineOf([...agreed, note('done', -2, sam), note('not_done', -1, fay)], facts({ status: 'agreed' }));
    expect(steps(takenBack)).toEqual(['asked', 'agreed', 'done?']);
  });

  it('includes requests for help and how they ended', () => {
    const out = timelineOf([note('asked', -5), note('accepted', -4, fay)], facts({ status: 'agreed' }), [
      { askedAt: at(-3), askedBy: sam, resolvedAt: at(-1), resolvedBy: fay }
    ]);
    expect(steps(out)).toEqual(['asked', 'agreed', 'help_asked', 'help_outcome', 'done?']);
  });

  it('carries only the step, the time, and who: never any text', () => {
    const out = timelineOf([note('asked', -1)], facts());
    expect(Object.keys(out[0]!).sort()).toEqual(['at', 'by', 'step']);
  });
});
