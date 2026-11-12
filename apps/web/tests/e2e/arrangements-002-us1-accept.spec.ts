// 002 US1 and US2: make a proposal, change it, and have it accepted (quickstart 1–5).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import {
  acceptArrangement,
  completeDetails,
  createFounder,
  createInvitedMember,
  createOfferingFor,
  daysAhead,
  proposeOn
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('a member proposes with nothing decided, fills it in, and the lister accepts', async ({
  page: robin,
  browser
}) => {
  const samMember = createFounder('Sam');
  const robinMember = await createInvitedMember(samMember, 'Robin');
  const house = {
    label: '1 Mill Street, Riverside, Springfield',
    source: 'suggestion',
    street: 'Mill Street',
    houseNumber: '1',
    neighbourhood: 'Riverside',
    city: 'Springfield'
  };
  const drill = await createOfferingFor(samMember, {
    type: 'lend',
    title: 'Drill',
    loanLength: 3,
    loanLengthUnit: 'days',
    handovers: ['at_lister', 'online'],
    area: house
  });
  await signInAs(robin, robinMember);

  // Robin sees only the neighbourhood and city, and the handover options in words.
  await robin.goto(`/offerings/${drill.id}`);
  await expect(robin.getByText('Riverside, Springfield')).toBeVisible();
  await expect(robin.getByText('Mill Street')).toHaveCount(0);
  const details = robin.getByRole('definition').filter({ hasText: 'Picked up from Sam' });
  await expect(details).toContainText('Online');
  await robin.getByRole('link', { name: 'Ask to borrow' }).click();
  await expectAccessible(robin, 'propose');
  await robin
    .getByLabel("Anything you'd rather talk about first?")
    .fill('Could I borrow it this weekend?');
  await robin.getByRole('button', { name: 'Send proposal' }).click();
  await expect(robin.getByText("Sent to Sam. You'll see their answer here.")).toBeVisible();
  await expect(robin.getByText('Not decided yet').first()).toBeVisible();
  await expectAccessible(robin, 'proposal (requester)');
  const proposalUrl = new URL(robin.url()).pathname;

  // Sam sees what's missing and can't accept yet.
  const samContext = await browser.newContext();
  const sam = await samContext.newPage();
  await signInAs(sam, samMember);
  await sam.goto('/arrangements');
  // One list: Robin's ask needs Sam because of Robin's unread message (the missing details are Robin's).
  const needsYou = sam.getByRole('region', { name: 'Waiting on you' });
  await expect(needsYou.getByText('Robin asked you')).toBeVisible();
  await expect(needsYou.getByText('New message')).toBeVisible();
  await expect(needsYou.getByText('Needs details: when, how, how long')).toBeVisible();
  await expectAccessible(sam, 'arrangements list');
  await sam.goto(proposalUrl);
  await expect(sam.getByText('Still to settle before you can accept')).toBeVisible();
  await expect(sam.getByRole('button', { name: 'Accept' })).toBeDisabled();
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
  await expect(
    sam.getByRole('list', { name: 'Messages' }).getByText(/Robin changed the pickup time/)
  ).toBeVisible({ timeout: 4000 });
  await sam.reload();
  const before = sam.url();
  await sam.getByRole('button', { name: 'Accept' }).click();
  // Accepting stays on the same page: it's now agreed, with the details fixed (004 FR-010, FR-016).
  await expect(sam.getByText("Accepted. You've agreed on these details.")).toBeVisible();
  expect(sam.url().split('#')[0]).toBe(before.split('#')[0]);
  await expect(sam.locator('#stage').getByText(/Agreed for /)).toBeVisible();
  await expect(sam.getByRole('heading', { name: 'What was agreed' })).toBeVisible();
  await expect(sam.getByRole('link', { name: 'Change details' })).toHaveCount(0);
  await expect(sam.getByRole('button', { name: 'Mark returned' })).toBeVisible();
  // The same messages carry on, with am/pm times.
  const messages = sam.getByRole('list', { name: 'Messages' });
  await expect(messages.getByText(/Robin changed the pickup time/)).toBeVisible();
  await expect(sam.getByText(/\d{1,2}(:\d{2})? (am|pm)/).first()).toBeVisible();
  await expectAccessible(sam, 'agreed arrangement');

  // Now Robin sees the full address.
  await robin.goto(`/offerings/${drill.id}`);
  await expect(robin.getByText('1 Mill Street, Riverside, Springfield')).toBeVisible();
  await samContext.close();
});

test('the lister is asked again when the details changed meanwhile', async ({ browser }) => {
  const sam = createFounder('Sam');
  const robin = await createInvitedMember(sam, 'Robin');
  const rice = await createOfferingFor(sam, {
    type: 'gift',
    title: 'Rice',
    amount: '5',
    unit: 'kg'
  });
  const made = await proposeOn(robin, rice.id, completeDetails('gift', { amount: '2' }));
  // Without JavaScript the open page doesn't refresh by itself, so Sam is looking at the old details.
  const samContext = await browser.newContext({ javaScriptEnabled: false });
  const samPage = await samContext.newPage();
  await signInAs(samPage, sam);
  await samPage.goto(`/arrangements/${made.id}`);

  const robinContext = await browser.newContext();
  const robinPage = await robinContext.newPage();
  await signInAs(robinPage, robin);
  await robinPage.goto(`/arrangements/${made.id}/edit`);
  await robinPage.getByLabel('How much would you like?').fill('3');
  await robinPage.getByRole('button', { name: 'Save changes' }).click();
  await robinContext.close();

  await samPage.getByRole('button', { name: 'Accept' }).click();
  await expect(
    samPage.getByText('Robin changed the details. Please check them again.')
  ).toBeVisible();
  await expect(samPage.getByRole('definition').filter({ hasText: '3 kg' })).toBeVisible();
  await samContext.close();
});

test('other proposals: told when less is left, closed when nothing is; loans can come later', async ({
  page
}) => {
  const sam = createFounder('Sam');
  const robin = await createInvitedMember(sam, 'Robin');
  const ana = await createInvitedMember(sam, 'Ana');
  const kim = await createInvitedMember(sam, 'Kim');
  const rice = await createOfferingFor(sam, {
    type: 'gift',
    title: 'Rice',
    amount: '5',
    unit: 'kg'
  });
  await acceptArrangement(
    sam,
    (await proposeOn(robin, rice.id, completeDetails('gift', { amount: '3' }))).id
  );
  const anas = await proposeOn(ana, rice.id, completeDetails('gift', { amount: '5' }));
  await signInAs(page, ana);
  await page.goto(`/arrangements/${anas.id}`);
  await expect(page.getByText('Only 2 kg is left.')).toBeVisible();
  await acceptArrangement(
    sam,
    (await proposeOn(kim, rice.id, completeDetails('gift', { amount: '2' }))).id
  );
  await page.reload();
  await expect(page.getByText('Closed: nothing left')).toBeVisible();
  await expect(
    page.getByText('This arrangement has ended, so no new messages can be added.')
  ).toBeVisible();

  // A lent drill can still be asked for later dates.
  const drill = await createOfferingFor(sam, { type: 'lend', title: 'Drill' });
  await acceptArrangement(
    sam,
    (
      await proposeOn(
        robin,
        drill.id,
        completeDetails('lend', { date: daysAhead(3), loanLength: 3, loanLengthUnit: 'days' })
      )
    ).id
  );
  const overlapping = await proposeOn(
    ana,
    drill.id,
    completeDetails('lend', { date: daysAhead(4) })
  );
  await page.goto(`/arrangements/${overlapping.id}`);
  await expect(page.getByText(/It's already lent then/)).toBeVisible();
  await page.goto(`/offerings/${drill.id}`);
  await expect(page.getByText('Already lent')).toBeVisible();
});

test('the lister can decline, with a note', async ({ page }) => {
  const sam = createFounder('Sam');
  const robin = await createInvitedMember(sam, 'Robin');
  const drill = await createOfferingFor(sam, { type: 'lend', title: 'Drill' });
  const made = await proposeOn(robin, drill.id);
  await signInAs(page, sam);
  await page.goto(`/arrangements/${made.id}`);
  await page.getByRole('button', { name: 'Decline' }).click();
  await page.getByLabel('A note').fill("I'm using it that week.");
  await page.getByRole('button', { name: 'Yes, decline it' }).click();
  await expect(page.getByText('You declined this.')).toBeVisible();
  await expect(
    page.locator('#stage').getByText(/Their note: I'm using it that week\./)
  ).toBeVisible();
});
