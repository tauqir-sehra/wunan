// US3: find something that's available (quickstart scenario 3).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { createFounder, createInvitedMember, createOfferingFor } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('search finds word forms, filters narrow it down, and clearing filters is one step', async ({
  page
}) => {
  const founder = createFounder('Sam');
  const suffix = Date.now().toString(36); // Keeps this test's offerings apart from other tests'.
  await createOfferingFor(founder, {
    type: 'gift',
    title: `Rice ${suffix}`,
    amount: '5',
    unit: 'kg',
    area: 'Riverside'
  });
  await createOfferingFor(founder, { type: 'lend', title: `Drill ${suffix}`, area: 'Riverside' });
  const alex = await createInvitedMember(founder, 'Alex');
  await signInAs(page, alex);

  // Members land on Find, with every kind ticked.
  await expect(page).toHaveURL(/\/offerings/);
  for (const kind of ['Lend', 'Gift', 'Trade', 'Service'])
    await expect(page.getByRole('checkbox', { name: kind })).toBeChecked();
  await expectAccessible(page, 'find');
  await page.getByLabel('What are you looking for?').fill(`rices ${suffix}`);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/offerings\?q=/);
  const results = page.getByRole('main').getByRole('article');
  await expect(results).toHaveCount(1);
  await expect(results.getByRole('link', { name: `Rice ${suffix}` })).toBeVisible();
  await expect(results.getByText('5 kg available')).toBeVisible();
  await expectAccessible(page, 'search results');

  // Only Gift and Lend: still found. Only Trade: calm empty state.
  for (const kind of ['Trade', 'Service'])
    await page.getByRole('checkbox', { name: kind }).uncheck();
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/type=lend&type=gift/);
  await expect(page.getByText('Kind: Lend, Gift')).toBeVisible();
  await expect(results).toHaveCount(1);
  for (const kind of ['Lend', 'Gift']) await page.getByRole('checkbox', { name: kind }).uncheck();
  await page.getByRole('checkbox', { name: 'Trade' }).check();
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/type=trade/);
  await expect(
    page.getByText('Nothing matches yet. Try other words or clear the filters.')
  ).toBeVisible();
  await expect(page.getByText('Kind: Trade')).toBeVisible();
  await expectAccessible(page, 'empty search');

  // Clear filters in one step.
  await page.getByRole('link', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL(/\/offerings$/);
  await expect(page.getByRole('link', { name: `Drill ${suffix}` })).toBeVisible();

  // A link with kinds in it (e.g. bookmarked) shows just those.
  await page.goto('/offerings?type=lend');
  await expect(page.getByRole('checkbox', { name: 'Gift' })).not.toBeChecked();
  await expect(page.getByRole('link', { name: `Drill ${suffix}` })).toBeVisible();
  await expect(page.getByRole('link', { name: `Rice ${suffix}` })).toHaveCount(0);
});

test('"Show more" adds the next results below, without jumping to the top', async ({ page }) => {
  const founder = createFounder('Sam');
  const suffix = Math.random().toString(36).slice(2, 8);
  for (let i = 0; i < 23; i += 1)
    await createOfferingFor(founder, { type: 'gift', title: `Jar ${i} ${suffix}` });
  const alex = await createInvitedMember(founder, 'Alex');
  await signInAs(page, alex);
  await page.goto(`/offerings?q=${suffix}`);
  await page.waitForLoadState('networkidle');
  const results = page.getByRole('main').getByRole('article');
  await expect(results).toHaveCount(20);

  const showMore = page.getByRole('link', { name: 'Show more' });
  await showMore.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(0);
  await showMore.click();
  await expect(results).toHaveCount(23);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(before);
  await expect(
    page.locator('[aria-live="polite"]').filter({ hasText: '3 more shown.' })
  ).toHaveCount(1);
  await expect(showMore).toHaveCount(0);
});

test('the Area filter suggests neighbourhoods and cities, and says where each one is', async ({
  page
}) => {
  const founder = createFounder('Sam');
  const suffix = Date.now().toString(36);
  await createOfferingFor(founder, { type: 'lend', title: `Ladder ${suffix}`, area: 'Riverside' });
  await createOfferingFor(founder, { type: 'lend', title: `Tent ${suffix}`, area: 'Old Town' });
  const alex = await createInvitedMember(founder, 'Alex');
  await signInAs(page, alex);
  await page.goto('/offerings');
  await page.waitForLoadState('networkidle');

  const area = page.getByRole('combobox', { name: /^Area/ });
  await area.pressSequentially('Riv', { delay: 50 });
  const options = page.getByRole('listbox', { name: 'Suggestions for Area' }).getByRole('option');
  // Only areas, each once: no street addresses or businesses.
  await expect(options).toHaveCount(2);
  await expect(options.nth(0)).toHaveText(
    /Riverside\s*Neighbourhood · Springfield, United Kingdom/
  );
  await expect(options.nth(1)).toHaveText(/Springfield\s*City or town · United Kingdom/);
  await expectAccessible(page, 'area suggestions on search');
  await options.nth(0).click();
  await expect(area).toHaveValue('Riverside');

  await page.getByLabel('What are you looking for?').fill(suffix);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/area=Riverside/);
  const results = page.getByRole('main').getByRole('article');
  await expect(results).toHaveCount(1);
  await expect(results.getByRole('link', { name: `Ladder ${suffix}` })).toBeVisible();
});
