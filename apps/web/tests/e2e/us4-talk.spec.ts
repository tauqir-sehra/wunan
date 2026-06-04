// US4: talk and arrange the exchange (quickstart scenarios 4 and 10).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { createFounder, createInvitedMember, createListingFor } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('messages arrive live in an open conversation; calls and contact details are arranged', async ({ page: sam, browser }) => {
  const samMember = createFounder('Sam');
  const alexMember = await createInvitedMember(samMember, 'Alex');
  const drill = await createListingFor(samMember, { type: 'lend', title: 'Drill' });
  const alexContext = await browser.newContext();
  const alex = await alexContext.newPage();
  await signInAs(alex, alexMember);
  await signInAs(sam, samMember);

  // Alex starts a conversation from the listing.
  await alex.goto(`/listings/${drill.id}`);
  await alex.getByRole('link', { name: 'Message about this' }).click();
  await expect(alex.getByRole('heading', { name: /Message Sam about Drill/ })).toBeVisible();
  await expectAccessible(alex, 'start conversation');
  await alex.getByLabel('Your message').fill('Hi! Is the drill free this weekend?');
  await alex.getByRole('button', { name: 'Send' }).click();
  await expect(alex.getByText('Hi! Is the drill free this weekend?')).toBeVisible();
  const conversationUrl = new URL(alex.url()).pathname;

  // Sam sees the conversation in the list, marked new, and the count in the navigation.
  await sam.goto('/messages');
  await expect(sam.getByText('New messages', { exact: true })).toBeVisible();
  await expect(sam.getByRole('link', { name: /Messages\s*1 with new messages/ })).toBeVisible();
  await expectAccessible(sam, 'messages list');
  await sam.getByRole('link', { name: /Alex/ }).click();
  await expect(sam).toHaveURL(new RegExp(conversationUrl));
  await expectAccessible(sam, 'conversation');

  // A second tab of Sam's keeps the list open; it only changes on reload.
  const samList = await sam.context().newPage();
  await samList.goto('/messages');
  await expect(samList.getByText('Hi! Is the drill free this weekend?')).toBeVisible();

  // Alex sends another message: it appears in Sam's open conversation without reloading.
  await alex.getByLabel('Write a message').fill('Saturday morning would be great.');
  await alex.getByRole('button', { name: 'Send' }).click();
  await expect(sam.getByRole('list', { name: 'Messages' }).getByText('Saturday morning would be great.')).toBeVisible({ timeout: 4000 });
  await expect(sam.locator('[aria-live="polite"]')).toContainText('New message from Alex: Saturday morning would be great.');
  await expect(samList.getByText('Saturday morning would be great.')).toHaveCount(0);
  await samList.reload();
  await expect(samList.getByText('Saturday morning would be great.')).toBeVisible();
  await samList.close();

  // Sam suggests a call time; Alex accepts it.
  await sam.getByText('Suggest a time to call').click();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await sam.getByLabel('Day').fill(tomorrow);
  await sam.getByLabel('Time').fill('10:30');
  await sam.getByRole('button', { name: 'Suggest this time' }).click();
  await expect(sam.getByText('Your suggested time was sent.')).toBeVisible();
  await alex.reload();
  await alex.getByRole('button', { name: 'Accept this time' }).click();
  await expect(alex.getByText('You accepted the call time.')).toBeVisible();
  await expect(alex.getByText('This time was accepted.')).toBeVisible();

  // Alex shares a phone number after reviewing exactly what will be shown.
  await alex.goto('/settings');
  await alex.getByLabel('Phone number').fill('07700 900123');
  await alex.getByRole('button', { name: 'Save contact details' }).click();
  await alex.goto(`${conversationUrl}/share-contact`);
  await expectAccessible(alex, 'share contact');
  await alex.getByLabel('My phone number').check();
  await alex.getByRole('button', { name: 'Review' }).click();
  await expect(alex.getByText('This is exactly what Sam will see')).toBeVisible();
  await expect(alex.getByText('Phone: 07700 900123')).toBeVisible();
  await alex.getByRole('button', { name: 'Yes, share it' }).click();
  await expect(sam.getByRole('list', { name: 'Messages' }).getByText('Phone: 07700 900123')).toBeVisible({ timeout: 4000 });
  await alexContext.close();
});

test('a message typed while the sign-in ran out is sent after signing in again', async ({ page, context }) => {
  const sam = createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  await createListingFor(sam, { type: 'gift', title: 'Rice' });
  await signInAs(page, alex);
  // Start a conversation, then let the sign-in run out before the second message.
  await page.goto('/listings?q=rice');
  await page.getByRole('link', { name: 'Rice' }).first().click();
  await page.getByRole('link', { name: 'Message about this' }).click();
  await page.getByLabel('Your message').fill('Hello');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByLabel('Write a message').fill('Kept through sign-in.');
  await context.clearCookies();
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('heading', { name: 'Please sign in again' })).toBeVisible();
  await page.getByLabel('Email').fill(alex.email);
  await page.getByLabel('Password').fill(alex.password);
  await page.getByRole('button', { name: 'Sign in and send' }).click();
  await expect(page.getByRole('main').getByText('Kept through sign-in.')).toBeVisible();
});
