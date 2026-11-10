// Vite and SvelteKit configuration: Node adapter for self-hosting, Tailwind CSS v4, and a strict
// Content Security Policy (constitution III). SvelteKit adds a nonce to its own scripts.
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      adapter: adapter(),
      // The browser tests run their own dev server; a separate folder keeps its settings
      // (e.g., which API to use) from overwriting those of `npm run dev` running alongside.
      outDir: process.env.SVELTEKIT_OUT_DIR ?? '.svelte-kit',
      csp: {
        mode: 'nonce',
        directives: {
          'default-src': ['self'],
          'script-src': ['self'],
          // Inline style attributes are used by positioning in menus; styles cannot run code.
          'style-src': ['self', 'unsafe-inline'],
          'img-src': ['self', 'data:', 'blob:'],
          'font-src': ['self'],
          'connect-src': ['self'],
          'worker-src': ['self'],
          'manifest-src': ['self'],
          'form-action': ['self'],
          'frame-ancestors': ['none'],
          'base-uri': ['self'],
          'object-src': ['none']
        }
      }
    })
  ],
  // The browser tests' dev server keeps its own cache of prepared dependencies too; sharing one
  // makes a running `npm run dev` serve stale files ("Outdated Optimize Dep") after a test run.
  cacheDir: process.env.VITE_CACHE_DIR ?? 'node_modules/.vite',
  server: { port: 5173, strictPort: true }
});
