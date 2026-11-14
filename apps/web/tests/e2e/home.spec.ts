// 007: Home lists what needs the member: arrangements waiting on them, loans due back, new offers on
// their requests, and requests to change their things. Lines for offers and changes stay until
// pressed on Home. Nothing else is on the page, and it works without JavaScript.
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import {
  acceptArrangement,
  completeDetails,
  createFounder,
  createInvitedMember,
  createOfferingFor,
  createRequestFor,
  daysAhead,
  flagOfferingFor,
  linkOfferingFor,
  proposeOn
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

const group = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

async function fitsWithoutSideScroll(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, `sideways scroll at ${width}px`).toBeLessThanOrEqual(0);
}

/** "Thursday 20 November" for a due day, as Home writes it. */
const dueWords = (date: Date) =>
  `${date.toLocaleDateString('en-GB', { weekday: 'long' })} ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;

test('lands on Home, which lists what is waiting on you, and nothing else', async ({ page }) => {
  test.slow();
  const fay = createFounder('Fay');
  const sam = await createInvitedMember(fay, 'Sam');
  const ladder = await createOfferingFor(fay, { type: 'lend', title: 'Ladder' });
  const drill = await createOfferingFor(fay, { type: 'lend', title: 'Drill' });
  const ready = await proposeOn(sam, ladder.id, completeDetails('lend'));
  const notReady = await proposeOn(sam, drill.id, { handover: 'online' });
  // Sam's message on the drill makes it wait on Fay too; reading it leaves only the ladder.
  await signInAs(page, fay);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Waiting on you' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'wunan' })).toHaveAttribute('href', '/');

  const arrangements = group(page, 'Arrangements');
  await expect(
    arrangements.getByRole('link', {
      name: /^Ladder\s*Sam asked you\s*,\s*Ready for you to accept/
    })
  ).toHaveAttribute('href', `/arrangements/${ready.id}`);
  // No search box, no filled button.
  await expect(page.locator('main').getByRole('searchbox')).toHaveCount(0);
  await expect(page.locator('main [data-slot="button"].bg-primary')).toHaveCount(0);
  await expectAccessible(page, 'home with lines');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page, 'home with lines, dark');
  await page.emulateMedia({ colorScheme: 'light' });

  // Read the drill's message: it no longer waits on Fay.
  await page.goto(`/arrangements/${notReady.id}`);
  await page.goto('/');
  await expect(arrangements.getByRole('link')).toHaveCount(1);

  // Read Sam's message on the ladder and accept it: back on Home, it's gone.
  await page.goto(`/arrangements/${ready.id}`);
  await acceptArrangement(fay, ready.id);
  await page.goto('/');
  await expect(page.getByText('Nothing right now.')).toBeVisible();
});

test('the header has Home first, marked current only on Home', async ({ page }) => {
  const fay = createFounder('Fay');
  await signInAs(page, fay);
  await page.setViewportSize({ width: 1280, height: 800 });
  const nav = page.getByRole('navigation', { name: 'Main' }).first();
  const links = nav.getByRole('link');
  await expect(links.first()).toHaveText('Home');
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  await page.goto('/offerings');
  await expect(nav.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current', 'page');
});

test('nothing needs you: one line, and nothing more', async ({ page }) => {
  const fay = createFounder('Fay');
  await signInAs(page, fay);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Waiting on you' })).toBeVisible();
  await expect(page.getByText('Nothing right now.')).toBeVisible();
  await expect(page.locator('main h2')).toHaveCount(0);
  await expect(page.locator('main').getByRole('searchbox')).toHaveCount(0);
  await expectAccessible(page, 'home, nothing');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page, 'home, nothing, dark');
  await fitsWithoutSideScroll(page, 320);
});

test('due back: both sides see it from two days before, with the date', async ({
  page,
  browser
}) => {
  test.slow();
  const fay = createFounder('Fay');
  const sam = await createInvitedMember(fay, 'Sam');
  const drill = await createOfferingFor(fay, { type: 'lend', title: 'Drill' });
  const made = await proposeOn(
    sam,
    drill.id,
    completeDetails('lend', { date: daysAhead(1), loanLength: 1, loanLengthUnit: 'days' })
  );
  await acceptArrangement(fay, made.id);
  const due = dueWords(new Date(Date.now() + 2 * 86_400_000));

  await signInAs(page, sam);
  await page.goto('/');
  await expect(
    group(page, 'Due back').getByRole('link', {
      name: new RegExp(`^Drill\\s*From Fay\\s*,\\s*Due back ${due}$`)
    })
  ).toHaveAttribute('href', `/arrangements/${made.id}`);

  const fayContext = await browser.newContext();
  const fayPage = await fayContext.newPage();
  await signInAs(fayPage, fay);
  // Sam's first message is read, so the loan isn't waiting on Fay for that.
  await fayPage.goto(`/arrangements/${made.id}`);
  await fayPage.goto('/');
  await expect(
    group(fayPage, 'Due back').getByRole('link', {
      name: new RegExp(`^Drill\\s*Lent to Sam\\s*,\\s*Due back ${due}$`)
    })
  ).toBeVisible();
  await fayContext.close();
});

test('offers on your requests stay until their line is pressed', async ({ page, browser }) => {
  test.slow();
  const rana = createFounder('Rana');
  const sam = await createInvitedMember(rana, 'Sam');
  const request = await createRequestFor(rana, { kind: 'borrow', title: 'Tent' });
  const tent = await createOfferingFor(sam, { type: 'lend', title: 'Camping tent' });
  await linkOfferingFor(sam, request.id, tent.id);

  await signInAs(page, rana);
  await page.goto('/');
  const line = group(page, 'Offers on your requests').getByRole('link', {
    name: /^Tent\s*Sam offered Camping tent$/
  });
  await expect(line).toBeVisible();
  // Opening the request some other way leaves it.
  await page.goto(`/requests/${request.id}`);
  await page.goto('/');
  await expect(line).toBeVisible();
  await line.click();
  await expect(page).toHaveURL(new RegExp(`/requests/${request.id}$`));
  await page.goto('/');
  await expect(page.getByText('Nothing right now.')).toBeVisible();

  // Without JavaScript too.
  const another = await createOfferingFor(sam, { type: 'lend', title: 'Small tent' });
  await linkOfferingFor(sam, request.id, another.id);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const noJs = await context.newPage();
  await signInAs(noJs, rana);
  await noJs.goto('/');
  await group(noJs, 'Offers on your requests')
    .getByRole('link', { name: /^Tent\s*Sam offered Small tent$/ })
    .click();
  await expect(noJs).toHaveURL(new RegExp(`/requests/${request.id}$`));
  await noJs.goto('/');
  await expect(noJs.getByText('Nothing right now.')).toBeVisible();
  await context.close();
});

test('asked to change: stays until pressed on Home, even once seen', async ({ page }) => {
  const fay = createFounder('Fay');
  const sam = await createInvitedMember(fay, 'Sam');
  const drill = await createOfferingFor(fay, { type: 'lend', title: 'Drill' });
  await flagOfferingFor(sam, drill.id, 'Is the battery included?');

  await signInAs(page, fay);
  await page.goto('/');
  const line = group(page, 'Asked to change').getByRole('link', {
    name: /^Drill\s*Someone asked you to change something$/
  });
  await expect(line).toBeVisible();
  await page.goto(`/offerings/${drill.id}`);
  await page.goto('/');
  await expect(line).toBeVisible();
  await line.click();
  await expect(page).toHaveURL(new RegExp(`/offerings/${drill.id}$`));
  await page.goto('/');
  await expect(page.getByText('Nothing right now.')).toBeVisible();
});

test('a long group shows 5, and "See all" adds the rest below', async ({ page, browser }) => {
  test.slow();
  const fay = createFounder('Fay');
  const sam = await createInvitedMember(fay, 'Sam');
  for (let i = 1; i <= 7; i++) {
    const thing = await createOfferingFor(fay, { type: 'lend', title: `Thing ${i}` });
    await flagOfferingFor(sam, thing.id, 'Please add a photo.');
  }
  await signInAs(page, fay);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const asked = group(page, 'Asked to change');
  await expect(asked.getByRole('listitem')).toHaveCount(5);
  await asked.getByRole('link', { name: 'See all 7' }).click();
  await expect(asked.getByRole('listitem')).toHaveCount(7);
  await expect(asked.getByRole('link', { name: /^Thing 6\s*Someone/ })).toBeFocused();
  await expect(asked.getByRole('link', { name: /See all/ })).toHaveCount(0);

  const context = await browser.newContext({ javaScriptEnabled: false });
  const noJs = await context.newPage();
  await signInAs(noJs, fay);
  await noJs.goto('/');
  await group(noJs, 'Asked to change').getByRole('link', { name: 'See all 7' }).click();
  await expect(noJs).toHaveURL(/\?all=asked-to-change#asked-to-change$/);
  await expect(group(noJs, 'Asked to change').getByRole('listitem')).toHaveCount(7);
  await context.close();
});

test('a link to a Home line from another site goes there but leaves the line', async ({ page }) => {
  const rana = createFounder('Rana');
  const sam = await createInvitedMember(rana, 'Sam');
  const request = await createRequestFor(rana, { kind: 'borrow', title: 'Tent' });
  const tent = await createOfferingFor(sam, { type: 'lend', title: 'Camping tent' });
  await linkOfferingFor(sam, request.id, tent.id);
  await signInAs(page, rana);

  // A page on another site with a link to the line's address.
  const target = new URL(`/home/go?kind=offers&id=${request.id}`, page.url()).href;
  await page.route('http://elsewhere.example/', (route) =>
    route.fulfill({ contentType: 'text/html', body: `<a href="${target}">Go</a>` })
  );
  await page.goto('http://elsewhere.example/');
  await page.getByRole('link', { name: 'Go' }).click();
  await expect(page).toHaveURL(new RegExp(`/requests/${request.id}$`));

  await page.goto('/');
  await expect(
    group(page, 'Offers on your requests').getByRole('link', { name: /^Tent/ })
  ).toBeVisible();
});
