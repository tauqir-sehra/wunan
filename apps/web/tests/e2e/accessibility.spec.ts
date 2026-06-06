// Accessibility checks across every page (T115; constitution IV, FR-034): WCAG 2.2 AA scan in both
// themes, no sideways scrolling at 320 px wide or at 200% zoom, and a keyboard-only walk with a
// visible focus indicator. Screen-reader walkthroughs are done by hand.
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { acceptProposal, completeDetails, createFounder, createInvitation, createInvitedMember, createListingFor, memberIdOf, proposeOn } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

async function noSidewaysScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label} scrolls sideways`).toBeLessThanOrEqual(0);
}

async function pagesOfACommunity() {
  const sam = createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  const drill = await createListingFor(sam, { type: 'lend', title: 'Drill', description: 'A cordless drill with two batteries.', area: 'Riverside' });
  const samId = await memberIdOf(sam);
  const deal = await proposeOn(alex, drill.id, completeDetails('lend'));
  const agreement = { id: await acceptProposal(sam, deal.id) };
  const rice = await createListingFor(sam, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
  const open = await proposeOn(alex, rice.id);
  const jam = await createListingFor(alex, { type: 'trade', title: 'Jam', accepts: [{ description: 'Eggs' }] });
  return {
    sam,
    paths: [
      '/', '/listings', '/listings?q=drill&type=lend', `/listings/${drill.id}`, '/listings/new', `/listings/${drill.id}/edit`,
      `/listings/${jam.id}/propose`, '/my-listings', '/proposals', `/proposals/${open.id}`, `/proposals/${deal.id}`,
      `/threads/${open.conversationId}/share-contact`, `/threads/${open.conversationId}/call`, `/listings/${jam.id}/issue`,
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
  await page.goto('/listings');

  // The first Tab shows the skip link, which jumps to the page content.
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);

  // Every navigation link can be reached with Tab and shows a focus ring.
  await page.goto('/listings');
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
  for (const label of ['Find', 'Proposals', 'My listings', 'Agreements', 'Invite', 'Share\u00a0something', 'Sam']) {
    expect([...seen].some((text) => text.startsWith(label)), `${label} reachable by keyboard (reached: ${[...seen].join(' | ')})`).toBe(true);
  }
  // The account menu opens from the keyboard too.
  await page.locator('summary', { hasText: 'Sam' }).focus();
  await page.keyboard.press('Enter');
  for (const label of ['Your profile', 'Settings', 'Help', 'Sign out']) {
    await expect(page.getByRole('banner').getByRole('link', { name: label, exact: true }).first()).toBeVisible();
  }
});
