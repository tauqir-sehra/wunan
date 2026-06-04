// Return reminders (US5; FR-025).
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { notificationPreference } from '../db/schema/index.ts';
import { testOutbox } from '../notify/email.ts';
import { api, createFounder, createInvitedMember, signIn } from '../test/setup.ts';
import { runReminders } from './reminders.ts';

async function loan(returnDue: string) {
  const sam = await createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  for (const memberId of [sam.id, alex.id]) await db.insert(notificationPreference).values({ memberId, type: 'reminder', email: true });
  const token = await signIn(sam);
  const { body: drill } = await api('POST', '/api/v1/listings', { token, body: { type: 'lend', title: 'Drill' } });
  const { body } = await api('POST', `/api/v1/listings/${drill.id}/agreements`, { token, body: { otherMemberId: alex.id, returnDue } });
  return { sam, alex, token, agreementId: body.id as string };
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
    const today = new Date().toISOString().slice(0, 10);
    await loan(today);
    await runReminders();
    expect(reminders()).toHaveLength(0);
  });
});
