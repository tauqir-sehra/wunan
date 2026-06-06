// 002 US3: trades accept listed things, or anything when open to offers (quickstart 6).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { createFounder, createInvitedMember, createOfferingFor } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('an offer is chosen from the list, or described when open to offers', async ({ page }) => {
  const kim = createFounder('Kim');
  const ana = await createInvitedMember(kim, 'Ana');
  const starter = await createOfferingFor(kim, {
    type: 'trade',
    title: 'Sourdough starter',
    accepts: [{ description: 'Eggs', amount: '6', unit: 'item' }, { description: 'Honey' }]
  });
  const boots = await createOfferingFor(kim, { type: 'trade', title: 'Boots' });
  await signInAs(page, ana);

  await page.goto(`/offerings/${starter.id}`);
  await expect(page.getByRole('definition').filter({ hasText: 'Eggs (6 items)' })).toContainText(
    'Honey'
  );
  await page.getByRole('link', { name: 'Offer a trade' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('checkbox', { name: /Eggs/ }).check();
  await page.getByLabel('How much Eggs').fill('6');
  await expectAccessible(page, 'trade offer from a list');
  await page.getByRole('button', { name: 'Send proposal' }).click();
  await expect(page.getByText('Eggs (6 items)')).toBeVisible();

  await page.goto(`/offerings/${boots.id}`);
  await expect(page.getByText("Open to offers: Kim hasn't listed anything specific")).toBeVisible();
  await page.getByRole('link', { name: 'Offer a trade' }).click();
  await page.getByLabel('What would you offer in return?').fill('A jar of honey');
  await page.getByRole('button', { name: 'Send proposal' }).click();
  await expect(page.getByText('A jar of honey')).toBeVisible();
});
