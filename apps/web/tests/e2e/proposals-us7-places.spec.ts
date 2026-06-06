// 002 US7: pick places from suggestions, by keyboard, with a plain-text fallback (quickstart 10).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { createFounder, createInvitedMember, createListingFor, daysAhead, proposeOn } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('place suggestions can be picked by keyboard; typed text works too', async ({ page }) => {
  const sam = createFounder('Sam');
  await signInAs(page, sam);
  await page.goto('/listings/new');
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
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: '3 suggestions' })).toHaveCount(1);
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
  await page.getByRole('button', { name: 'Publish listing' }).click();
  await expect(page.getByText('Your listing is published.')).toBeVisible();
  // The owner sees the full place; the area shown to others is the neighbourhood and city.
  await expect(page.getByText('1 Mill Street, Riverside, Springfield')).toBeVisible();
});

test('a proposal with a picked place can be changed, and problems are spelled out', async ({ page }) => {
  const sam = createFounder('Sam');
  const robin = await createInvitedMember(sam, 'Robin');
  const drill = await createListingFor(sam, { type: 'lend', title: 'Drill' });
  const place = { label: '1 Mill Street, Riverside, Springfield', source: 'suggestion', street: 'Mill Street', houseNumber: '1', neighbourhood: 'Riverside', city: 'Springfield' };
  const made = await proposeOn(robin, drill.id, { handover: 'to_requester', place });
  await signInAs(page, robin);
  await page.goto(`/proposals/${made.id}/edit`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('combobox', { name: /Where/ })).toHaveValue('1 Mill Street, Riverside, Springfield');
  await page.getByLabel('Day').fill(daysAhead(4));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(/Robin changed the pickup time/)).toBeVisible();

  // A problem is named, not just "Some details need fixing."
  await page.goto(`/proposals/${made.id}/edit`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('For how long?: number').fill('3');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert').getByText('For how long: Please choose hours, days, or weeks.')).toBeVisible();
});
