// 003 US4: from a request to an agreement; accepting closes the request (quickstart 4).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import {
  acceptArrangement,
  createFounder,
  createInvitedMember,
  createOfferingFor,
  createRequestFor,
  daysAhead,
  linkOfferingFor
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('the asker proposes from the request, the lister accepts, and the request closes', async ({
  page
}) => {
  const sam = createFounder('Sam');
  const rana = await createInvitedMember(sam, 'Rana');
  const request = await createRequestFor(rana, {
    kind: 'borrow',
    title: 'Drill',
    neededAfter: daysAhead(5),
    neededBy: daysAhead(5),
    loanLength: 1,
    loanLengthUnit: 'days'
  });
  const drill = await createOfferingFor(sam, {
    type: 'lend',
    title: 'Cordless drill',
    handovers: ['online'],
    forRequest: request.id
  });
  await signInAs(page, rana);

  await page.goto(`/requests/${request.id}`);
  await page
    .getByRole('region', { name: 'Offered for this request' })
    .getByRole('link', { name: "I'll take it!" })
    .click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText("When it's accepted, your request closes.")).toBeVisible();
  await expect(page.getByLabel('Day')).toHaveValue(daysAhead(5));
  await expect(page.locator('#loanLength')).toHaveValue('1');
  await expectAccessible(page, 'proposal prefilled from a request');
  await page.getByRole('button', { name: 'Send proposal' }).click();
  await expect(page.getByText('For your request: Drill')).toBeVisible();
  const proposalId = page.url().split('/arrangements/')[1]!.split('?')[0]!;

  // The handover and time weren't in the request, so Rana fills them in before Sam accepts.
  await page.goto(`/arrangements/${proposalId}/edit`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('radio', { name: 'Online' }).check();
  await page.getByLabel('Time').fill('10:00');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await acceptArrangement(sam, proposalId);

  await page.goto(`/requests/${request.id}`);
  await expect(page.getByText('Closed: settled by an agreement')).toBeVisible();
  await expect(page.getByRole('link', { name: 'See the arrangement' })).toBeVisible();
  await page.goto(`/offerings/${drill.id}`);
  await expect(page.getByRole('heading', { name: 'Cordless drill', level: 1 })).toBeVisible();
});

test('an offering linked to two requests asks which one the proposal is for', async ({ page }) => {
  const sam = createFounder('Sam');
  const rana = await createInvitedMember(sam, 'Rana');
  const first = await createRequestFor(rana, { kind: 'borrow', title: 'Drill' });
  const second = await createRequestFor(rana, { kind: 'borrow', title: 'Something to make holes' });
  const drill = await createOfferingFor(sam, { type: 'lend', title: 'Drill' });
  await linkOfferingFor(sam, first.id, drill.id);
  await linkOfferingFor(sam, second.id, drill.id);
  await signInAs(page, rana);
  await page.goto(`/offerings/${drill.id}`);
  await page.getByRole('link', { name: 'Ask to borrow' }).click();
  await expect(page.getByRole('group', { name: 'Which request is this for?' })).toBeVisible();
  await page.getByRole('radio', { name: 'Something to make holes' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('This is for your request: Something to make holes.')).toBeVisible();
});
