// 004 US1: one "Arrangements" list grouped as Waiting on you / In progress / Finished, with a choice of
// side and one count in the header.
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import {
  completeDetails,
  createFounder,
  createInvitedMember,
  createOfferingFor,
  proposeOn
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('everything being arranged is in one list, grouped by what is waiting on you', async ({ browser }) => {
  test.slow(); // Two members and several accessibility scans.
  const fay = createFounder('Fay');
  const sam = await createInvitedMember(fay, 'Sam');
  const drill = await createOfferingFor(fay, { type: 'lend', title: 'Drill' });
  const rice = await createOfferingFor(fay, { type: 'gift', title: 'Rice' });
  await proposeOn(sam, drill.id, { message: '' }); // nothing filled in: Sam's to do
  await proposeOn(sam, rice.id, { ...completeDetails('gift'), message: '' }); // ready: Fay's to accept

  const samContext = await browser.newContext();
  const page = await samContext.newPage();
  await signInAs(page, sam);
  await page.goto('/arrangements');
  const needsYou = page.getByRole('region', { name: 'Waiting on you' });
  const inProgress = page.getByRole('region', { name: 'In progress' });
  await expect(needsYou.getByRole('link', { name: /Drill/ })).toBeVisible();
  await expect(needsYou.getByText('Needs details: when, how')).toBeVisible();
  await expect(inProgress.getByRole('link', { name: /Rice/ })).toBeVisible();
  await expect(inProgress.getByText('Waiting for Fay')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Finished' })).toHaveCount(0);
  // One link in the header, its count the same as the cards under "Waiting on you"; no old pages.
  const nav = page.getByRole('navigation', { name: 'Main' }).first();
  await expect(nav.getByRole('link', { name: /^Arrangements\s*1 waiting on you$/ })).toBeVisible();
  await expect(nav.getByRole('link', { name: /Proposals|Agreements/ })).toHaveCount(0);
  await expectAccessible(page, 'arrangements, grouped');

  await page.getByRole('link', { name: 'On my offerings' }).click();
  await expect(page.getByText('Nobody has asked about your offerings yet.')).toBeVisible();
  await expectAccessible(page, 'arrangements, filtered and empty');
  await page.getByRole('link', { name: 'All', exact: true }).click();

  // The whole card opens the arrangement.
  await needsYou.getByRole('link', { name: /Drill/ }).click();
  await expect(page).toHaveURL(/\/arrangements\/[0-9a-f-]+$/);
  await samContext.close();

  // Fay sees the same two the other way round, and can narrow to one side, without JavaScript too.
  const fayContext = await browser.newContext({ javaScriptEnabled: false });
  const fayPage = await fayContext.newPage();
  await signInAs(fayPage, fay);
  await fayPage.goto('/arrangements');
  await expect(
    fayPage.getByRole('region', { name: 'Waiting on you' }).getByText('Ready for you to accept')
  ).toBeVisible();
  await fayPage.getByRole('link', { name: 'I asked' }).click();
  await expect(fayPage).toHaveURL(/side=asked/);
  await expect(fayPage.getByRole('link', { name: 'I asked' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expect(fayPage.getByText("You haven't asked for anything yet.")).toBeVisible();
  await fayPage.getByRole('link', { name: 'On my offerings' }).click();
  await expect(fayPage.getByRole('link', { name: /Drill/ })).toBeVisible();
  await fayPage.getByRole('link', { name: 'All', exact: true }).click();
  await expect(fayPage.getByRole('link', { name: /Rice/ })).toBeVisible();
  await fayContext.close();
});

test('a member with nothing to arrange is told so calmly', async ({ page }) => {
  const kim = createFounder('Kim');
  await signInAs(page, kim);
  await page.goto('/arrangements');
  await expect(page.getByText("You're not arranging anything yet.")).toBeVisible();
  await expect(
    page.getByRole('main').getByRole('link', { name: 'Offerings', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('main').getByRole('link', { name: 'request something' })
  ).toBeVisible();
  await expectAccessible(page, 'arrangements, empty');
});
