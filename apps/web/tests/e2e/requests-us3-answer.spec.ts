// 003 US3: answering a request with an offering made for it, or one already listed (quickstart 3).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import {
  createFounder,
  createInvitedMember,
  createOfferingFor,
  createRequestFor
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('a helper answers with a prefilled offering, links another, and removes a link', async ({
  page
}) => {
  const rana = createFounder('Rana');
  const sam = await createInvitedMember(rana, 'Sam');
  const request = await createRequestFor(rana, {
    kind: 'borrow',
    title: 'Drill for shelves',
    loanLength: 1,
    loanLengthUnit: 'days',
    handovers: ['to_requester']
  });
  await createOfferingFor(sam, { type: 'lend', title: 'Old ladder' });
  await signInAs(page, sam);

  await page.goto(`/requests/${request.id}`);
  await page.getByRole('button', { name: 'I can help with this' }).click();
  await page
    .getByRole('dialog', { name: 'How would you like to help?' })
    .getByRole('link', { name: 'Make a new offering' })
    .click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText("You're answering Rana's request")).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('Drill for shelves');
  await expect(page.locator('#loanLength')).toHaveValue('1');
  await expect(page.getByRole('checkbox', { name: /Dropped off/ })).toBeChecked();
  await page.getByLabel('Title').fill('Cordless drill');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Publish offering' }).click();

  await expect(page.getByRole('heading', { name: 'Cordless drill', level: 1 })).toBeVisible();
  await expect(page.getByText("For Rana's request Drill for shelves")).toBeVisible();

  await page.goto(`/requests/${request.id}`);
  const offered = page.getByRole('region', { name: 'Offered for this request' });
  await expect(offered.getByRole('link', { name: 'Cordless drill' })).toBeVisible();

  // Offer an offering Sam already has (the ladder is a Lend offering too).
  await page.getByRole('button', { name: 'I can help with this' }).click();
  const dialog = page.getByRole('dialog', { name: 'How would you like to help?' });
  await dialog.getByRole('radio', { name: 'Old ladder' }).check();
  await expectAccessible(page, 'help choices pop-up');
  await dialog.getByRole('button', { name: 'Offer this' }).click();
  await expect(page.getByText('Your offering now shows on this request.')).toBeVisible();
  await expect(offered.getByRole('link', { name: 'Old ladder' })).toBeVisible();

  const ladderCard = offered.getByRole('listitem').filter({ hasText: 'Old ladder' });
  await ladderCard.getByRole('button', { name: 'Withdraw this offer' }).click();
  await expect(page.getByText('It no longer shows on this request.')).toBeVisible();
  await expect(offered.getByRole('link', { name: 'Old ladder' })).toHaveCount(0);
  await expectAccessible(page, 'request page with offers');
});

test('asking for an offering found on its own asks whether it is for an open request', async ({ page }) => {
  const sam = createFounder('Sam');
  const rana = await createInvitedMember(sam, 'Rana');
  const request = await createRequestFor(rana, { kind: 'borrow', title: 'Ladder' });
  const ladder = await createOfferingFor(sam, { type: 'lend', title: 'Tall ladder' });
  await signInAs(page, rana);
  await page.goto(`/offerings/${ladder.id}`);
  await page.getByRole('link', { name: 'Ask to borrow' }).click();
  await expect(page.getByText('Is this for one of your requests?')).toBeVisible();
  await expectAccessible(page, 'is this for a request');
  await page.getByRole('radio', { name: 'Yes, for my request “Ladder”' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('This is for your request: Ladder.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Send proposal' }).click();
  await expect(page.getByText('Your proposal was sent to Sam.')).toBeVisible();
  await page.goto(`/requests/${request.id}`);
  await expect(
    page
      .getByRole('region', { name: 'Offered for this request' })
      .getByRole('link', { name: 'Tall ladder' })
  ).toBeVisible();
});
