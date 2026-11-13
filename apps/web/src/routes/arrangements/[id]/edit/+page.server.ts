// The old "Change details" page (002, 004). Details are now added and changed in their rows on the
// arrangement page (006), so old links and emails land there, at the details.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
  redirect(308, `/arrangements/${encodeURIComponent(params.id)}#details`);
};
