// Light or dark: "system" follows the device; a member can pick light or dark in the menu.
// The choice is a cookie on this device only, so the page arrives in the right colours.
import { dev } from '$app/env';
import type { Cookies } from '@sveltejs/kit';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
const COOKIE = 'theme';

export function themeFrom(cookies: Cookies): Theme {
  const value = cookies.get(COOKIE);
  return THEMES.includes(value as Theme) ? (value as Theme) : 'system';
}

export function saveTheme(cookies: Cookies, url: URL, theme: Theme) {
  cookies.set(COOKIE, theme, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: !dev || url.protocol === 'https:',
    maxAge: 60 * 60 * 24 * 365
  });
}
