// US6: ask for help when something goes wrong (quickstart scenario 7).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { createFounder, createInvitedMember, createListingFor, memberIdOf, messageAbout } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test("the borrower's inviter helps in a shared conversation; escalation ends with the founders", async ({ page, browser }) => {
  const sam = createFounder('Sam');
  const robin = await createInvitedMember(sam, 'Robin');
  const alex = await createInvitedMember(robin, 'Alex'); // Robin invited Alex.
  const drill = await createListingFor(sam, { type: 'lend', title: 'Drill' });
  await messageAbout(alex, await memberIdOf(sam), drill.id);

  // Sam lends the drill to Alex.
  await signInAs(page, sam);
  await page.goto(`/listings/${drill.id}/agreements/new`);
  await page.getByRole('radio', { name: 'Alex' }).check();
  await page.getByLabel('Back by').fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Review' }).click();
  await page.getByRole('button', { name: 'Record agreement' }).click();

  // Sam asks for help.
  await page.getByRole('link', { name: 'Ask for help' }).click();
  await expectAccessible(page, 'ask for help');
  await page.getByLabel('What happened?').fill("The drill hasn't come back and I haven't heard from Alex.");
  await page.getByRole('button', { name: 'Review' }).click();
  await page.getByRole('button', { name: 'Ask for help' }).click();
  await expect(page.getByText('Your request for help was sent.')).toBeVisible();
  await expect(page.getByText('The person who invited them is helping.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Who is helping' }).getByText('Robin')).toBeVisible();
  await expectAccessible(page, 'request for help');
  const reportUrl = new URL(page.url()).pathname;

  // Robin is in a three-way conversation with Sam and Alex.
  const robinContext = await browser.newContext();
  const robinPage = await robinContext.newPage();
  await signInAs(robinPage, robin);
  await robinPage.goto('/messages');
  await expect(robinPage.getByText('(asking for help)')).toBeVisible();
  await robinPage.getByRole('link', { name: /Sam, Alex|Alex, Sam/ }).click();
  await expect(robinPage.getByText(/has been added to help/)).toBeVisible();
  await expect(robinPage.getByRole('list', { name: 'Messages' }).getByText("The drill hasn't come back")).toBeVisible();
  await expectAccessible(robinPage, 'mediation conversation');
  await robinContext.close();

  // Asking for more help goes to the founders (Robin's inviter is Sam, already in it): the last step.
  await page.goto(reportUrl);
  await page.getByRole('button', { name: 'Ask for more help' }).click();
  await expect(page.getByText('The founding members are helping. This is the last step.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask for more help' })).toHaveCount(0);

  // Alex keeps full access and can see the request.
  const alexContext = await browser.newContext();
  const alexPage = await alexContext.newPage();
  await signInAs(alexPage, alex);
  await alexPage.goto(reportUrl);
  await expect(alexPage.getByRole('heading', { name: 'Asking for help: Drill' })).toBeVisible();
  await alexPage.goto('/listings/new');
  await expect(alexPage.getByRole('heading', { name: 'Share something' })).toBeVisible();
  await alexContext.close();

  // Settling it keeps the note with the agreement.
  await page.getByLabel('How was it settled?').fill('Alex brought it back on Sunday.');
  await page.getByRole('button', { name: 'Mark as settled' }).click();
  await expect(page.getByText('Marked as settled.')).toBeVisible();
  await page.getByRole('link', { name: 'Back to the agreement' }).click();
  await expect(page.getByText('Alex brought it back on Sunday.')).toBeVisible();
});
