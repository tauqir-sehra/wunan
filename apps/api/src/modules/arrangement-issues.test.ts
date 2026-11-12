// Proposal rules that need a clock or the database directly (002 FR-014, FR-020a; research §5).
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { arrangement, notificationPreference } from '../db/schema/index.ts';
import { testOutbox } from '../notify/email.ts';
import { api, completeDetails, createFounder, createInvitedMember, createOffering, futureDate, propose, signIn } from '../test/setup.ts';
import { describeTimes } from './arrangement-issues.ts';
import { closeQuietArrangements } from './arrangements.ts';

async function pair() {
  const jo = await createFounder('Jo');
  const leo = await createInvitedMember(jo, 'Leo');
  return { jo, leo, joToken: await signIn(jo), leoToken: await signIn(leo) };
}
const issuesOf = async (token: string, id: string) =>
  (await api('GET', `/api/v1/arrangements/${id}`, { token })).body.issues.map((i: { field: string; message: string }) => i.message);

/** The next date (from 7 days ahead) that falls on this ISO weekday. */
function nextWeekday(weekday: number) {
  for (let ahead = 7; ahead < 14; ahead += 1) {
    const date = futureDate(ahead);
    const day = new Date(`${date}T12:00:00`).getDay();
    if (((day + 6) % 7) + 1 === weekday) return date;
  }
  throw new Error('unreachable');
}

describe('quiet proposals', () => {
  it('close after 30 days without activity, and both members are told', async () => {
    const { jo, leo, joToken, leoToken } = await pair();
    const drill = await createOffering(joToken, { type: 'lend', title: 'Drill' });
    const quiet = await propose(leoToken, drill.id);
    const busy = await createOffering(joToken, { type: 'lend', title: 'Ladder' });
    const recent = await propose(leoToken, busy.id);
    await db.update(arrangement).set({ lastActivityAt: new Date(Date.now() - 31 * 86_400_000) }).where(eq(arrangement.id, quiet.id));
    // Emails on from now (the earlier "Leo asked to borrow" notice would otherwise count towards the hourly limit).
    for (const memberId of [jo.id, leo.id]) await db.insert(notificationPreference).values({ memberId, type: 'message', email: true });
    testOutbox.length = 0;

    expect(await closeQuietArrangements()).toEqual({ closed: 1 });
    expect((await api('GET', `/api/v1/arrangements/${quiet.id}`, { token: leoToken })).body).toMatchObject({ status: 'closed', closedReason: 'quiet' });
    expect((await api('GET', `/api/v1/arrangements/${recent.id}`, { token: leoToken })).body.status).toBe('open');
    expect(testOutbox.map((m) => m.to).sort()).toEqual([jo.email, leo.email].sort());
  });
});

describe('services', () => {
  it('fit the weekly times, the session length, and the times left', async () => {
    const { joToken, leoToken } = await pair();
    const repair = await createOffering(joToken, {
      type: 'service',
      title: 'Bike repair',
      sessionLength: 1,
      sessionLengthUnit: 'hours',
      sessionsAvailable: 4,
      availability: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '18:00', endTime: '21:00' }))
    });
    const saturday = nextWeekday(6);
    const tuesday = nextWeekday(2);
    const made = await propose(leoToken, repair.id, completeDetails('service', { date: saturday, time: '18:00', sessions: 5, sessionLength: 2, sessionLengthUnit: 'hours' }));
    const issues = await issuesOf(joToken, made.id);
    expect(issues).toContain('Jo offers this Monday–Friday, 6 pm–9 pm.');
    expect(issues).toContain('Each time can be up to 1 hour.');
    expect(issues).toContain('Only 4 times are left.');

    // Starting at 20:30 for an hour runs past 21:00.
    await api('PATCH', `/api/v1/arrangements/${made.id}`, { token: leoToken, body: { date: tuesday, time: '20:30', sessions: 2, sessionLength: 1 } });
    expect(await issuesOf(joToken, made.id)).toContain('Jo offers this Monday–Friday, 6 pm–9 pm.');
    await api('PATCH', `/api/v1/arrangements/${made.id}`, { token: leoToken, body: { time: '18:00' } });
    expect(await issuesOf(joToken, made.id)).toEqual([]);

    // Lengths in days only check the start.
    await api('PATCH', `/api/v1/arrangements/${made.id}`, { token: leoToken, body: { sessionLength: null, sessionLengthUnit: null } });
    expect(await issuesOf(joToken, made.id)).toContain('Please choose how long each time.');
  });

  it('meets within the offering area when the place was picked from a suggestion', async () => {
    const { joToken, leoToken } = await pair();
    const place = (neighbourhood: string) => ({ label: `${neighbourhood}, Springfield`, source: 'suggestion', neighbourhood, city: 'Springfield' });
    const repair = await createOffering(joToken, { type: 'service', title: 'Bike repair', area: place('Riverside') });
    const made = await propose(leoToken, repair.id, completeDetails('service', { handover: 'elsewhere', place: place('Old Town') }));
    expect(await issuesOf(joToken, made.id)).toContain('Jo offers this in Riverside, Springfield only.');

    // At the recipient's, any distance is fine: they agree on it in messages.
    await api('PATCH', `/api/v1/arrangements/${made.id}`, { token: leoToken, body: { handover: 'to_requester' } });
    expect(await issuesOf(joToken, made.id)).toEqual([]);
    await api('PATCH', `/api/v1/arrangements/${made.id}`, { token: leoToken, body: { handover: 'elsewhere' } });

    await api('PATCH', `/api/v1/arrangements/${made.id}`, { token: leoToken, body: { place: place('Riverside') } });
    expect(await issuesOf(joToken, made.id)).toEqual([]);
    const typed = await api('PATCH', `/api/v1/arrangements/${made.id}`, { token: leoToken, body: { place: 'near the park' } });
    expect(typed.body).toMatchObject({ issues: [], areaUnchecked: true });
  });
});

describe('handovers', () => {
  it("offer only the offering's ways; at the lister's uses the offering's area, shown in full once accepted", async () => {
    const { joToken, leoToken } = await pair();
    const house = { label: '1 Mill Street, Riverside, Springfield', source: 'suggestion', street: 'Mill Street', houseNumber: '1', neighbourhood: 'Riverside', city: 'Springfield' };
    const drill = await createOffering(joToken, { type: 'lend', title: 'Drill', handovers: ['at_lister'], area: house });
    const made = await propose(leoToken, drill.id, completeDetails('lend', { handover: 'to_requester', place: 'My flat' }));
    expect(await issuesOf(joToken, made.id)).toContain('Jo offered: picked up from jo.');

    const atJos = await api('PATCH', `/api/v1/arrangements/${made.id}`, { token: leoToken, body: { handover: 'at_lister' } });
    expect(atJos.body.details.place).toEqual({ display: 'Riverside, Springfield' });
    expect((await api('PATCH', `/api/v1/arrangements/${made.id}`, { token: leoToken, body: { place: 'Somewhere' } })).body.error.fields.place).toBe("This happens at Jo's place.");

    const { version } = (await api('GET', `/api/v1/arrangements/${made.id}`, { token: joToken })).body;
    const accepted = await api('POST', `/api/v1/arrangements/${made.id}/accept`, { token: joToken, body: { version } });
    const deal = await api('GET', `/api/v1/arrangements/${accepted.body.id}`, { token: leoToken });
    expect(deal.body.agreed.place).toMatchObject({ street: 'Mill Street' });
    expect((await api('GET', `/api/v1/arrangements/${made.id}`, { token: leoToken })).body.details.place).toMatchObject({ street: 'Mill Street' });
    expect((await api('GET', `/api/v1/offerings/${drill.id}`, { token: leoToken })).body.area).toMatchObject({ street: 'Mill Street' });
  });
});

describe('trades', () => {
  it('offer from the list when there is one, or in your own words', async () => {
    const { joToken, leoToken } = await pair();
    const starter = await createOffering(joToken, { type: 'trade', title: 'Starter', accepts: [{ description: 'Eggs', amount: '6', unit: 'item' }, { description: 'Honey' }] });
    const eggs = (starter.accepts as { id: string }[])[0]!.id;
    const own = await api('POST', `/api/v1/offerings/${starter.id}/arrangements`, { token: leoToken, body: { ownOffer: 'Jam' } });
    expect(own.body.error.fields.ownOffer).toBe('Please choose from what Jo listed.');
    const made = await propose(leoToken, starter.id, completeDetails('trade', { ownOffer: undefined, offers: [{ acceptId: eggs, amount: '12' }] }));
    expect(await issuesOf(joToken, made.id)).toContain('Jo would accept up to 6 of Eggs.');
    await api('PATCH', `/api/v1/arrangements/${made.id}`, { token: leoToken, body: { offers: [{ acceptId: eggs, amount: '6' }] } });
    expect(await issuesOf(joToken, made.id)).toEqual([]);

    const open = await createOffering(joToken, { type: 'trade', title: 'Boots' });
    const listed = await api('POST', `/api/v1/offerings/${open.id}/arrangements`, { token: leoToken, body: { offers: [{ acceptId: eggs }] } });
    expect(listed.body.error.fields.offers).toBe('Jo is open to offers, so please describe yours.');
  });
});

describe('describing times', () => {
  it('groups consecutive days with the same hours', () => {
    const row = (weekday: number, startTime = '18:00', endTime = '21:00') => ({ weekday, startTime, endTime });
    expect(describeTimes([row(1), row(2), row(3), row(5), row(6, '10:00', '12:00')])).toBe('Monday–Wednesday, Friday, 6 pm–9 pm; Saturday, 10 am–12 pm');
  });
});
