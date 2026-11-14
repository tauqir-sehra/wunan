// Home's "due back" window (007 FR-004, research §3) with a fixed clock: from the start of the
// community's day two days before the due day, and while late.
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { arrangement } from '../db/schema/index.ts';
import { startOfLocalDay } from '../lib/time.ts';
import { agree, completeDetails, createFounder, createInvitedMember, createOffering, signIn } from '../test/setup.ts';
import { homeFor } from './home.ts';

describe('startOfLocalDay', () => {
  it('is midnight in the community, plus whole days', () => {
    const tuesdayEvening = new Date(2026, 10, 17, 21, 30);
    expect(startOfLocalDay(tuesdayEvening)).toEqual(new Date(2026, 10, 17));
    expect(startOfLocalDay(tuesdayEvening, 3)).toEqual(new Date(2026, 10, 20));
    // Across the end of the month.
    expect(startOfLocalDay(new Date(2026, 10, 30, 8), 2)).toEqual(new Date(2026, 11, 2));
  });
});

describe('due back window', () => {
  it('shows a loan due Thursday 10:00 from Tuesday morning, not on Monday', async () => {
    const fay = await createFounder('Fay');
    const sam = await createInvitedMember(fay, 'Sam');
    const [fayToken, samToken] = await Promise.all([signIn(fay), signIn(sam)]);
    const drill = await createOffering(fayToken, { type: 'lend', title: 'Drill' });
    const { arrangementId } = await agree(fayToken, samToken, drill.id, completeDetails('lend'));
    const thursday10 = new Date(2026, 10, 19, 10, 0);
    await db
      .update(arrangement)
      .set({ loanStartsAt: new Date(2026, 10, 10, 10, 0), loanEndsAt: thursday10 })
      .where(eq(arrangement.id, arrangementId));

    const listed = async (now: Date) => (await homeFor(sam.id, now)).dueBack.map((d) => d.arrangementId);
    expect(await listed(new Date(2026, 10, 16, 23, 59))).toEqual([]); // Monday 16 November, night
    expect(await listed(new Date(2026, 10, 17, 0, 1))).toEqual([arrangementId]); // Tuesday 17, just after midnight
    expect(await listed(new Date(2026, 10, 19, 9, 0))).toEqual([arrangementId]); // Thursday
    expect(await listed(new Date(2026, 10, 25))).toEqual([arrangementId]); // late, still for the borrower
  });
});
