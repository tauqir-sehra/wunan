// Actions on request and offering pages update the page in place: the page stays where it was,
// pop-ups close once sent, and the result shows next to the buttons (constitution V).
import { expect, test, type Page } from '@playwright/test';
import {
  createFounder,
  createInvitedMember,
  createOfferingFor,
  createRequestFor,
  linkOfferingFor,
  proposeOn
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

async function scrollToBottom(page: Page) {
  await page.setViewportSize({ width: 1024, height: 500 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  return page.evaluate(() => window.scrollY);
}
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

test('raising an issue about a request and closing it keep the page where it was', async ({
  page,
  browser
}) => {
  const rana = createFounder('Rana');
  const sam = await createInvitedMember(rana, 'Sam');
  const request = await createRequestFor(rana, {
    kind: 'borrow',
    title: 'Ladder',
    description: 'For the gutters.'
  });

  await signInAs(page, sam);
  await page.goto(`/requests/${request.id}`);
  await page.waitForLoadState('networkidle');
  // Measured with the button already on screen, so the click itself doesn't scroll the page.
  await scrollToBottom(page);
  await page.getByRole('button', { name: 'Raise an issue' }).scrollIntoViewIfNeeded();
  const before = await scrollY(page);
  expect(before).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Raise an issue' }).click();
  const dialog = page.getByRole('dialog', { name: 'Raise an issue with Rana' });
  await dialog.getByLabel('What would you like to ask?').fill('Is this still needed?');
  await dialog.getByRole('button', { name: 'Send to Rana' }).click();
  await expect(page.getByText('Your request was sent to the person who asked.')).toBeInViewport();
  await expect(dialog).toBeHidden();
  expect(await scrollY(page)).toBeGreaterThanOrEqual(before - 80);

  const ranaContext = await browser.newContext();
  const asker = await ranaContext.newPage();
  await signInAs(asker, rana);
  await asker.goto(`/requests/${request.id}`);
  await asker.waitForLoadState('networkidle');
  const start = await scrollToBottom(asker);
  await asker.getByRole('button', { name: 'Close request' }).click();
  await asker.getByRole('button', { name: 'Yes, close it' }).click();
  // Closing shortens the page (the confirmation and message box go), so it can't stay as far
  // down; it must not go back to the top, and the result must be on screen.
  await expect(asker.getByText('Your request is closed.')).toBeInViewport();
  expect(start).toBeGreaterThan(0);
  expect(await scrollY(asker)).toBeGreaterThan(0);
  await ranaContext.close();
});

test('pausing an offering keeps the page where it was', async ({ page }) => {
  const sam = createFounder('Sam');
  const drill = await createOfferingFor(sam, {
    type: 'lend',
    title: 'Drill',
    description: 'A cordless drill.'
  });
  await signInAs(page, sam);
  await page.goto(`/offerings/${drill.id}`);
  await page.waitForLoadState('networkidle');
  await scrollToBottom(page);
  await page.getByRole('button', { name: 'Pause' }).scrollIntoViewIfNeeded();
  const before = await scrollY(page);
  expect(before).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('Your offering is paused.')).toBeInViewport();
  expect(await scrollY(page)).toBeGreaterThanOrEqual(before - 80);
});

test('withdrawing a proposal for a request keeps the page where it was', async ({ page }) => {
  const sam = createFounder('Sam');
  const rana = await createInvitedMember(sam, 'Rana');
  const request = await createRequestFor(rana, { kind: 'borrow', title: 'Ladder' });
  const ladder = await createOfferingFor(sam, { type: 'lend', title: 'Tall ladder' });
  await linkOfferingFor(sam, request.id, ladder.id);
  const proposal = await proposeOn(rana, ladder.id, { requestId: request.id });

  await signInAs(page, rana);
  await page.goto(`/proposals/${proposal.id}`);
  await page.waitForLoadState('networkidle');
  await page.setViewportSize({ width: 1024, height: 500 });
  const withdraw = page.getByRole('button', { name: 'Withdraw' });
  await withdraw.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 100));
  const before = await scrollY(page);
  expect(before).toBeGreaterThan(0);
  await withdraw.click();
  await expect(page.getByRole('button', { name: 'Yes, withdraw it' })).toBeInViewport();
  expect(await scrollY(page)).toBeGreaterThanOrEqual(before - 80);
  await page.getByRole('link', { name: 'Keep it open' }).click();
  await expect(withdraw).toBeInViewport();
  expect(await scrollY(page)).toBeGreaterThanOrEqual(before - 80);
  await withdraw.click();
  await page.getByRole('button', { name: 'Yes, withdraw it' }).click();
  await expect(page.getByText('You withdrew your proposal.')).toBeInViewport();
  expect(await scrollY(page)).toBeGreaterThan(0);
});

test('adding a call time with "+" keeps the "+" and its panel where they are', async ({ page }) => {
  const sam = createFounder('Sam');
  const rana = await createInvitedMember(sam, 'Rana');
  const ladder = await createOfferingFor(sam, { type: 'lend', title: 'Tall ladder' });
  const proposal = await proposeOn(rana, ladder.id);

  await signInAs(page, rana);
  await page.goto(`/proposals/${proposal.id}`);
  await page.waitForLoadState('networkidle');
  await scrollToBottom(page);
  const plus = page.getByLabel('Add your contact details or a time to call');
  await plus.click();
  await page
    .locator('#call-date')
    .fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const before = (await plus.boundingBox())!.y;
  await page.locator('#call-time').fill('10:30');
  await expect(page.getByRole('list', { name: 'Added to your message' })).toBeVisible();
  expect(Math.abs((await plus.boundingBox())!.y - before)).toBeLessThan(2);
  await expect(page.locator('#call-time')).toBeInViewport();
});
