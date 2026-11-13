// 002 US7: pick places from suggestions, by keyboard, with a plain-text fallback (quickstart 10).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import {
  createFounder,
  createInvitedMember,
  createOfferingFor,
  daysAhead,
  proposeOn
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('place suggestions can be picked by keyboard; typed text works too', async ({ page }) => {
  const sam = createFounder('Sam');
  await signInAs(page, sam);
  await page.goto('/offerings/new');
  await page.waitForLoadState('networkidle'); // Let the page start up before choosing, so nothing is reset.
  await page.getByRole('radio', { name: /^Lend/ }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Title').fill('Ladder');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText('Step 3 of 4')).toBeVisible();
  await page.waitForLoadState('networkidle'); // The page is a fresh load; let it finish starting up.
  const area = page.getByRole('combobox', { name: /Area/ });
  await area.pressSequentially('Riv', { delay: 50 });
  const list = page.getByRole('listbox', { name: 'Suggestions for Area' });
  await expect(list.getByRole('option')).toHaveCount(3);
  await expect(
    page.locator('[aria-live="polite"]').filter({ hasText: '3 suggestions' })
  ).toHaveCount(1);
  await expectAccessible(page, 'place suggestions open');
  await area.press('ArrowDown');
  await area.press('ArrowDown');
  await expect(area).toHaveAttribute('aria-activedescendant', /-1$/);
  await area.press('Enter');
  await expect(area).toHaveValue('1 Mill Street, Riverside, Springfield');
  await expect(list).toBeHidden();

  // A typed meeting place is fine, and a failing service just leaves plain text.
  const meeting = page.getByRole('combobox', { name: /Meeting place/ });
  await meeting.pressSequentially('broken bench', { delay: 20 });
  await expect(page.getByText("Suggestions aren't available right now.")).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Meeting place')).toBeVisible();
  await expect(page.getByText('broken bench')).toBeVisible();
  await page.getByRole('button', { name: 'Publish offering' }).click();
  await expect(page.getByText('Your offering is published.')).toBeVisible();
  // The owner sees the full place; the area shown to others is the neighbourhood and city.
  await expect(page.getByText('1 Mill Street, Riverside, Springfield')).toBeVisible();
});

test('a proposal with a picked place can be changed, and problems are spelled out', async ({
  page
}) => {
  const sam = createFounder('Sam');
  const robin = await createInvitedMember(sam, 'Robin');
  const drill = await createOfferingFor(sam, { type: 'lend', title: 'Drill' });
  const place = {
    label: '1 Mill Street, Riverside, Springfield',
    source: 'suggestion',
    street: 'Mill Street',
    houseNumber: '1',
    neighbourhood: 'Riverside',
    city: 'Springfield'
  };
  const made = await proposeOn(robin, drill.id, { handover: 'to_requester', place });
  await signInAs(page, robin);
  await page.goto(`/arrangements/${made.id}`);
  await page.waitForLoadState('networkidle');
  const details = page.locator('#details');
  // The place opens in its row with what was picked (006).
  await details.getByRole('link', { name: 'Change where', exact: true }).click();
  await expect(details.getByRole('combobox', { name: /Where/ })).toHaveValue(
    '1 Mill Street, Riverside, Springfield'
  );
  await details.getByRole('link', { name: 'Cancel', exact: true }).click();
  // Changing another detail keeps the place.
  await details.getByRole('link', { name: 'Add when', exact: true }).click();
  await details.getByLabel('Day').fill(daysAhead(4));
  await details.getByRole('button', { name: 'Save' }).click();
  await expect(details.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await expect(page.getByText(/Robin changed the pickup time/)).toBeVisible();
  await expect(details.getByText('1 Mill Street, Riverside, Springfield')).toBeVisible();

  // A problem is named beside the field, not just "Some details need fixing."
  await details.getByRole('link', { name: 'Add for how long', exact: true }).click();
  await details.getByLabel('For how long?: number').fill('3');
  await details.getByRole('button', { name: 'Save' }).click();
  await expect(details.getByText('Please choose hours, days, or weeks.')).toBeVisible();
});
