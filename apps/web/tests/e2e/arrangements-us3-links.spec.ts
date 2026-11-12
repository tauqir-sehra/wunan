// 004 US3 and US4: everything in wunan leads to the arrangement; the old pages are gone; the words
// and help talk about arrangements.
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import {
  acceptArrangement,
  completeDetails,
  createFounder,
  createInvitedMember,
  createOfferingFor,
  createRequestFor,
  linkOfferingFor,
  proposeOn,
  waitForEmailLink
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('the offering, the request and the email all lead to the arrangement', async ({ browser }) => {
  test.slow();
  const fay = createFounder('Fay');
  const sam = await createInvitedMember(fay, 'Sam');
  const request = await createRequestFor(sam, { kind: 'borrow', title: 'Drill for shelves' });
  const drill = await createOfferingFor(fay, { type: 'lend', title: 'Drill' });
  await linkOfferingFor(fay, request.id, drill.id);
  const made = await proposeOn(sam, drill.id, {
    ...completeDetails('lend'),
    requestId: request.id
  });

  const samContext = await browser.newContext();
  const page = await samContext.newPage();
  await signInAs(page, sam);
  // Email for when it's accepted, so the link can be followed.
  await page.goto('/settings/notifications');
  await page.waitForLoadState('networkidle');
  await page
    .getByRole('group', { name: 'Agreements' })
    .getByRole('checkbox', { name: 'By email' })
    .check();
  await page.getByRole('button', { name: 'Save' }).first().click();

  await page.goto(`/offerings/${drill.id}`);
  await page.getByRole('link', { name: 'See your arrangement' }).click();
  await expect(page).toHaveURL(new RegExp(`/arrangements/${made.id}$`));

  await acceptArrangement(fay, made.id);
  const path = await waitForEmailLink(sam.email, /https?:\/\/[^/\s]+(\/arrangements\/[0-9a-f-]+)/);
  expect(path).toBe(`/arrangements/${made.id}`);

  await page.goto(`/requests/${request.id}`);
  await page.getByRole('link', { name: 'See the arrangement' }).click();
  await expect(page).toHaveURL(new RegExp(`/arrangements/${made.id}$`));

  // No link on these pages leads to the old proposal or agreement pages.
  for (const path of [
    `/arrangements/${made.id}`,
    '/arrangements',
    `/offerings/${drill.id}`,
    `/requests/${request.id}`
  ]) {
    await page.goto(path);
    const old = await page.locator('a[href^="/proposals"], a[href^="/agreements"]').count();
    expect(old, path).toBe(0);
  }
  await samContext.close();

  // The owner's "Arrangements (1)" opens the ones on their offerings.
  const fayContext = await browser.newContext();
  const fayPage = await fayContext.newPage();
  await signInAs(fayPage, fay);
  const rice = await createOfferingFor(fay, { type: 'gift', title: 'Rice' });
  await proposeOn(sam, rice.id);
  await fayPage.goto(`/offerings/${rice.id}`);
  await fayPage.getByRole('link', { name: 'Arrangements (1)' }).click();
  await expect(fayPage).toHaveURL(/\/arrangements\?side=offered$/);
  await fayContext.close();
});

test('the old pages are gone, and help talks about arrangements', async ({ page }) => {
  const kim = createFounder('Kim');
  await signInAs(page, kim);
  for (const path of [
    '/proposals',
    '/agreements',
    `/proposals/${crypto.randomUUID()}`,
    `/agreements/${crypto.randomUUID()}`,
    '/help/proposals',
    '/help/agreements'
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: "We couldn't find that page" }),
      path
    ).toBeVisible();
  }
  await page.goto('/help');
  await expect(page.getByRole('link', { name: 'Arranging and agreeing' })).toBeVisible();
  await expect(page.getByRole('main').getByText(/\b(Proposals|Agreements)\b/)).toHaveCount(0);
  await page.goto('/help/arrangements');
  for (const stage of ['Being arranged', 'Agreed', 'On loan', 'Returned', 'Done', 'Ended']) {
    await expect(page.getByRole('main').getByText(stage, { exact: true })).toBeVisible();
  }
  await expectAccessible(page, 'help: arrangements');
});
