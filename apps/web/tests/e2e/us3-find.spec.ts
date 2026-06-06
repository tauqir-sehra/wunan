// US3: find something that's available (quickstart scenario 3).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { createFounder, createInvitedMember, createListingFor } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('search finds word forms, filters narrow it down, and clearing filters is one step', async ({ page }) => {
  const founder = createFounder('Sam');
  const suffix = Date.now().toString(36); // Keeps this test's listings apart from other tests'.
  await createListingFor(founder, { type: 'gift', title: `Rice ${suffix}`, amount: '5', unit: 'kg', area: 'Riverside' });
  await createListingFor(founder, { type: 'lend', title: `Drill ${suffix}`, area: 'Riverside' });
  const alex = await createInvitedMember(founder, 'Alex');
  await signInAs(page, alex);

  // Members land on Find, with every kind ticked.
  await expect(page).toHaveURL(/\/listings/);
  for (const kind of ['Lend', 'Gift', 'Trade', 'Service']) await expect(page.getByRole('checkbox', { name: kind })).toBeChecked();
  await expectAccessible(page, 'find');
  await page.getByLabel('What are you looking for?').fill(`rices ${suffix}`);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/listings\?q=/);
  const results = page.getByRole('main').getByRole('article');
  await expect(results).toHaveCount(1);
  await expect(results.getByRole('link', { name: `Rice ${suffix}` })).toBeVisible();
  await expect(results.getByText('5 kg available')).toBeVisible();
  await expectAccessible(page, 'search results');

  // Only Gift and Lend: still found. Only Trade: calm empty state.
  for (const kind of ['Trade', 'Service']) await page.getByRole('checkbox', { name: kind }).uncheck();
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/type=lend&type=gift/);
  await expect(page.getByText('Kind: Lend, Gift')).toBeVisible();
  await expect(results).toHaveCount(1);
  for (const kind of ['Lend', 'Gift']) await page.getByRole('checkbox', { name: kind }).uncheck();
  await page.getByRole('checkbox', { name: 'Trade' }).check();
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/type=trade/);
  await expect(page.getByText('Nothing matches yet. Try other words or clear the filters.')).toBeVisible();
  await expect(page.getByText('Kind: Trade')).toBeVisible();
  await expectAccessible(page, 'empty search');

  // Clear filters in one step.
  await page.getByRole('link', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL(/\/listings$/);
  await expect(page.getByRole('link', { name: `Drill ${suffix}` })).toBeVisible();

  // A link with kinds in it (e.g. bookmarked) shows just those.
  await page.goto('/listings?type=lend');
  await expect(page.getByRole('checkbox', { name: 'Gift' })).not.toBeChecked();
  await expect(page.getByRole('link', { name: `Drill ${suffix}` })).toBeVisible();
  await expect(page.getByRole('link', { name: `Rice ${suffix}` })).toHaveCount(0);
});
