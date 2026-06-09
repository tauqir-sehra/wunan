// Photos on an offering open large and can be moved through, by button, keyboard, or swipe;
// without JavaScript each one links to the full-size photo.
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { expectAccessible } from './helpers/axe.ts';
import {
  addPhotoFor,
  createFounder,
  createInvitedMember,
  createOfferingFor
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

const PHOTO = fileURLToPath(new URL('./fixtures/phone-photo.jpg', import.meta.url));

test('photos open large and can be moved through', async ({ page }) => {
  const sam = createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  const rice = await createOfferingFor(sam, { type: 'gift', title: 'Rice' });
  await addPhotoFor(sam, rice.id, PHOTO, 'Bag of brown rice');
  await addPhotoFor(sam, rice.id, PHOTO, 'The label on the bag');
  await signInAs(page, alex);
  await page.goto(`/offerings/${rice.id}`);
  await page.waitForLoadState('networkidle');

  await page.getByRole('link', { name: /Photo 1 of 2, open larger/ }).click();
  const viewer = page.getByRole('dialog', { name: 'Photo 1 of 2' });
  await expect(viewer.getByText('Bag of brown rice')).toBeVisible();
  await expectAccessible(page, 'photo viewer');
  await viewer.getByRole('button', { name: 'Next photo' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Photo 2 of 2' }).getByText('The label on the bag')
  ).toBeVisible();
  await page.keyboard.press('ArrowRight'); // Wraps around to the first.
  await expect(page.getByRole('dialog', { name: 'Photo 1 of 2' })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('dialog', { name: 'Photo 2 of 2' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Photo 1 of 2, open larger/ })).toBeFocused();
});

test('the photo on an offering card sits on the right and opens the photos', async ({ page }) => {
  const sam = createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  const rice = await createOfferingFor(sam, { type: 'gift', title: 'Rice for the card' });
  await addPhotoFor(sam, rice.id, PHOTO, 'Bag of brown rice');
  await addPhotoFor(sam, rice.id, PHOTO, 'The label on the bag');
  await signInAs(page, alex);
  await page.goto('/offerings?q=Rice+for+the+card');
  await page.waitForLoadState('networkidle');
  const card = page.getByRole('article').filter({ hasText: 'Rice for the card' });
  const title = await card.getByRole('link', { name: 'Rice for the card' }).boundingBox();
  const photo = card.getByRole('link', { name: /See all 2 photos/ });
  expect((await photo.boundingBox())!.x).toBeGreaterThan(title!.x);
  await photo.click();
  await expect(page.getByRole('dialog', { name: 'Photo 1 of 2' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'Photo 2 of 2' })).toBeVisible();
});
