// 006: the requester adds or changes one detail at a time, in its row on the arrangement page,
// instead of on a separate "Change details" page. The page stays put, the field opens with just that
// detail, and the same works without JavaScript. Only the requester can, and only while it's open.
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import {
  acceptArrangement,
  changeArrangement,
  completeDetails,
  createFounder,
  createInvitedMember,
  createOfferingFor,
  daysAhead,
  proposeOn
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

const details = (page: Page) => page.locator('#details');
const row = (page: Page, label: string) =>
  details(page)
    .locator('dd')
    .filter({ has: page.locator(`xpath=preceding-sibling::dt[1][normalize-space()="${label}"]`) });
const settle = (page: Page) => page.getByRole('region', { name: /Still to settle/ });
const filled = (page: Page) => page.locator('#decision [data-slot="button"].bg-primary');

async function fitsWithoutSideScroll(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, `sideways scroll at ${width}px`).toBeLessThanOrEqual(0);
}

async function loan() {
  const fay = createFounder('Fay');
  const sam = await createInvitedMember(fay, 'Sam');
  const ladder = await createOfferingFor(fay, { type: 'lend', title: 'Ladder' });
  const made = await proposeOn(sam, ladder.id, { handover: 'online' });
  return { fay, sam, made, url: `/arrangements/${made.id}` };
}

test('fills in one missing detail in its row, and the page stays put', async ({ page }) => {
  test.slow();
  const { sam, url } = await loan();
  await signInAs(page, sam);
  await page.goto(url);
  await page.waitForLoadState('networkidle');

  await expect(row(page, 'When')).toContainText('Not decided yet');
  await expect(page.getByRole('link', { name: 'Add when', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add for how long', exact: true })).toBeVisible();
  // No "Change details", and nothing filled while details are missing (006 FR-010).
  await expect(page.getByRole('link', { name: 'Change details', exact: true })).toHaveCount(0);
  await expect(filled(page)).toHaveCount(0);
  await expectAccessible(page, 'details with rows to add');

  await page.getByRole('link', { name: 'Add when', exact: true }).click();
  await expect(page).toHaveURL(/\?detail=when/);
  const day = details(page).getByLabel('Day');
  await expect(day).toBeFocused();
  await expect(details(page).getByLabel('For how long?: number')).toHaveCount(0);
  await expect(details(page).getByRole('button', { name: 'Save' })).not.toHaveClass(/bg-primary/);
  await expectAccessible(page, 'one detail open');

  await day.fill(daysAhead(5));
  await details(page).getByRole('button', { name: 'Save' }).click();
  await expect(page).not.toHaveURL(/detail=/);
  await expect(row(page, 'When')).not.toContainText('Not decided yet');
  await expect(page.getByRole('link', { name: 'Change when', exact: true })).toBeFocused();
  await expect(settle(page)).not.toContainText(/Please choose the/);
  await expect(page.getByText(/Sam changed the pickup time to/)).toBeVisible();

  // Cancel saves nothing and goes back to the row.
  await page.getByRole('link', { name: 'Add for how long', exact: true }).click();
  await details(page).getByLabel('For how long?: number').fill('2');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(row(page, 'For how long')).toContainText('Not decided yet');
  await expect(page.getByRole('link', { name: 'Add for how long', exact: true })).toBeFocused();

  // One field at a time.
  await page.getByRole('link', { name: 'Change when', exact: true }).click();
  await expect(details(page).getByLabel('Day')).toBeVisible();
  await page.getByRole('link', { name: 'Add for how long', exact: true }).click();
  await expect(details(page).getByLabel('Day')).toHaveCount(0);
  await expect(details(page).getByLabel('For how long?: number')).toBeVisible();

  // A value that doesn't fit: the field stays open, keeps it, and says what to change.
  await details(page).getByLabel('For how long?: number').fill('2');
  await details(page).getByRole('button', { name: 'Save' }).click();
  await expect(
    details(page)
      .getByText(/Please choose hours, days, or weeks/)
      .first()
  ).toBeVisible();
  await expect(details(page).getByLabel('For how long?: number')).toHaveValue('2');
  await expectAccessible(page, 'one detail with a problem');

  await fitsWithoutSideScroll(page, 320);
});

test('changes a detail already decided, and clearing it makes it "Not decided yet"', async ({
  page
}) => {
  test.slow();
  const { sam, made, url } = await loan();
  await changeArrangement(sam, made.id, { date: daysAhead(4) });
  await signInAs(page, sam);
  await page.goto(url);
  await page.waitForLoadState('networkidle');

  await page.getByRole('link', { name: 'Change when', exact: true }).click();
  await expect(details(page).getByLabel('Day')).toHaveValue(daysAhead(4));
  await details(page).getByLabel('Day').fill(daysAhead(6));
  await details(page).getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('link', { name: 'Change when', exact: true })).toBeFocused();

  await page.getByRole('link', { name: 'Change when', exact: true }).click();
  await details(page).getByLabel('Day').fill('');
  await details(page).getByRole('button', { name: 'Save' }).click();
  await expect(row(page, 'When')).toContainText('Not decided yet');
  await expect(page.getByRole('link', { name: 'Add when', exact: true })).toBeVisible();

  // The old page lands on the details.
  await page.goto(`${url}/edit`);
  await expect(page).toHaveURL(new RegExp(`${url}#details$`));
});

test('details that depend on each other, and a place the lister picked', async ({
  page,
  browser
}) => {
  test.slow();
  const fay = createFounder('Fay');
  const sam = await createInvitedMember(fay, 'Sam');
  const lessons = await createOfferingFor(fay, { type: 'service', title: 'Guitar lessons' });
  const made = await proposeOn(sam, lessons.id);
  await signInAs(page, sam);
  await page.goto(`/arrangements/${made.id}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('link', { name: 'Add where', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Add how', exact: true }).click();
  await details(page)
    .getByLabel(/online/i)
    .check();
  await details(page).getByRole('button', { name: 'Save' }).click();
  await expect(details(page).locator('dt', { hasText: 'Where' })).toHaveCount(0);
  await expect(settle(page)).not.toContainText('Please choose where.');

  await page.getByRole('link', { name: 'Change how', exact: true }).click();
  await details(page).getByLabel('Not decided yet').check();
  await details(page).getByRole('button', { name: 'Save' }).click();
  await expect(row(page, 'Where')).toContainText('Not decided yet');

  // At the lister's place: Fay's place, picked by her; nothing to press.
  const drill = await createOfferingFor(fay, {
    type: 'lend',
    title: 'Drill',
    handovers: ['at_lister'],
    area: 'Leith'
  });
  const pickup = await proposeOn(sam, drill.id, { handover: 'at_lister' });
  await page.goto(`/arrangements/${pickup.id}`);
  await expect(row(page, 'Where')).toContainText('Picked by Fay');
  await expect(page.getByRole('link', { name: /where/i })).toHaveCount(0);

  const fayContext = await browser.newContext();
  const fayPage = await fayContext.newPage();
  await signInAs(fayPage, fay);
  await fayPage.goto(`/arrangements/${pickup.id}`);
  await expect(row(fayPage, 'Where')).toContainText('Picked by you');
  // The lister can't change details: no links in the rows.
  await expect(details(fayPage).getByRole('link', { name: /^(Add|Change) / })).toHaveCount(0);
  await fayContext.close();
});

test('works without JavaScript', async ({ browser }) => {
  test.slow();
  const { sam, url } = await loan();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await signInAs(page, sam);
  await page.goto(url);

  await page.getByRole('link', { name: 'Add when', exact: true }).click();
  await expect(page).toHaveURL(/\?detail=when#details$/);
  await details(page).getByLabel('Day').fill(daysAhead(5));
  await details(page).getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/#details$/);
  await expect(page.getByRole('link', { name: 'Change when', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Add for how long', exact: true }).click();
  await details(page).getByLabel('For how long?: number').fill('2');
  await details(page).getByRole('button', { name: 'Save' }).click();
  await expect(details(page).getByLabel('For how long?: number')).toHaveValue('2');
  await expect(
    details(page)
      .getByText(/Please choose hours, days, or weeks/)
      .first()
  ).toBeVisible();
  await context.close();
});

test('nothing to press once agreed', async ({ page }) => {
  test.slow();
  const { fay, sam, made, url } = await loan();
  await changeArrangement(sam, made.id, completeDetails('lend'));
  await acceptArrangement(fay, made.id);
  await signInAs(page, sam);
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'What was agreed' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^(Add|Change) / })).toHaveCount(0);
});
