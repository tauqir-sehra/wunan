// 002 US1 and US2: make a proposal, change it, and have it accepted (quickstart 1–5).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { acceptProposal, completeDetails, createFounder, createInvitedMember, createListingFor, daysAhead, proposeOn } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('a member proposes with nothing decided, fills it in, and the lister accepts', async ({ page: robin, browser }) => {
  const samMember = createFounder('Sam');
  const robinMember = await createInvitedMember(samMember, 'Robin');
  const house = { label: '1 Mill Street, Riverside, Springfield', source: 'suggestion', street: 'Mill Street', houseNumber: '1', neighbourhood: 'Riverside', city: 'Springfield' };
  const drill = await createListingFor(samMember, { type: 'lend', title: 'Drill', loanLength: 3, loanLengthUnit: 'days', handovers: ['at_lister', 'online'], area: house });
  await signInAs(robin, robinMember);

  // Robin sees only the neighbourhood and city, and the handover options in words.
  await robin.goto(`/listings/${drill.id}`);
  await expect(robin.getByText('Riverside, Springfield')).toBeVisible();
  await expect(robin.getByText('Mill Street')).toHaveCount(0);
  await expect(robin.getByText('Picked up from Sam, or Online')).toBeVisible();
  await robin.getByRole('link', { name: 'Ask to borrow' }).click();
  await expectAccessible(robin, 'propose');
  await robin.getByLabel("Anything you'd rather talk about first?").fill('Could I borrow it this weekend?');
  await robin.getByRole('button', { name: 'Send proposal' }).click();
  await expect(robin.getByText('Your proposal was sent to Sam.')).toBeVisible();
  await expect(robin.getByText('Not decided yet').first()).toBeVisible();
  await expectAccessible(robin, 'proposal (requester)');
  const proposalUrl = new URL(robin.url()).pathname;

  // Sam sees what's missing and can't accept yet.
  const samContext = await browser.newContext();
  const sam = await samContext.newPage();
  await signInAs(sam, samMember);
  await sam.goto('/proposals');
  await expect(sam.getByText(/With Robin · Needs details: when, how, how long/)).toBeVisible();
  await expectAccessible(sam, 'proposals list');
  await sam.goto(proposalUrl);
  await expect(sam.getByText('Still to settle before you can accept')).toBeVisible();
  await expect(sam.getByRole('button', { name: 'Accept' })).toHaveCount(0);
  await expectAccessible(sam, 'proposal (lister)');

  // Robin fills in the details; Sam's open page shows the change without reloading.
  await robin.getByRole('link', { name: 'Change details' }).click();
  await robin.getByLabel('Day').fill(daysAhead(5));
  await robin.getByLabel('Time').fill('10:00');
  await robin.getByRole('radio', { name: 'Picked up from Sam' }).check();
  await expect(robin.getByText(/at Sam's place \(Riverside, Springfield\)/)).toBeVisible();
  await robin.getByLabel('For how long?: number').fill('3');
  await robin.getByLabel('For how long?: unit').selectOption('days');
  await robin.getByRole('button', { name: 'Save changes' }).click();
  await expect(sam.getByRole('list', { name: 'Messages' }).getByText(/Robin changed the pickup time/)).toBeVisible({ timeout: 4000 });
  await sam.reload();
  await sam.getByRole('button', { name: 'Accept' }).click();
  await expect(sam.getByRole('heading', { name: 'Agreement' })).toBeVisible();
  await expect(sam.getByText('You lent Robin Drill')).toBeVisible();

  // Now Robin sees the full address.
  await robin.goto(`/listings/${drill.id}`);
  await expect(robin.getByText('1 Mill Street, Riverside, Springfield')).toBeVisible();
  await samContext.close();
});

test('the lister is asked again when the details changed meanwhile', async ({ browser }) => {
  const sam = createFounder('Sam');
  const robin = await createInvitedMember(sam, 'Robin');
  const rice = await createListingFor(sam, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
  const made = await proposeOn(robin, rice.id, completeDetails('gift', { amount: '2' }));
  // Without JavaScript the open page doesn't refresh by itself, so Sam is looking at the old details.
  const samContext = await browser.newContext({ javaScriptEnabled: false });
  const samPage = await samContext.newPage();
  await signInAs(samPage, sam);
  await samPage.goto(`/proposals/${made.id}`);

  const robinContext = await browser.newContext();
  const robinPage = await robinContext.newPage();
  await signInAs(robinPage, robin);
  await robinPage.goto(`/proposals/${made.id}/edit`);
  await robinPage.getByLabel('How much would you like?').fill('3');
  await robinPage.getByRole('button', { name: 'Save changes' }).click();
  await robinContext.close();

  await samPage.getByRole('button', { name: 'Accept' }).click();
  await expect(samPage.getByText('Robin changed the details. Please check them again.')).toBeVisible();
  await expect(samPage.getByRole('definition').filter({ hasText: '3 kg' })).toBeVisible();
  await samContext.close();
});

test('other proposals: told when less is left, closed when nothing is; loans can come later', async ({ page }) => {
  const sam = createFounder('Sam');
  const robin = await createInvitedMember(sam, 'Robin');
  const ana = await createInvitedMember(sam, 'Ana');
  const kim = await createInvitedMember(sam, 'Kim');
  const rice = await createListingFor(sam, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
  await acceptProposal(sam, (await proposeOn(robin, rice.id, completeDetails('gift', { amount: '3' }))).id);
  const anas = await proposeOn(ana, rice.id, completeDetails('gift', { amount: '5' }));
  await signInAs(page, ana);
  await page.goto(`/proposals/${anas.id}`);
  await expect(page.getByText('Only 2 kg is left.')).toBeVisible();
  await acceptProposal(sam, (await proposeOn(kim, rice.id, completeDetails('gift', { amount: '2' }))).id);
  await page.reload();
  await expect(page.getByText('Closed, because nothing is left on the listing.')).toBeVisible();
  await expect(page.getByText('This proposal has ended, so no new messages can be added.')).toBeVisible();

  // A lent drill can still be asked for later dates.
  const drill = await createListingFor(sam, { type: 'lend', title: 'Drill' });
  await acceptProposal(sam, (await proposeOn(robin, drill.id, completeDetails('lend', { date: daysAhead(3), loanLength: 3, loanLengthUnit: 'days' }))).id);
  const overlapping = await proposeOn(ana, drill.id, completeDetails('lend', { date: daysAhead(4) }));
  await page.goto(`/proposals/${overlapping.id}`);
  await expect(page.getByText(/It's already lent then/)).toBeVisible();
  await page.goto(`/listings/${drill.id}`);
  await expect(page.getByText('Already lent')).toBeVisible();
});

test('the lister can decline, with a note', async ({ page }) => {
  const sam = createFounder('Sam');
  const robin = await createInvitedMember(sam, 'Robin');
  const drill = await createListingFor(sam, { type: 'lend', title: 'Drill' });
  const made = await proposeOn(robin, drill.id);
  await signInAs(page, sam);
  await page.goto(`/proposals/${made.id}`);
  await page.getByRole('button', { name: 'Decline' }).click();
  await page.getByLabel('A note').fill("I'm using it that week.");
  await page.getByRole('button', { name: 'Yes, decline it' }).click();
  await expect(page.getByText('You declined this proposal.')).toBeVisible();
  await expect(page.getByRole('status').or(page.getByRole('alert')).getByText("Note: I'm using it that week.")).toBeVisible();
});
