// Accessibility check used on every page in the end-to-end tests: runs axe with the WCAG 2.2 AA
// rules in both the light and the dark theme, and fails the test on any violation.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

export async function expectAccessible(page: Page, label = page.url()) {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const summary = results.violations.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
    );
    expect(summary, `Accessibility problems on ${label} in the ${colorScheme} theme`).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: 'light' });
}
