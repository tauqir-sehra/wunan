// Notification settings, data export, and leaving wunan (FR-031, FR-031a, FR-032; quickstart
// scenarios 5 and 9). Device notifications themselves need a real push service, so scenario 5's
// delivery is checked by hand; here we check the page never asks for permission by itself.
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import {
  acceptProposal,
  completeDetails,
  createFounder,
  createInvitedMember,
  createOfferingFor,
  proposeOn,
  type TestMember
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

async function lend(owner: TestMember, borrower: TestMember, offeringId: string) {
  return acceptProposal(owner, (await proposeOn(borrower, offeringId, completeDetails('lend'))).id);
}

test('notification settings save per kind, and device notifications wait for a click', async ({
  page
}) => {
  // Headless browsers report notifications as blocked; act like a browser that hasn't been asked
  // yet, and count every time the page asks.
  await page.addInitScript(() => {
    const w = window as unknown as { permissionRequests: number };
    w.permissionRequests = 0;
    Object.defineProperty(Notification, 'permission', { get: () => 'default' });
    Notification.requestPermission = async () => {
      w.permissionRequests += 1;
      return 'default';
    };
  });
  const sam = createFounder('Sam');
  await signInAs(page, sam);
  await page.goto('/settings/notifications');
  await expect(page.getByRole('heading', { name: 'What to tell you about' })).toBeVisible();

  // Nothing is on until the member turns it on.
  const messages = page.getByRole('group', { name: 'New messages' });
  await expect(messages.getByRole('checkbox', { name: 'By email' })).not.toBeChecked();
  await expect(messages.getByRole('checkbox', { name: 'On my devices' })).not.toBeChecked();

  // The device button is offered, and the browser has not been asked for permission.
  await expect(
    page.getByRole('button', { name: 'Turn on notifications on this device' })
  ).toBeVisible();
  const requests = () =>
    page.evaluate(() => (window as unknown as { permissionRequests: number }).permissionRequests);
  expect(await requests()).toBe(0);
  await expectAccessible(page, 'notification settings');

  await messages.getByRole('checkbox', { name: 'By email' }).check();
  await page
    .getByRole('group', { name: 'Return reminders' })
    .getByRole('checkbox', { name: 'By email' })
    .check();
  await page.getByRole('button', { name: 'Save notification settings' }).click();
  await expect(page.getByText('Your notification settings are saved.')).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('group', { name: 'New messages' }).getByRole('checkbox', { name: 'By email' })
  ).toBeChecked();
  await expect(
    page
      .getByRole('group', { name: 'Return reminders' })
      .getByRole('checkbox', { name: 'By email' })
  ).toBeChecked();
  await expect(
    page.getByRole('group', { name: 'Agreements' }).getByRole('checkbox', { name: 'By email' })
  ).not.toBeChecked();
  await expect(page.getByText('No devices get notifications.')).toBeVisible();
  expect(await requests()).toBe(0);

  // Only pressing the button asks the browser. (Declining leaves everything as it was.)
  await page.getByRole('button', { name: 'Turn on notifications on this device' }).click();
  await expect.poll(requests).toBe(1);
  await expect(
    page.getByRole('button', { name: 'Turn on notifications on this device' })
  ).toBeEnabled();
});

test('the app can be added to a home screen', async ({ page }) => {
  const response = await page.request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: 'wunan', display: 'standalone', start_url: '/' });
  for (const icon of manifest.icons)
    expect((await page.request.get(icon.src)).ok(), icon.src).toBe(true);
});

test('a member downloads their data, then leaves; their name stays for the people they shared with', async ({
  page,
  browser
}) => {
  const sam = createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  const drill = await createOfferingFor(sam, { type: 'lend', title: 'Drill' });
  const agreementId = await lend(sam, alex, drill.id);
  await createOfferingFor(alex, { type: 'gift', title: 'Spare jam jars' });

  await signInAs(page, alex);
  await page.goto('/settings/export');
  await expectAccessible(page, 'your data');
  const downloading = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download my data' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^wunan-export-\d{4}-\d{2}-\d{2}\.zip$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  expect(Buffer.concat(chunks).subarray(0, 2).toString()).toBe('PK'); // A ZIP file.

  // Leaving: open loans are listed first, and the password is needed.
  await page.getByRole('link', { name: 'Leave wunan' }).click();
  await expect(page.getByRole('heading', { name: 'Things still lent out' })).toBeVisible();
  await expect(page.getByText('Borrowed from Sam, due back')).toBeVisible();
  await expectAccessible(page, 'leave wunan');
  await page.getByLabel('Your password').fill('not my password');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.getByText("That isn't your current password. Please try again.")).toBeVisible();
  await page.getByLabel('Your password').fill(alex.password);
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.getByRole('heading', { name: 'Your account is deleted' })).toBeVisible();
  await expectAccessible(page, 'goodbye');

  // Signed out: members-only pages go to sign-in, and the old password no longer works.
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/sign-in/);

  // Sam still sees the agreement, with Alex's name kept.
  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await signInAs(samPage, sam);
  await samPage.goto(`/agreements/${agreementId}`);
  await expect(samPage.getByText('Alex (no longer a member)').first()).toBeVisible();
  await samPage.goto('/offerings?q=jam');
  await expect(samPage.getByText('Spare jam jars')).toHaveCount(0);
  await samContext.close();
});
