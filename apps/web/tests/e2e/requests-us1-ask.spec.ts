// 003 US1: requesting something, editing, closing, and reopening (quickstart 1).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { createFounder, createInvitedMember, daysAhead } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('a member requests something with only a title, then edits, closes, and reopens it', async ({
  page
}) => {
  const rana = createFounder('Rana');
  await signInAs(page, rana);

  // Both header buttons are outlined, so each page keeps one filled main button.
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'Request something' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Offer something' })).toBeVisible();

  await header.getByRole('link', { name: 'Request something' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Request something', level: 1 })).toBeVisible();
  await page.getByRole('radio', { name: /Borrow/ }).check();
  await page.getByLabel('Title').fill('Drill for shelves');
  await expectAccessible(page, 'request form');
  await page.getByRole('button', { name: 'Post request' }).click();

  await expect(page.getByRole('heading', { name: 'Drill for shelves', level: 1 })).toBeVisible();
  await expect(page.getByText('Your request is posted.')).toBeVisible();
  await expect(page.getByRole('definition').filter({ hasText: 'No fixed date' })).toBeVisible();
  await expectAccessible(page, 'request page (asker)');

  await page.getByRole('link', { name: 'Edit request' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Needed after').fill(daysAhead(4));
  await page.getByLabel('Needed by').fill(daysAhead(4));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('definition').filter({ hasText: /^Needed on/ })).toBeVisible();

  await page.getByRole('button', { name: 'Close request' }).click();
  await page.getByRole('button', { name: 'Yes, close it' }).click();
  await expect(page.getByText('Your request is closed.')).toBeVisible();
  await page.getByRole('button', { name: 'Reopen' }).click();
  await expect(page.getByText('Your request is open again.')).toBeVisible();
});

test('a trade request lists what could be given back, or says it is open to talking about it', async ({
  page
}) => {
  const rana = createFounder('Rana');
  const sam = await createInvitedMember(rana, 'Sam');
  await signInAs(page, rana);
  await page.goto('/requests/new');
  await page.waitForLoadState('networkidle');
  await page.getByRole('radio', { name: /Trade/ }).check();
  await page.getByLabel('Title').fill('Bike pump');
  await page.getByRole('button', { name: 'Add something you could give' }).click();
  await page.getByLabel('What', { exact: true }).first().fill('Jam');
  await page.getByRole('button', { name: 'Add another' }).click();
  await page.getByLabel('What', { exact: true }).nth(1).fill('Eggs');
  await page.getByRole('button', { name: 'Post request' }).click();
  await expect(page.getByRole('definition').filter({ hasText: 'Jam' })).toContainText('Eggs');
  const withList = page.url();

  await page.goto('/requests/new');
  await page.waitForLoadState('networkidle');
  await page.getByRole('radio', { name: /Trade/ }).check();
  await page.getByLabel('Title').fill('Garden shears');
  await page.getByRole('button', { name: 'Post request' }).click();
  await expect(
    page.getByRole('definition').filter({ hasText: 'Open to talking about it' })
  ).toBeVisible();

  // Another member sees it, with "I can help with this" as the main button.
  await page.context().clearCookies();
  await signInAs(page, sam);
  await page.goto(withList);
  await expect(page.getByText('Asked by Rana')).toBeVisible();
  await expect(page.getByRole('button', { name: 'I can help with this' })).toBeVisible();
  await expectAccessible(page, 'request page (others)');
});
