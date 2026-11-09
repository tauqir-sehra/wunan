// The light/dark choice at the bottom of the menu: it overrides the device setting, changes the
// colours in place, is remembered on this device, and works without JavaScript.
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { createFounder } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

const background = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('picking dark or light in the menu overrides the device and is remembered', async ({
  page
}) => {
  const sam = createFounder('Sam');
  await page.emulateMedia({ colorScheme: 'light' });
  await signInAs(page, sam);
  await page.goto('/offerings');
  await page.waitForLoadState('networkidle');
  const light = await background(page);

  await page.locator('summary', { hasText: 'Sam' }).click();
  const colours = page.getByRole('group', { name: 'Colours' });
  await expect(colours.getByRole('button', { name: 'Auto' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expectAccessible(page, 'account menu with colours');
  const saved = page.waitForResponse((r) => r.url().endsWith('/theme') && r.status() === 204);
  await colours.getByRole('button', { name: 'Dark' }).click();
  await saved;
  await expect(colours.getByRole('button', { name: 'Dark' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(colours).toBeVisible(); // The menu stays open.
  await expect.poll(() => background(page)).not.toBe(light);
  const dark = await background(page);

  await page.reload();
  expect(await background(page)).toBe(dark);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Following the device again.
  await page.locator('summary', { hasText: 'Sam' }).click();
  await page.getByRole('group', { name: 'Colours' }).getByRole('button', { name: 'Auto' }).click();
  await expect.poll(() => background(page)).toBe(light);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => background(page)).toBe(dark);
});

test('the colours choice works without JavaScript', async ({ browser }) => {
  const robin = createFounder('Robin');
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'light' });
  const page = await context.newPage();
  await signInAs(page, robin);
  await page.goto('/offerings?mine=true');
  await page.locator('summary', { hasText: 'Robin' }).click();
  await page.getByRole('group', { name: 'Colours' }).getByRole('button', { name: 'Dark' }).click();
  await expect(page).toHaveURL(/\/offerings\?mine=true$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await context.close();
});
