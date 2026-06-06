// 002 US5: everything about an exchange on one page: messages arrive live, call times and contact
// details are arranged there (quickstart 8; 001 FR-018a to FR-020).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { createFounder, createInvitedMember, createListingFor, proposeOn } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('messages arrive live on an open proposal; calls and contact details are arranged there', async ({ page: sam, browser }) => {
  const samMember = createFounder('Sam');
  const alexMember = await createInvitedMember(samMember, 'Alex');
  const drill = await createListingFor(samMember, { type: 'lend', title: 'Drill' });
  const made = await proposeOn(alexMember, drill.id);
  const alexContext = await browser.newContext();
  const alex = await alexContext.newPage();
  await signInAs(alex, alexMember);
  await signInAs(sam, samMember);

  // Sam sees the count in the navigation, then opens the proposal.
  await sam.goto('/listings');
  await expect(sam.getByRole('link', { name: /Proposals\s*1 with something new/ })).toBeVisible();
  await sam.goto(`/proposals/${made.id}`);
  await expect(sam.getByText('Is this still available?')).toBeVisible();

  // Alex writes: it appears on Sam's open page without reloading, announced politely.
  await alex.goto(`/proposals/${made.id}`);
  await alex.getByLabel('Write a message').fill('Saturday morning would be great.');
  await alex.getByRole('button', { name: 'Send' }).click();
  await expect(sam.getByRole('list', { name: 'Messages' }).getByText('Saturday morning would be great.')).toBeVisible({ timeout: 4000 });
  await expect(sam.locator('[aria-live="polite"]').filter({ hasText: 'New message from Alex' })).toHaveCount(1);

  // Sam suggests a call time; Alex accepts it.
  await sam.getByRole('button', { name: 'Suggest a call' }).click();
  const callDialog = sam.getByRole('dialog', { name: 'Suggest a time to call' });
  await expectAccessible(sam, 'call time pop-up');
  await callDialog.getByLabel('Day').fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  await callDialog.getByLabel('Time').fill('10:30');
  await callDialog.getByRole('button', { name: 'Suggest this time' }).click();
  await expect(sam.getByText('Your suggested time was sent.')).toBeVisible();
  await alex.reload();
  await alex.getByRole('button', { name: 'Accept this time' }).click();
  await expect(alex.getByText('You accepted the call time.')).toBeVisible();

  // Alex shares a phone number after reviewing exactly what will be shown.
  await alex.goto('/settings');
  await alex.getByLabel('Phone number').fill('07700 900123');
  await alex.getByRole('button', { name: 'Save' }).click();
  await alex.goto(`/proposals/${made.id}`);
  await alex.waitForLoadState('networkidle');
  await alex.getByRole('button', { name: 'Share contact' }).click();
  const shareDialog = alex.getByRole('dialog', { name: 'Share your contact details' });
  await shareDialog.getByLabel('My phone number').check();
  await shareDialog.getByRole('button', { name: 'Review' }).click();
  await expect(shareDialog.getByText('Phone: 07700 900123')).toBeVisible();
  await shareDialog.getByRole('button', { name: 'Yes, share it' }).click();
  await expect(alex.getByText('Your contact details were shared.')).toBeVisible();
  await expect(sam.getByRole('list', { name: 'Messages' }).getByText('Phone: 07700 900123')).toBeVisible({ timeout: 4000 });
  await alexContext.close();
});

test('a message typed while the sign-in ran out is sent after signing in again', async ({ page, context }) => {
  const sam = createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  const rice = await createListingFor(sam, { type: 'gift', title: 'Rice' });
  const made = await proposeOn(alex, rice.id);
  await signInAs(page, alex);
  await page.goto(`/proposals/${made.id}`);
  await page.getByLabel('Write a message').fill('Kept through sign-in.');
  await context.clearCookies();
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('heading', { name: 'Please sign in again' })).toBeVisible();
  await page.getByLabel('Email').fill(alex.email);
  await page.getByLabel('Password').fill(alex.password);
  await page.getByRole('button', { name: 'Sign in and send' }).click();
  await expect(page.getByRole('main').getByText('Kept through sign-in.')).toBeVisible();
});
