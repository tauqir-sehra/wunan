// 003 US2: offerings that might already have it are suggested while a request is typed (quickstart 2).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { createFounder, createInvitedMember, createOfferingFor } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('typing a title suggests matching offerings, and the unfinished request is kept', async ({
  page
}) => {
  const sam = createFounder('Sam');
  const rana = await createInvitedMember(sam, 'Rana');
  // A made-up word, so offerings from other tests never match.
  const word = `zorbit${Date.now()}`;
  await createOfferingFor(sam, { type: 'lend', title: `Cordless ${word}` });
  await createOfferingFor(sam, { type: 'gift', title: `${word} bits` });
  await signInAs(page, rana);

  await page.goto('/requests/new');
  await page.waitForLoadState('networkidle');
  await page.getByRole('radio', { name: /Borrow/ }).check();
  await page.getByLabel('Title').fill(word);
  const box = page.getByRole('region', { name: 'These might already have what you need' });
  await expect(box.getByRole('link', { name: `Cordless ${word}` })).toBeVisible();
  await expect(box.getByRole('link', { name: `${word} bits` })).toHaveCount(0);
  await expect(page.getByText('1 offering might already have what you need.')).toBeAttached();
  await page.getByLabel('Description').fill('For putting up shelves');
  await expectAccessible(page, 'request form with suggestions');

  await box.getByRole('link', { name: `Cordless ${word}` }).click();
  await expect(page.getByRole('heading', { name: `Cordless ${word}`, level: 1 })).toBeVisible();
  await page.goBack();
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('Title')).toHaveValue(word);
  await expect(page.getByLabel('Description')).toHaveValue('For putting up shelves');

  await page.getByLabel('Title').fill('zzzz nothing like it');
  await expect(box).toHaveCount(0);
});
