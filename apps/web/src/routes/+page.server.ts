// There is no separate home page: members land on Find, where they search and browse.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
  redirect(307, `/offerings${url.search}`);
};
