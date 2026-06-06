// 003 US7: raising issues about requests and public messages; the new notification switches (quickstart 7).
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers/axe.ts';
import { createFounder, createInvitedMember, createRequestFor } from './helpers/members.ts';
import { signInAs } from './helpers/ui.ts';

test('issues about a request reach the asker, and issues about a message reach its writer', async ({
  page,
  browser
}) => {
  const rana = createFounder('Rana');
  const sam = await createInvitedMember(rana, 'Sam');
  const request = await createRequestFor(rana, { kind: 'borrow', title: 'Drill' });

  // Rana writes a public message with her number in it.
  await signInAs(page, rana);
  await page.goto(`/requests/${request.id}`);
  await page.getByLabel('Add a public message').fill('Text me on 555 0100');
  await page.getByRole('button', { name: 'Post' }).click();

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await signInAs(samPage, sam);
  await samPage.goto(`/requests/${request.id}`);
  await samPage.waitForLoadState('networkidle');
  // About the request: the pop-up.
  await samPage.getByRole('button', { name: 'Raise an issue' }).first().click();
  const requestDialog = samPage.getByRole('dialog', { name: 'Raise an issue with Rana' });
  await requestDialog.getByLabel('What would you like to ask?').fill('Could you add your area?');
  await expectAccessible(samPage, 'raise an issue about a request');
  await requestDialog.getByRole('button', { name: 'Send to Rana' }).click();
  await expect(samPage.getByText('Your request was sent to the person who asked.')).toBeVisible();
  // About the message: the pop-up on the message.
  await samPage
    .getByRole('region', { name: 'Public messages' })
    .getByRole('button', { name: 'Raise an issue' })
    .click();
  const messageDialog = samPage.getByRole('dialog', { name: 'Raise an issue with Rana' });
  await messageDialog.getByLabel('What would you like to ask?').fill('Maybe remove your number?');
  await messageDialog.getByRole('button', { name: 'Send to Rana' }).click();
  await expect(
    samPage.getByText('Your request was sent to the person who wrote it.')
  ).toBeVisible();
  await samContext.close();

  // Rana sees the count, then both requests; nothing was hidden.
  await page.goto('/requests?mine=true');
  await expect(page.getByRole('link', { name: /My requests/ })).toContainText('1');
  await page.goto(`/requests/${request.id}`);
  await expect(page.getByRole('region', { name: 'Requests from members' })).toContainText(
    'Could you add your area?'
  );
  await expect(page.getByRole('region', { name: 'Public messages' })).toContainText(
    'Sam asked: Maybe remove your number?'
  );
  await expect(page.getByText('Text me on 555 0100', { exact: true })).toBeVisible();
});

test('raising an issue about a request works without JavaScript', async ({ browser }) => {
  const rana = createFounder('Rana');
  const sam = await createInvitedMember(rana, 'Sam');
  const request = await createRequestFor(rana, { kind: 'receive', title: 'Rice' });
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await signInAs(page, sam);
  await page.goto(`/requests/${request.id}`);
  await page.getByRole('link', { name: 'Raise an issue' }).first().click();
  await page.getByLabel('What would you like to ask?').fill('How much rice?');
  await page.getByRole('button', { name: 'Send to Rana' }).click();
  await expect(page).toHaveURL(/issueSent=1/);
  await context.close();
});

test('settings show the two new notification switches, off until turned on', async ({ page }) => {
  const kim = createFounder('Kim');
  await signInAs(page, kim);
  await page.goto('/settings/notifications');
  for (const name of [
    'Someone offers something for your request',
    'Public messages on your requests and offerings'
  ]) {
    const group = page.getByRole('group', { name: new RegExp(name) });
    await expect(group).toBeVisible();
    for (const box of await group.getByRole('checkbox').all()) await expect(box).not.toBeChecked();
  }
});
