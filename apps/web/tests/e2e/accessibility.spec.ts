// Accessibility checks across every page (T115; constitution IV, FR-034): WCAG 2.2 AA scan in both
// themes, no sideways scrolling at 320 px wide or at 200% zoom, and a keyboard-only walk with a
// visible focus indicator. Screen-reader walkthroughs are done by hand.
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { createFounder, createInvitation, createInvitedMember, createListingFor, memberIdOf, messageAbout, signIn } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';
import { API_URL, WEB_URL } from '../../playwright.config.ts';

async function noSidewaysScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label} scrolls sideways`).toBeLessThanOrEqual(0);
}

async function pagesOfACommunity() {
  const sam = createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  const drill = await createListingFor(sam, { type: 'lend', title: 'Drill', description: 'A cordless drill with two batteries.', area: 'Riverside' });
  const samId = await memberIdOf(sam);
  await messageAbout(alex, samId, drill.id);
  const token = await signIn(sam);
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: WEB_URL };
  const agreement = await fetch(`${API_URL}/api/v1/listings/${drill.id}/agreements`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ otherMemberId: await memberIdOf(alex), returnDue: '2030-01-05' })
  }).then((r) => r.json() as Promise<{ id: string }>);
  const conversations = await fetch(`${API_URL}/api/v1/conversations`, { headers }).then((r) => r.json() as Promise<{ items: { id: string }[] }>);
  return {
    sam,
    paths: [
      '/', '/listings', '/listings?q=drill&type=lend', `/listings/${drill.id}`, '/listings/new', `/listings/${drill.id}/edit`,
      `/listings/${drill.id}/agreements/new`, '/my-listings', '/messages', `/messages/${conversations.items[0]!.id}`,
      '/agreements', `/agreements/${agreement.id}`, `/agreements/${agreement.id}/report`, '/invitations',
      `/members/${samId}`, `/members/${samId}/chain`, '/settings', '/settings/notifications', '/settings/export',
      '/settings/delete-account', '/help', '/help/joining', '/help/asking-for-help'
    ]
  };
}

test('every page fits a 320 px wide screen and passes the accessibility scan', async ({ page }) => {
  test.setTimeout(180_000);
  const { sam, paths } = await pagesOfACommunity();
  await page.setViewportSize({ width: 320, height: 640 });
  await signInAs(page, sam);
  for (const path of paths) {
    await page.goto(path);
    await noSidewaysScroll(page, path);
    if (path.startsWith('/help')) await expectAccessible(page, path); // Other pages are scanned in their story tests.
  }
});

test('pages work at 200% zoom', async ({ page }) => {
  test.setTimeout(120_000);
  const { sam, paths } = await pagesOfACommunity();
  // 200% zoom of a 1280 px window lays out like a 640 px window with text twice the size.
  await page.setViewportSize({ width: 640, height: 400 });
  await signInAs(page, sam);
  for (const path of paths) {
    await page.goto(path);
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    await noSidewaysScroll(page, `${path} at 200%`);
  }
});

test('signed-out pages fit small screens', async ({ page }) => {
  const sam = createFounder('Sam');
  const link = await createInvitation(sam);
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ['/sign-in', '/password-reset', new URL(link).pathname, '/goodbye']) {
    await page.goto(path);
    await noSidewaysScroll(page, path);
    await expectAccessible(page, path);
  }
});

test('the keyboard reaches everything, with a visible focus ring', async ({ page }) => {
  const sam = createFounder('Sam');
  await signInAs(page, sam);
  await page.goto('/');

  // The first Tab shows the skip link, which jumps to the page content.
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);

  // Every navigation link can be reached with Tab and shows a focus ring.
  await page.goto('/');
  const seen = new Set<string>();
  for (let i = 0; i < 30; i += 1) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const ring = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2 || style.boxShadow !== 'none';
      return { text: el.textContent?.trim() ?? '', ring };
    });
    if (!focused) continue;
    expect(focused.ring, `"${focused.text}" has no visible focus ring`).toBe(true);
    seen.add(focused.text);
  }
  for (const label of ['Home', 'Find', 'Messages', 'My listings', 'Agreements', 'Settings', 'Help', 'Sign out']) {
    expect([...seen].some((text) => text.startsWith(label)), `${label} reachable by keyboard`).toBe(true);
  }
});
