// 003 US6: public messages on requests and offerings, live, 240 characters (quickstart 6).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import {
  createFounder,
  createInvitedMember,
  createOfferingFor,
  createRequestFor
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('members talk in public on a request, live, and authors remove their own messages', async ({
  page,
  browser
}) => {
  const rana = createFounder('Rana');
  const sam = await createInvitedMember(rana, 'Sam');
  const request = await createRequestFor(rana, { kind: 'borrow', title: 'Drill' });
  await signInAs(page, rana);
  await page.goto(`/requests/${request.id}`);
  await page.waitForLoadState('networkidle');
  const thread = page.getByRole('region', { name: 'Public messages' });
  await expect(thread.getByText('No public messages yet.')).toBeVisible();

  // Sam writes in another browser; Rana's page shows it without reloading.
  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await signInAs(samPage, sam);
  await samPage.goto(`/requests/${request.id}`);
  await samPage.waitForLoadState('networkidle');
  const box = samPage.getByLabel('Add a public message');
  await box.fill('x'.repeat(230));
  await expect(samPage.getByText('10 characters left')).toBeVisible();
  await box.fill('Brick or plaster?');
  // Posting keeps the page where it is and empties the box.
  await samPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const scrolled = await samPage.evaluate(() => window.scrollY);
  await samPage.getByRole('button', { name: 'Post' }).click();
  await expect(samPage.getByText('Your message is posted.')).toBeVisible();
  await expect(box).toHaveValue('');
  expect(await samPage.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(scrolled - 50);
  await expect(thread.getByText('Brick or plaster?', { exact: true })).toBeVisible({
    timeout: 5000
  });

  // Others' messages offer only "Raise an issue"; my own offer "Remove".
  const samsMessage = thread.getByRole('listitem').filter({ hasText: 'Brick or plaster?' });
  await expect(samsMessage.getByRole('button', { name: 'Remove' })).toHaveCount(0);
  await expect(samsMessage.getByRole('button', { name: 'Raise an issue' })).toBeVisible();
  await expectAccessible(page, 'public thread');

  const mine = samPage
    .getByRole('region', { name: 'Public messages' })
    .getByRole('listitem')
    .filter({ hasText: 'Brick or plaster?' });
  // My own messages say "You", without a link; others' link to the writer.
  await expect(mine.getByText(/^You ·/)).toBeVisible();
  await expect(mine.getByRole('link', { name: 'Sam' })).toHaveCount(0);
  await expect(samsMessage.getByRole('link', { name: 'Sam' })).toBeVisible();
  await mine.getByRole('button', { name: 'Remove' }).click();
  await samPage.getByRole('button', { name: 'Yes, remove it' }).click();
  await expect(samPage.getByText('Message removed')).toBeVisible();
  await expect(thread.getByText('Message removed')).toBeVisible({ timeout: 5000 });
  await samContext.close();

  // Closed: still readable, no new messages.
  await page.getByRole('button', { name: 'Close request' }).click();
  await page.getByRole('button', { name: 'Yes, close it' }).click();
  await expect(
    thread.getByText('This request is closed, so no new messages can be posted.')
  ).toBeVisible();
  await expect(thread.getByText('Message removed')).toBeVisible();
});

test('an offering has a public thread too, and posting works without JavaScript', async ({
  browser
}) => {
  const sam = createFounder('Sam');
  const kim = await createInvitedMember(sam, 'Kim');
  const offering = await createOfferingFor(sam, { type: 'lend', title: 'Cordless drill' });
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await signInAs(page, kim);
  await page.goto(`/offerings/${offering.id}`);
  await expect(page.getByText('Up to 240 characters')).toBeVisible();
  await page.getByLabel('Add a public message').fill('Does it come with a charger?');
  await page.getByRole('button', { name: 'Post' }).click();
  await expect(
    page.getByRole('region', { name: 'Public messages' }).getByText('Does it come with a charger?')
  ).toBeVisible();
  await page.getByLabel('Add a public message').fill('y'.repeat(241));
  await page.getByRole('button', { name: 'Post' }).click();
  await expect(page.getByText('Please keep it to 240 characters; this is 241.')).toBeVisible();
  await context.close();
});
