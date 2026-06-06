// US1: join by invitation and see who vouches for whom (quickstart scenario 1).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { createFounder, waitForEmailLink } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('a member invites someone, who joins and shows the inviter on their profile', async ({
  page,
  browser
}) => {
  const founder = createFounder('Sam');

  // Founder creates an invitation.
  await signInAs(page, founder);
  await expectAccessible(page, 'home');
  await page.goto('/invitations');
  await expectAccessible(page, 'invitations');
  await page.getByRole('button', { name: 'Create an invitation link' }).click();
  const link = await page.getByLabel(/shown only once/).inputValue();
  expect(link).toContain('/join/');
  await expectAccessible(page, 'invitation created');

  // Alex joins in a separate browser context, leaving the email checkbox unticked.
  const alexContext = await browser.newContext();
  const alex = await alexContext.newPage();
  const email = `alex.${Date.now()}@example.org`;
  await alex.goto(new URL(link).pathname);
  await expect(alex.getByRole('heading', { name: "Join Sam's community" })).toBeVisible();
  await expectAccessible(alex, 'join');
  await alex.getByLabel('Email', { exact: true }).fill(email);
  await alex.getByLabel('Your name').fill('Alex');
  await alex.getByLabel('Password').fill('correct horse battery');
  await expect(alex.getByRole('checkbox')).not.toBeChecked();
  await alex.getByRole('button', { name: 'Join' }).click();
  await expect(alex.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expect(alex.getByText('The link works for 7 days.')).toBeVisible();
  await expectAccessible(alex, 'check your email');

  // Alex opens the confirmation email (Mailpit) and finishes joining.
  const confirmToken = await waitForEmailLink(email, /\/join\/confirm\/([^\s"<>]+)/);
  await alex.goto(`/join/confirm/${confirmToken}`);
  await expectAccessible(alex, 'finish joining');
  await alex.getByRole('button', { name: 'Finish joining' }).click();
  await expect(alex.getByText("Welcome to wunan. You're now a member.")).toBeVisible();

  // Alex's profile shows who invited them; the founder's shows "Founding member".
  await alex.locator('summary', { hasText: 'Alex' }).click(); // The account menu, under the member's name.
  await alex.getByRole('link', { name: 'Your profile' }).click();
  await expect(alex.getByRole('heading', { name: 'Alex', level: 1 })).toBeVisible();
  await expect(alex.getByRole('link', { name: 'Sam' })).toBeVisible();
  await expectAccessible(alex, 'profile');
  await alex.getByRole('link', { name: 'Sam' }).click();
  await expect(alex.getByText('Founding member').first()).toBeVisible();
  await alex.goBack();
  await alex.getByRole('link', { name: 'See the full invite chain' }).click();
  await expect(alex.getByRole('main').getByRole('listitem')).toHaveText([
    /Alex/,
    /Sam.*founding member/
  ]);
  await expectAccessible(alex, 'chain');

  // The used link no longer works.
  await alexContext.clearCookies();
  await alex.goto(new URL(link).pathname);
  await expect(alex.getByRole('heading', { name: "This invitation can't be used" })).toBeVisible();
  await expectAccessible(alex, 'used invitation');

  // Signed out, member pages redirect to sign-in.
  await alex.goto('/offerings');
  await expect(alex).toHaveURL(/\/sign-in\?redirectTo=%2Fofferings/);
  await expectAccessible(alex, 'sign in');

  // The founder's invitations list shows Alex joined.
  await page.goto('/invitations');
  await expect(page.getByText('Used')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alex' })).toBeVisible();
  await alexContext.close();
});

test('settings save profile and private contact details', async ({ page }) => {
  const founder = createFounder('Robin');
  await signInAs(page, founder);
  await page.goto('/settings');
  await expectAccessible(page, 'settings');
  await page.getByLabel('About you').fill('I bake bread on Sundays.');
  await page.getByLabel('Phone number').fill('07700 900123');
  await expect(page.getByRole('button', { name: /^Save/ })).toHaveCount(1); // One button saves it all.
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Your settings are saved.')).toBeVisible();
  await expect(page.getByLabel('About you')).toHaveValue('I bake bread on Sundays.');
  await expect(page.getByLabel('Phone number')).toHaveValue('07700 900123');
});

test('if the sign-in runs out mid-form, signing in again sends what was typed', async ({
  page,
  context
}) => {
  const founder = createFounder('Kim');
  await signInAs(page, founder);
  await page.goto('/settings');
  await page.getByLabel('About you').fill('Kept through sign-in.');
  await context.clearCookies(); // The session runs out while the member is typing.
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Please sign in again' })).toBeVisible();
  await expectAccessible(page, 'sign in again');
  await page.getByLabel('Email').fill(founder.email);
  await page.getByLabel('Password').fill(founder.password);
  await page.getByRole('button', { name: 'Sign in and send' }).click();

  await expect(page.getByText('Your settings are saved.')).toBeVisible();
  await expect(page.getByLabel('About you')).toHaveValue('Kept through sign-in.');
});
