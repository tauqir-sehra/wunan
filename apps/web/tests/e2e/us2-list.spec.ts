// US2: list a resource to share (quickstart scenario 2) and flag an offering (scenario 8).
import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { expectAccessible } from './helpers/axe.ts';
import { createFounder, createInvitedMember } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

const PHOTO = fileURLToPath(new URL('./fixtures/phone-photo.jpg', import.meta.url));

/** Walks through the four steps; `details` fills in step 2. */
async function createOffering(
  page: Page,
  kind: 'Lend' | 'Gift' | 'Trade' | 'Service',
  title: string,
  details: (page: Page) => Promise<void> = async () => {},
  { area = '', photo = false, check = false } = {}
) {
  await page.goto('/offerings/new');
  await page.waitForLoadState('networkidle'); // The steps need the page to be ready.
  if (check) await expectAccessible(page, 'new offering: kind');
  await page.getByRole('radio', { name: new RegExp(`^${kind}`) }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Step 2 of 4')).toBeVisible();
  if (check) await expectAccessible(page, 'new offering: details');
  await page.getByLabel('Title').fill(title);
  await details(page);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Step 3 of 4')).toBeVisible();
  if (check) await expectAccessible(page, 'new offering: area');
  if (area) await page.getByRole('combobox', { name: /^Area/ }).fill(area);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Step 4 of 4')).toBeVisible();
  if (check) await expectAccessible(page, 'new offering: review');
  if (photo) {
    const addPhoto = page.getByRole('button', { name: 'Add a photo' });
    if (await addPhoto.isVisible()) {
      // With JavaScript, "Add a photo" opens the file picker and the photo becomes a row.
      const chooser = page.waitForEvent('filechooser');
      await addPhoto.click();
      await (await chooser).setFiles(PHOTO);
      await expect(page.getByLabel('Describe photo 1')).toBeFocused();
      await expect(page.getByRole('button', { name: 'Take out photo 1' })).toBeVisible();
      if (check) await expectAccessible(page, 'new offering: photo chosen');
    } else {
      await page.getByLabel('Photo 1', { exact: true }).setInputFiles(PHOTO);
    }
    await page.getByLabel('Describe photo 1').fill('Bag of brown rice');
  }
  await page.getByRole('button', { name: 'Publish offering' }).click();
  await expect(page.getByText('Your offering is published.')).toBeVisible();
}

test('a member lists one of each kind, and photos lose their location data', async ({ page }) => {
  test.slow(); // Lists four offerings and scans each step.
  const founder = createFounder('Sam');
  await signInAs(page, founder);

  await createOffering(
    page,
    'Gift',
    'Rice',
    async (p) => {
      await p.getByLabel('Amount: number').fill('5');
      await p.getByLabel('Amount: unit').selectOption('kg');
    },
    { area: 'Riverside', photo: true, check: true }
  );
  await expect(page.getByText('5 kg available')).toBeVisible();
  await expect(page.getByRole('definition').filter({ hasText: 'Riverside' })).toBeVisible();
  await expectAccessible(page, 'offering page');

  // The served photo is WebP without any EXIF (location) data.
  const src = await page.getByRole('img', { name: 'Bag of brown rice' }).getAttribute('src');
  const photo = await page.request.get(src!);
  expect(photo.headers()['cache-control']).toContain('private');
  const bytes = Buffer.from(await photo.body());
  expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
  expect(bytes.includes(Buffer.from('EXIF'))).toBe(false);
  expect(bytes.includes(Buffer.from('TestPhone'))).toBe(false);

  await createOffering(page, 'Lend', 'Drill', async (p) => {
    await p.getByLabel('Amount: number').fill('1');
    await p.getByLabel('Amount: unit').selectOption('item');
    await p.getByLabel('Longest loan: number').fill('3');
    await p.getByLabel('Longest loan: unit').selectOption('days');
  });
  await expect(page.getByText('Lend for up to 3 days')).toBeVisible();

  // A Trade lists what it accepts; with nothing listed it's plainly open to offers (002 FR-005, FR-006).
  await createOffering(page, 'Trade', 'Old records');
  await expect(page.getByText("Open to offers: Sam hasn't listed anything specific")).toBeVisible();

  await createOffering(
    page,
    'Trade',
    'Sneakers',
    async (p) => {
      await p.getByLabel('Amount: number').fill('1');
      await p.getByLabel('Amount: unit').selectOption('item');
      await p.getByRole('button', { name: 'Add something you’d accept' }).click();
      await expect(p.getByLabel('What', { exact: true })).toBeFocused();
      await p.getByLabel('What', { exact: true }).fill('Leather boots');
      await p.getByRole('button', { name: 'Add another' }).click();
      await p.getByLabel('What', { exact: true }).nth(1).fill('Wool socks');
      await p.getByRole('button', { name: 'Remove thing 2' }).click();
      await expect(
        p.locator('[aria-live="polite"]').filter({ hasText: 'Removed thing 2.' })
      ).toHaveCount(1);
      await p.getByRole('checkbox', { name: 'At my place' }).check();
    },
    { area: 'Riverside' }
  );
  await expect(page.getByRole('definition').filter({ hasText: 'Leather boots' })).toBeVisible();
  await expect(page.getByText('At my place')).toBeVisible();

  await createOffering(page, 'Service', 'Bodywork session', async (p) => {
    await p.getByLabel('How long each time: number').fill('1');
    await p.getByLabel('How long each time: unit').selectOption('hours');
    await p.getByLabel('How many times you can offer it').fill('3');
  });
  await expect(page.getByText('1 hour · 3 sessions available')).toBeVisible();

  // New units and lengths (002 US6).
  await createOffering(page, 'Gift', 'Coffee beans', async (p) => {
    await p.getByLabel('Amount: number').fill('2');
    await p.getByLabel('Amount: unit').selectOption('lb');
  });
  await expect(page.getByText('2 lb available')).toBeVisible();
  await createOffering(page, 'Service', 'Garden course', async (p) => {
    await p.getByLabel('How long each time: number').fill('2');
    await p.getByLabel('How long each time: unit').selectOption('days');
    await p.getByRole('button', { name: 'Add a time' }).click();
    await p.getByLabel('Day', { exact: true }).selectOption('Saturday');
    await p.getByLabel('From').fill('09:00');
    await p.getByLabel('To', { exact: true }).fill('17:00');
  });
  await expect(page.getByText('2 days')).toBeVisible();
  await expect(page.getByText('Saturday, 9 am–5 pm')).toBeVisible();

  await page.goto('/offerings?mine=true');
  await expect(page.getByRole('heading', { name: 'Available' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('article')).toHaveCount(7);
  await expectAccessible(page, 'my offerings');

  // Edit, pause, and remove with a confirmation step, then reopen.
  await page.getByRole('link', { name: 'Drill' }).click();
  await page.getByRole('link', { name: 'Edit' }).click();
  await expectAccessible(page, 'edit offering');
  await page.getByLabel('Title').fill('Cordless drill');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Cordless drill' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('Your offering is paused.')).toBeVisible();
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Remove this offering?')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, remove it' }).click();
  await expect(page.getByText('Your offering is removed.')).toBeVisible();
  await page.getByRole('button', { name: 'Reopen' }).click();
  await expect(page.getByText('Your offering is available again.')).toBeVisible();
});

test('a simple offering works with JavaScript turned off', async ({ browser }) => {
  const founder = createFounder('Robin');
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await signInAs(page, founder);
  await createOffering(
    page,
    'Gift',
    'Apples',
    async (p) => {
      await p.getByLabel('Amount: number').fill('2');
      await p.getByLabel('Amount: unit').selectOption('kg');
    },
    { area: 'Hillside', photo: true }
  );
  await expect(page.getByText('2 kg available')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Bag of brown rice' })).toBeVisible();
  await context.close();
});

test("another member's request reaches the owner and leaves the offering as it is", async ({
  page,
  browser
}) => {
  test.setTimeout(60_000);
  const founder = createFounder('Sam');
  const alex = await createInvitedMember(founder, 'Alex');
  await signInAs(page, founder);
  await createOffering(page, 'Gift', 'Rice');
  const url = page.url().split('?')[0]!;

  const alexContext = await browser.newContext();
  const alexPage = await alexContext.newPage();
  await signInAs(alexPage, alex);
  await alexPage.goto(url);
  await expect(alexPage.getByRole('link', { name: 'Ask for this' })).toBeVisible();
  await alexPage.waitForLoadState('networkidle');
  await alexPage.getByRole('button', { name: 'Raise an issue' }).click();
  const issue = alexPage.getByRole('dialog', { name: 'Raise an issue with Sam' });
  await issue.getByLabel('What would you like to ask?').fill('Is this still available?');
  await issue.getByRole('button', { name: 'Send to Sam' }).click();
  await expect(alexPage.getByText('Your request was sent')).toBeVisible();
  await expectAccessible(alexPage, 'offering as another member');
  await alexContext.close();

  await page.goto('/offerings?mine=true');
  await expect(page.getByRole('link', { name: '1 new request from members', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '1 new request from members', exact: true }).click();
  await expect(page.getByText('Is this still available?')).toBeVisible();
  await expect(page.getByText('Available', { exact: true })).toBeVisible();
});
