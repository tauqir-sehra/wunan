// 005: a profile shows how you're connected to that member through invitations, as sentences
// (for keyboards and screen readers) and as a drawing (hidden from screen readers).
import { expect, test, type Page } from '@playwright/test';
import { API_URL, WEB_URL } from '../../playwright.config.ts';
import { expectAccessible } from './helpers/axe.ts';
import {
  createFounder,
  createInvitedMember,
  memberIdOf,
  signIn,
  type TestMember
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

/** Fay → Ben → You and Fay → Chloe → Faraz → Rosa, as in the spec's picture. */
async function family() {
  const fay = createFounder('Fay');
  const ben = await createInvitedMember(fay, 'Ben');
  const chloe = await createInvitedMember(fay, 'Chloe');
  const you = await createInvitedMember(ben, 'You');
  const faraz = await createInvitedMember(chloe, 'Faraz');
  const rosa = await createInvitedMember(faraz, 'Rosa');
  return { fay, ben, chloe, you, faraz, rosa };
}

async function openProfile(page: Page, member: TestMember) {
  await page.goto(`/members/${await memberIdOf(member)}`);
  await page.waitForLoadState('networkidle');
}

const section = (page: Page) =>
  page.getByRole('region', { name: /How you're connected|Your invite line/ });

async function fitsWithoutSideScroll(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, `sideways scroll at ${width}px`).toBeLessThanOrEqual(0);
}

test('shows two branches from the person you both trace back to', async ({ page }) => {
  test.slow();
  const { you, rosa } = await family();
  await signInAs(page, you);
  await openProfile(page, rosa);

  const connection = section(page);
  await expect(connection.getByRole('heading', { name: "How you're connected" })).toBeVisible();
  await expect(connection.locator('p')).toHaveText(['You both trace back to Fay.']);
  await expect(connection.getByText('You both trace back to Fay', { exact: true })).toBeVisible();

  // Each branch is a named list, and the keyboard reaches each person once.
  await expect(connection.getByRole('list', { name: 'From Fay down to you' })).toBeVisible();
  const theirs = connection.getByRole('list', { name: 'From Fay down to Rosa' });
  await expect(theirs.getByRole('listitem')).toHaveText([/Chloe/, /Faraz/, /Rosa/]);
  for (const name of ['Fay', 'Ben', 'Chloe', 'Faraz', 'Rosa']) {
    await expect(connection.getByRole('link', { name, exact: true })).toHaveCount(1);
  }
  await expect(connection.locator('[tabindex="-1"]')).toHaveCount(0);

  await expectAccessible(page, 'profile with a shared ancestor');
  // 320 px wide, and 1280 px at 200% zoom (the same 640 CSS pixels).
  await fitsWithoutSideScroll(page, 320);
  await fitsWithoutSideScroll(page, 640);
});

test('draws one line when one of you is in the other’s line, and your own line', async ({
  page,
  browser
}) => {
  test.slow();
  const { fay, ben, you } = await family();
  const sam = await createInvitedMember(you, 'Sam');
  const lee = await createInvitedMember(sam, 'Lee');
  await signInAs(page, you);

  await openProfile(page, ben);
  await expect(section(page).locator('p')).toHaveText(['Ben invited you.']);
  await expect(section(page).getByText(/trace back/)).toHaveCount(0);

  await openProfile(page, fay);
  await expect(section(page).locator('p')).toHaveText(['Fay invited Ben, who invited you.']);

  await openProfile(page, lee);
  await expect(section(page).locator('p')).toHaveText(['You invited Sam, who invited Lee.']);

  await openProfile(page, you);
  await expect(section(page).getByRole('heading', { name: 'Your invite line' })).toBeVisible();
  await expect(section(page).locator('p')).toHaveText(['Fay invited Ben, who invited you.']);
  await expectAccessible(page, 'your own invite line');

  const fayContext = await browser.newContext();
  const fayPage = await fayContext.newPage();
  await signInAs(fayPage, fay);
  await openProfile(fayPage, fay);
  await expect(section(fayPage).locator('p')).toHaveText(['You started this community.']);
  await fayContext.close();
});

test('shows both lines when they go back to different founders, and people who left', async ({
  page
}) => {
  test.slow();
  const { you, rosa } = await family();
  const omar = createFounder('Omar');
  const pia = await createInvitedMember(omar, 'Pia');
  await signInAs(page, you);

  await openProfile(page, pia);
  await expect(section(page).locator('p')).toHaveText([
    'You and Pia trace back to different founding members.'
  ]);
  await expect(
    section(page).getByRole('list', { name: 'From Fay down to you' }).getByRole('listitem')
  ).toHaveText([/Fay/, /Ben/, /You/]);
  await expect(
    section(page).getByRole('list', { name: 'From Omar down to Pia' }).getByRole('listitem')
  ).toHaveText([/Omar/, /Pia/]);
  await expectAccessible(page, 'lines from different founders');

  // Rosa leaves: her profile still shows how you were connected, without a link to her.
  const rosaId = await memberIdOf(rosa);
  const leave = await fetch(`${API_URL}/api/v1/me`, {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${await signIn(rosa)}`,
      'content-type': 'application/json',
      origin: WEB_URL
    },
    body: JSON.stringify({ password: rosa.password })
  });
  expect(leave.status).toBe(204);
  await page.goto(`/members/${rosaId}`);
  await expect(section(page).getByText('Rosa (no longer a member)')).toBeVisible();
  await expect(section(page).locator('a', { hasText: 'Rosa' })).toHaveCount(0);
});
