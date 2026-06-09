// 002 US4: service proposals must fit the times, lengths, and area offered (quickstart 7).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import {
  acceptProposal,
  createFounder,
  createInvitedMember,
  createOfferingFor,
  daysAhead,
  proposeOn
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

/** The next date, a week or more ahead, on this ISO weekday (1 = Monday). */
function next(weekday: number) {
  for (let ahead = 7; ahead < 14; ahead += 1) {
    const date = daysAhead(ahead);
    if (((new Date(`${date}T12:00:00`).getDay() + 6) % 7) + 1 === weekday) return date;
  }
  throw new Error('unreachable');
}

test('the requester is told what fits, fixes it, and the lister accepts', async ({
  page,
  browser
}) => {
  const jo = createFounder('Jo');
  const leo = await createInvitedMember(jo, 'Leo');
  const place = (neighbourhood: string) => ({
    label: `${neighbourhood}, Springfield`,
    source: 'suggestion',
    neighbourhood,
    city: 'Springfield'
  });
  const repair = await createOfferingFor(jo, {
    type: 'service',
    title: 'Bike repair',
    sessionLength: 1,
    sessionLengthUnit: 'hours',
    sessionsAvailable: 4,
    handovers: ['to_requester', 'elsewhere', 'online'],
    meetingPlace: place('Riverside'),
    area: place('Riverside'),
    availability: [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      startTime: '18:00',
      endTime: '21:00'
    }))
  });
  const made = await proposeOn(leo, repair.id, {
    date: next(6),
    time: '18:00',
    handover: 'elsewhere',
    place: place('Old Town'),
    sessionLength: 2,
    sessionLengthUnit: 'hours',
    sessions: 5
  });
  await signInAs(page, leo);
  await page.goto(`/proposals/${made.id}`);
  for (const text of [
    'Jo offers this Monday–Friday, 6 pm–9 pm.',
    'Each time can be up to 1 hour.',
    'Only 4 times are left.',
    'Jo offers this in Riverside, Springfield only.'
  ]) {
    await expect(page.getByText(text)).toBeVisible();
  }
  await expectAccessible(page, 'service proposal with issues');

  await page.getByRole('link', { name: 'Change details' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Day').fill(next(2));
  await page.getByLabel('How long each time?: number').fill('1');
  await page.getByLabel('How many times?').fill('2');
  await page.getByRole('radio', { name: 'Online' }).check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByText('Everything is filled in. Waiting for Jo to accept it.')
  ).toBeVisible();

  await acceptProposal(jo, made.id);
  const joContext = await browser.newContext();
  const joPage = await joContext.newPage();
  await signInAs(joPage, jo);
  await joPage.goto(`/offerings/${repair.id}`);
  await expect(joPage.getByText('1 hour · 2 sessions available')).toBeVisible();
  await joContext.close();
});
