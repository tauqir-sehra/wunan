// 003 US5: browsing what people ask for, and my own requests (quickstart 5).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import {
  createFounder,
  createInvitedMember,
  createOfferingFor,
  createRequestFor
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('requests are browsed on their own page, filtered, and kept apart from offerings', async ({
  page
}) => {
  const sam = createFounder('Sam');
  const rana = await createInvitedMember(sam, 'Rana');
  const tag = `t${Date.now()}`;
  await createRequestFor(rana, { kind: 'service', title: `Bike tune-up ${tag}` });
  await createRequestFor(rana, { kind: 'borrow', title: `Drill ${tag}` });
  await createOfferingFor(rana, { type: 'lend', title: `Ladder ${tag}` });
  await signInAs(page, sam);

  await page.getByRole('banner').getByRole('link', { name: 'Requests' }).first().click();
  await expect(
    page.getByRole('heading', { name: 'What people are asking for', level: 1 })
  ).toBeVisible();
  for (const kind of ['Borrow', 'Receive', 'Trade', 'Service'])
    await expect(page.getByRole('checkbox', { name: kind })).toBeChecked();
  await page.getByLabel('What could you help with?').fill(tag);
  await page.getByRole('checkbox', { name: 'Borrow' }).uncheck();
  await page.getByRole('button', { name: 'Search' }).click();
  const results = page.getByRole('region', { name: 'Open requests' });
  await expect(results.getByRole('link', { name: `Bike tune-up ${tag}` })).toBeVisible();
  await expect(results.getByRole('link', { name: `Drill ${tag}` })).toHaveCount(0);
  await expect(page.getByLabel('Active filters')).toContainText('Kind: Receive, Trade, Service');
  // Offerings never appear here, and requests never appear in Find (FR-020).
  await expect(results.getByRole('link', { name: `Ladder ${tag}` })).toHaveCount(0);
  await expectAccessible(page, 'requests page');

  await page.goto(`/offerings?q=${tag}`);
  await expect(page.getByRole('link', { name: `Ladder ${tag}` })).toBeVisible();
  await expect(page.getByRole('link', { name: `Drill ${tag}` })).toHaveCount(0);
});

test('my requests are listed, open first, with a calm empty state', async ({ page }) => {
  const sam = createFounder('Sam');
  await signInAs(page, sam);
  await page.goto('/requests?mine=true');
  await expect(page.getByText("You haven't asked for anything yet.")).toBeVisible();
  await createRequestFor(sam, { kind: 'receive', title: 'Rice' });
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Your requests' }).getByRole('link', { name: 'Rice' })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'My requests' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expectAccessible(page, 'my requests');
});
