// US5: record what was agreed (quickstart scenario 6). Return reminders are covered by the API tests.
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { createFounder, createInvitedMember, createListingFor, memberIdOf, messageAbout } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

async function record(page: Page, listingId: string, fill: (page: Page) => Promise<void> = async () => {}, check = false) {
  await page.goto(`/listings/${listingId}`);
  await page.getByRole('link', { name: 'Record an agreement' }).click();
  if (check) await expectAccessible(page, 'record agreement');
  await page.getByRole('radio', { name: 'Alex' }).check();
  await fill(page);
  await page.getByRole('button', { name: 'Review' }).click();
  if (check) await expectAccessible(page, 'review agreement');
  await page.getByRole('button', { name: 'Record agreement' }).click();
  await expect(page.getByText('The agreement is recorded and the listing is updated.')).toBeVisible();
}

test('owners record agreements, listings update, and the other member confirms', async ({ page, browser }) => {
  const sam = createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  const samId = await memberIdOf(sam);
  const rice = await createListingFor(sam, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
  const drill = await createListingFor(sam, { type: 'lend', title: 'Drill' });
  const bodywork = await createListingFor(sam, { type: 'service', title: 'Bodywork session', sessionLength: 1, sessionLengthUnit: 'hours', sessionsAvailable: 3 });
  for (const listing of [rice, drill, bodywork]) await messageAbout(alex, samId, listing.id);
  await signInAs(page, sam);

  // Give 2 kg of rice: 3 kg left.
  await record(page, rice.id, (p) => p.getByLabel('How much').fill('2'), true);
  await expect(page.getByText('You gave Alex 2 kg of Rice.')).toBeVisible();
  await expectAccessible(page, 'agreement');
  await page.goto(`/listings/${rice.id}`);
  await expect(page.getByText('3 kg left')).toBeVisible();

  // Alex confirms it.
  const alexContext = await browser.newContext();
  const alexPage = await alexContext.newPage();
  await signInAs(alexPage, alex);
  await expect(alexPage.getByRole('link', { name: /agreements? needs? a look/ })).toBeVisible();
  await alexPage.goto('/agreements');
  await expectAccessible(alexPage, 'agreements list');
  await alexPage.getByRole('link', { name: 'Sam gave you 2 kg of Rice.' }).click();
  await alexPage.getByRole('button', { name: "Yes, that's right" }).click();
  await expect(alexPage.getByText('The agreement is confirmed.')).toBeVisible();
  await alexContext.close();

  // Lend the drill; mark it returned; it's available again.
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await record(page, drill.id, (p) => p.getByLabel('Back by').fill(tomorrow));
  await expect(page.getByText(/You lent Alex Drill, back by/)).toBeVisible();
  await page.getByRole('button', { name: 'Mark returned' }).click();
  await expect(page.getByText('Marked as returned. The listing is available again.')).toBeVisible();
  await page.goto(`/listings/${drill.id}`);
  await expect(page.getByText('Available', { exact: true })).toBeVisible();

  // One bodywork session leaves 2; two more close the listing.
  await record(page, bodywork.id);
  await page.goto(`/listings/${bodywork.id}`);
  await expect(page.getByText('1 hour · 2 sessions available')).toBeVisible();
  await record(page, bodywork.id, (p) => p.getByLabel('How many sessions').fill('2'));
  await page.goto(`/listings/${bodywork.id}`);
  await expect(page.getByText('Closed', { exact: true })).toBeVisible();

  // A mistake can be cancelled while it's still pending.
  await page.goto('/agreements');
  await page.getByRole('link', { name: /You provided 2 sessions of Bodywork session/ }).click();
  await page.getByRole('button', { name: 'Cancel this agreement' }).click();
  await page.getByRole('button', { name: 'Yes, cancel it' }).click();
  await expect(page.getByText('The agreement is cancelled and the listing is back as it was.')).toBeVisible();
  await page.goto(`/listings/${bodywork.id}`);
  await expect(page.getByText('1 hour · 2 sessions available')).toBeVisible();
});
