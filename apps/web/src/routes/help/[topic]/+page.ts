// One help topic; unknown topics show the normal not-found page.
import { error } from '@sveltejs/kit';
import { helpTopics } from '#lib/help/index.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
  const index = helpTopics.findIndex((topic) => topic.slug === params.topic);
  if (index === -1) error(404, 'That help page could not be found.');
  return { index };
};
