// 002 US5: everything about an exchange on one page: messages arrive live, call times and contact
// details are arranged there (quickstart 8; 001 FR-018a to FR-020).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import {
  createFounder,
  createInvitedMember,
  createOfferingFor,
  proposeOn
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('messages arrive live on an open proposal; calls and contact details are arranged there', async ({
  page: sam,
  browser
}) => {
  const samMember = createFounder('Sam');
  const alexMember = await createInvitedMember(samMember, 'Alex');
  const drill = await createOfferingFor(samMember, { type: 'lend', title: 'Drill' });
  const made = await proposeOn(alexMember, drill.id);
  const alexContext = await browser.newContext();
  const alex = await alexContext.newPage();
  await signInAs(alex, alexMember);
  await signInAs(sam, samMember);

  // Sam sees the count in the navigation, then opens the proposal.
  await sam.goto('/offerings');
  await expect(sam.getByRole('link', { name: /Arrangements\s*1 waiting on you/ })).toBeVisible();
  await sam.goto(`/arrangements/${made.id}`);
  await expect(sam.getByText('Is this still available?')).toBeVisible();

  // Alex writes: it appears on Sam's open page without reloading, announced politely.
  await alex.goto(`/arrangements/${made.id}`);
  await alex.getByLabel('Write a message').fill('Saturday morning would be great.');
  await alex.getByRole('button', { name: 'Send' }).click();
  await expect(
    sam.getByRole('list', { name: 'Messages' }).getByText('Saturday morning would be great.')
  ).toBeVisible({ timeout: 4000 });
  await expect(
    sam.locator('[aria-live="polite"]').filter({ hasText: 'New message from Alex' })
  ).toHaveCount(1);

  // Sam adds a call time with "+": it shows as a pill, and goes with the text as one message.
  // Sending updates the page in place: the page stays where it was.
  await sam.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const scrolled = await sam.evaluate(() => window.scrollY);
  const plus = sam.getByLabel('Add your contact details or a time to call');
  await plus.click();
  await expect(sam.getByText('To share a phone number or email')).toBeVisible();
  await sam
    .locator('#call-date')
    .fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  await sam.locator('#call-time').fill('10:30');
  await expectAccessible(sam, 'add to message panel');
  await sam.keyboard.press('Escape');
  const added = sam.getByRole('list', { name: 'Added to your message' });
  await expect(added.getByText(/Call: .*10:30 am/)).toBeVisible();
  await sam.getByLabel('Write a message').fill('Shall we talk it through?');
  await sam.getByRole('button', { name: 'Send' }).click();
  await expect(sam.getByText('Your message is sent.')).toBeVisible();
  await expect(added).toHaveCount(0);
  expect(await sam.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(scrolled - 50);
  await alex.reload();
  const callMessage = alex
    .getByRole('list', { name: 'Messages' })
    .getByRole('listitem')
    .filter({ hasText: 'Shall we talk it through?' });
  await expect(
    callMessage.getByRole('list', { name: 'Added to this message' }).getByText(/Call: .*10:30 am/)
  ).toBeVisible();
  await callMessage.getByRole('button', { name: 'Accept this time' }).click();
  await expect(alex.getByText('You accepted the call time.')).toBeVisible();

  // Alex adds a phone number, seeing exactly what will be shared, and sends it with no text.
  await alex.goto('/settings');
  await alex.getByLabel('Phone number').fill('07700 900123');
  await alex.getByRole('button', { name: 'Save' }).click();
  await alex.goto(`/arrangements/${made.id}`);
  await alex.waitForLoadState('networkidle');
  await alex.getByLabel('Add your contact details or a time to call').click();
  await expect(alex.getByText('07700 900123')).toBeVisible();
  await alex.getByLabel(/My phone number/).check();
  await expect(
    alex.getByRole('list', { name: 'Added to your message' }).getByText('Phone: 07700 900123')
  ).toBeVisible();
  await alex.getByRole('button', { name: 'Send' }).click();
  await expect(alex.getByText('Your message is sent.')).toBeVisible();
  await expect(
    sam
      .getByRole('list', { name: 'Messages' })
      .getByRole('list', { name: 'Added to this message' })
      .getByText('Phone: 07700 900123')
  ).toBeVisible({ timeout: 4000 });
  await alexContext.close();
});

test('a message typed while the sign-in ran out is sent after signing in again', async ({
  page,
  context
}) => {
  const sam = createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  const rice = await createOfferingFor(sam, { type: 'gift', title: 'Rice' });
  const made = await proposeOn(alex, rice.id);
  await signInAs(page, alex);
  await page.goto(`/arrangements/${made.id}`);
  await page.getByLabel('Write a message').fill('Kept through sign-in.');
  await context.clearCookies();
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('heading', { name: 'Please sign in again' })).toBeVisible();
  await page.getByLabel('Email').fill(alex.email);
  await page.getByLabel('Password').fill(alex.password);
  await page.getByRole('button', { name: 'Sign in and send' }).click();
  await expect(page.getByRole('main').getByText('Kept through sign-in.')).toBeVisible();
});
