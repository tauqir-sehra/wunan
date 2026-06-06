// US6: ask for help when something goes wrong (quickstart scenario 7).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import {
  acceptProposal,
  completeDetails,
  createFounder,
  createInvitedMember,
  createOfferingFor,
  proposeOn
} from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test("the borrower's inviter helps in a shared conversation; escalation ends with the founders", async ({
  page,
  browser
}) => {
  const sam = createFounder('Sam');
  const robin = await createInvitedMember(sam, 'Robin');
  const alex = await createInvitedMember(robin, 'Alex'); // Robin invited Alex.
  const drill = await createOfferingFor(sam, { type: 'lend', title: 'Drill' });
  // Sam lends the drill to Alex.
  const agreementId = await acceptProposal(
    sam,
    (await proposeOn(alex, drill.id, completeDetails('lend'))).id
  );
  await signInAs(page, sam);
  await page.goto(`/agreements/${agreementId}`);

  // Sam asks for help.
  await page.getByRole('link', { name: 'Ask for help' }).click();
  await expectAccessible(page, 'ask for help');
  await page
    .getByLabel('What happened?')
    .fill("The drill hasn't come back and I haven't heard from Alex.");
  await page.getByRole('button', { name: 'Review' }).click();
  await page.getByRole('button', { name: 'Ask for help' }).click();
  await expect(page.getByText('Your request for help was sent.')).toBeVisible();
  await expect(page.getByText('The person who invited them is helping.')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Who is helping' }).getByText('Robin')
  ).toBeVisible();
  await expectAccessible(page, 'request for help');
  const reportUrl = new URL(page.url()).pathname;

  // Robin is in a three-way conversation with Sam and Alex.
  const robinContext = await browser.newContext();
  const robinPage = await robinContext.newPage();
  await signInAs(robinPage, robin);
  await robinPage.goto(reportUrl);
  await robinPage.getByRole('link', { name: 'Open the shared conversation' }).click();
  await expect(robinPage.getByText(/has been added to help/)).toBeVisible();
  await expect(
    robinPage.getByRole('list', { name: 'Messages' }).getByText("The drill hasn't come back")
  ).toBeVisible();
  await expectAccessible(robinPage, 'mediation conversation');

  // Robin can't read Sam and Alex's own messages until one of them shares them (002 FR-022a).
  await robinPage.goto(reportUrl);
  await expect(
    robinPage.getByText(
      "The helpers can't see the messages you two wrote about this agreement unless one of you shares them."
    )
  ).toBeVisible();
  await page.goto(reportUrl);
  await page.getByRole('button', { name: 'Let the helpers read your messages' }).click();
  await page.getByRole('button', { name: 'Yes, share them' }).click();
  await expect(
    page.getByText('The helpers can now read your messages about this agreement.')
  ).toBeVisible();
  await robinPage.reload();
  await robinPage.getByRole('link', { name: 'Read the messages about the agreement' }).click();
  await expect(robinPage.getByText('Is this still available?')).toBeVisible();
  await expect(
    robinPage.getByText('Only the two people in the agreement can write here.')
  ).toBeVisible();
  await robinContext.close();

  // Asking for more help goes to the founders (Robin's inviter is Sam, already in it): the last step.
  await page.goto(reportUrl);
  await page.getByRole('button', { name: 'Ask for more help' }).click();
  await expect(
    page.getByText('The founding members are helping. This is the last step.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask for more help' })).toHaveCount(0);

  // Alex keeps full access and can see the request.
  const alexContext = await browser.newContext();
  const alexPage = await alexContext.newPage();
  await signInAs(alexPage, alex);
  await alexPage.goto(reportUrl);
  await expect(alexPage.getByRole('heading', { name: 'Asking for help: Drill' })).toBeVisible();
  await alexPage.goto('/offerings/new');
  await expect(alexPage.getByRole('heading', { name: 'Offer something', level: 1 })).toBeVisible();
  await alexContext.close();

  // Settling it keeps the note with the agreement.
  await page.getByLabel('How was it settled?').fill('Alex brought it back on Sunday.');
  await page.getByRole('button', { name: 'Mark as settled' }).click();
  await expect(page.getByText('Marked as settled.')).toBeVisible();
  await page.getByRole('link', { name: 'Back to the agreement' }).click();
  await expect(page.getByText('Alex brought it back on Sunday.')).toBeVisible();
});
