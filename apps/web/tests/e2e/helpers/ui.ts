// Browser steps shared by the end-to-end tests.
import type { Page } from '@playwright/test';
import type { TestMember } from './members.ts';

export async function signInAs(page: Page, member: TestMember) {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(member.email);
  await page.getByLabel('Password').fill(member.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname !== '/sign-in');
}
