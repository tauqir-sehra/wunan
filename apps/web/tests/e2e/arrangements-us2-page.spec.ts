// 004 US2: one page per arrangement, from asking to the end, at one address. Its stage, timeline,
// details and the one filled button follow the stage; every action stays on the page.
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import {
  acceptArrangement,
  changeArrangement,
  completeDetails,
  createFounder,
  createInvitedMember,
  createOfferingFor,
  proposeOn
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

/** The one filled button on the page's actions, by its words (FR-017). */
const filled = (page: Page) => page.locator('#decision [data-slot="button"].bg-primary');

test('a loan: arranging, agreed, returned, all on one page', async ({ browser }) => {
  test.slow();
  const fay = createFounder('Fay');
  const sam = await createInvitedMember(fay, 'Sam');
  const drill = await createOfferingFor(fay, { type: 'lend', title: 'Drill' });
  const made = await proposeOn(sam, drill.id, { message: '' });
  const url = `/arrangements/${made.id}`;

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await signInAs(samPage, sam);
  await samPage.goto(url);
  await expect(
    samPage.locator('#stage').getByText('Needs details: when, how, how long')
  ).toBeVisible();
  await expect(samPage.getByRole('heading', { name: 'What has happened' })).toBeVisible();
  await expect(samPage.getByText(/^Asked · /)).toBeVisible();
  await expect(samPage.getByText('Agreed · not yet')).toBeVisible();
  await expect(samPage.getByText('Still to settle before it can be accepted')).toBeVisible();
  await expect(filled(samPage)).toHaveText(['Change details']);
  await expectAccessible(samPage, 'arrangement being arranged, requester');
  await samContext.close();

  // Sam fills everything in; Fay accepts on the same page and address.
  await changeArrangement(sam, made.id, completeDetails('lend'));
  const fayContext = await browser.newContext();
  const page = await fayContext.newPage();
  await signInAs(page, fay);
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#stage').getByText('Ready for you to accept')).toBeVisible();
  await expect(filled(page)).toHaveText(['Accept']);
  await expectAccessible(page, 'arrangement ready, lister');
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText("Accepted. You've agreed on these details.")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(url);
  await expect(page.getByRole('heading', { name: 'What was agreed' })).toBeVisible();
  await expect(page.getByText(/^Agreed · /)).toBeVisible();
  await expect(page.getByText('Returned · not yet')).toBeVisible();
  await expect(filled(page)).toHaveText(['Mark returned']);
  await expectAccessible(page, 'agreed loan, owner');

  await page.getByRole('button', { name: 'Mark returned' }).click();
  await expect(page.getByText('Marked as returned. Those dates are free again.')).toBeVisible();
  await expect(page.locator('#stage').getByText(/Returned on /)).toBeVisible();
  await expect(page.getByText(/^Returned · \w{3} \d{1,2} \w{3} · marked by Fay$/)).toBeVisible();
  await expect(filled(page)).toHaveCount(0);
  // Finished now, and the "returned" note doesn't make it need Sam.
  await page.goto('/arrangements');
  await expect(
    page.getByRole('region', { name: 'Finished' }).getByRole('link', { name: /Drill/ })
  ).toBeVisible();
  await fayContext.close();
});

test('a gift: either member marks it done, and can take it back', async ({ browser }) => {
  test.slow();
  const fay = createFounder('Fay');
  const sam = await createInvitedMember(fay, 'Sam');
  const rice = await createOfferingFor(fay, {
    type: 'gift',
    title: 'Rice',
    amount: '5',
    unit: 'kg'
  });
  const made = await proposeOn(sam, rice.id, {
    ...completeDetails('gift', { amount: '1' }),
    message: ''
  });
  await acceptArrangement(fay, made.id);

  const samContext = await browser.newContext();
  const page = await samContext.newPage();
  await signInAs(page, sam);
  await page.goto(`/arrangements/${made.id}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Done · not yet')).toBeVisible();
  await expect(filled(page)).toHaveText(['Mark as done']);
  await expectAccessible(page, 'agreed gift, requester');
  await page.getByRole('button', { name: 'Mark as done' }).click();
  await expect(page.getByText('Marked as done. You can take this back.')).toBeVisible();
  await expect(page.locator('#stage').getByText(/Done on /)).toBeVisible();
  await expect(page.getByText(/^Done · \w{3} \d{1,2} \w{3} · marked by Sam$/)).toBeVisible();
  await expect(filled(page)).toHaveCount(0);
  await samContext.close();

  // Fay sees it finished, not as something that needs her.
  const fayContext = await browser.newContext();
  const fayPage = await fayContext.newPage();
  await signInAs(fayPage, fay);
  await fayPage.goto('/arrangements');
  await expect(fayPage.getByRole('region', { name: 'Waiting on you' })).toHaveCount(0);
  await expect(
    fayPage.getByRole('region', { name: 'Finished' }).getByText(/Done on /)
  ).toBeVisible();
  await fayPage.getByRole('link', { name: /Rice/ }).click();
  await fayPage.waitForLoadState('networkidle');
  await fayPage.getByRole('button', { name: 'Not done yet' }).click();
  await expect(fayPage.getByText('Marked as not done yet.')).toBeVisible();
  await expect(fayPage.getByText('Done · not yet')).toBeVisible();
  await expect(filled(fayPage)).toHaveText(['Mark as done']);
  await fayContext.close();
});

test('declined, then asked again: the same arrangement, with its messages', async ({ browser }) => {
  test.slow();
  const fay = createFounder('Fay');
  const sam = await createInvitedMember(fay, 'Sam');
  const seeds = await createOfferingFor(fay, { type: 'gift', title: 'Seeds' });
  const made = await proposeOn(sam, seeds.id, { message: 'Could I have some?' });

  const fayContext = await browser.newContext();
  const fayPage = await fayContext.newPage();
  await signInAs(fayPage, fay);
  await fayPage.goto(`/arrangements/${made.id}`);
  await fayPage.waitForLoadState('networkidle');
  await fayPage.getByRole('button', { name: 'Decline' }).click();
  await fayPage.getByLabel('A note').fill('None left this year.');
  await fayPage.getByRole('button', { name: 'Yes, decline it' }).click();
  await expect(fayPage.getByText('You declined this.')).toBeVisible();
  await fayContext.close();

  const samContext = await browser.newContext();
  const page = await samContext.newPage();
  await signInAs(page, sam);
  await page.goto(`/arrangements/${made.id}`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#stage').getByText(/^Ended\s*Declined$/)).toBeVisible();
  await expect(page.locator('#stage').getByText(/Their note: None left this year\./)).toBeVisible();
  await expect(
    page.getByText('This arrangement has ended, so no new messages can be added.')
  ).toBeVisible();
  await expect(filled(page)).toHaveText(['Ask again']);
  await expectAccessible(page, 'ended arrangement, requester');

  await page.getByRole('link', { name: 'Ask again' }).click();
  await expect(page.getByRole('heading', { name: 'Ask again' })).toBeVisible();
  await expect(
    page.getByText('This continues your earlier arrangement, with its messages.')
  ).toBeVisible();
  await page.getByRole('button', { name: 'Send proposal' }).click();
  await expect(page).toHaveURL(new RegExp(`/arrangements/${made.id}`));
  await expect(page.getByText('Could I have some?')).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'What has happened' }).getByRole('listitem')
  ).toHaveText([/Asked · /, /Declined · /, /Asked · /, /Agreed · not yet/]);
  await samContext.close();
});
