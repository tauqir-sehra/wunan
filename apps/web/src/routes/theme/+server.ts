// Saves the light/dark choice from the menu. With JavaScript the page has already changed and
// only needs the cookie; without it, the form posts here and comes back to the same page.
import { redirect, type RequestHandler } from '@sveltejs/kit';
import { saveTheme, THEMES, type Theme } from '#lib/theme.ts';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  const form = await request.formData();
  const theme = String(form.get('theme') ?? '');
  if (THEMES.includes(theme as Theme)) saveTheme(cookies, url, theme as Theme);
  if (request.headers.get('accept')?.includes('application/json'))
    return new Response(null, { status: 204 });
  const back = String(form.get('back') ?? '/');
  redirect(303, back.startsWith('/') && !back.startsWith('//') ? back : '/');
};
