// Environment variables the web app reads at runtime (SvelteKit 3: declared here, imported from
// `$app/env/private`). The web app needs only to know where the API is and its own public address.
import { building } from '$app/env';
import { defineEnvVars } from '@sveltejs/kit/env';

// Required when the app runs; not needed while building the Docker image.
const url = (name: string) => (value: string | undefined) => {
  if (!value && building) return undefined;
  if (!value) throw new Error(`${name} is not set`);
  return new URL(value).toString().replace(/\/+$/, '');
};

export const variables = defineEnvVars({
  API_INTERNAL_URL: {
    description: 'Where the web server reaches the API, e.g. http://api:3000 (never the browser).',
    schema: url('API_INTERNAL_URL')
  },
  SITE_URL: {
    description: 'Public address of the site, e.g. https://share.example.org.',
    schema: url('SITE_URL')
  }
});
