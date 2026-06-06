// Return reminders (001 FR-025): once, the day after a loan's end, in the community's time zone.
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { eq } from 'drizzle-orm';
import { agreement, notificationPreference } from '../db/schema/index.ts';
import { localToInstant } from '../lib/time.ts';
import { testOutbox } from '../notify/email.ts';
import { agree, api, completeDetails, createFounder, createInvitedMember, createListing, signIn } from '../test/setup.ts';
import { runReminders } from './reminders.ts';

/** A loan due back on `returnDue` (local date, end of the day before it starts again). */
async function loan(returnDue: string) {
  const sam = await createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  for (const memberId of [sam.id, alex.id]) await db.insert(notificationPreference).values({ memberId, type: 'reminder', email: true });
  const token = await signIn(sam);
  const drill = await createListing(token, { type: 'lend', title: 'Drill' });
  const { agreementId } = await agree(token, await signIn(alex), drill.id, completeDetails('lend'));
  // Move the loan so it ends at noon on `returnDue`.
  const ends = localToInstant(returnDue, '12:00');
  await db.update(agreement).set({ loanStartsAt: new Date(ends.getTime() - 86_400_000), loanEndsAt: ends }).where(eq(agreement.id, agreementId));
  return { sam, alex, token, agreementId };
}
const reminders = () => testOutbox.filter((e) => e.subject === 'A reminder about the Drill');

describe('return reminders', () => {
  it('sends exactly one reminder to each member, however often it runs', async () => {
    const { sam, alex } = await loan('2020-01-01');
    await runReminders();
    await runReminders();
    expect(reminders().map((e) => e.to).sort()).toEqual([alex.email, sam.email].sort());
  });

  it('sends nothing for returned loans or loans not yet due', async () => {
    const { token, agreementId } = await loan('2020-01-01');
    await api('POST', `/api/v1/agreements/${agreementId}/returned`, { token });
    await loan('2999-01-01');
    await runReminders();
    expect(reminders()).toHaveLength(0);
  });

  it('sends once even when two runs happen at the same time', async () => {
    await loan('2020-01-01');
    await Promise.all([runReminders(), runReminders(), runReminders()]);
    expect(reminders()).toHaveLength(2);
  });

  it("doesn't count the due day itself as overdue", async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    await loan(today);
    await runReminders();
    expect(reminders()).toHaveLength(0);
  });
});
