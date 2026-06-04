<!--
  The app shell: skip link, one consistent header navigation, and the main area. The current page
  is marked with aria-current and an underline, never colour alone (constitution IV, V).
-->
<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import ReauthForm from '#lib/components/ReauthForm.svelte';
  import type { Reauth } from '#lib/form-action.ts';

  let { data, children } = $props();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/listings', label: 'Find' },
    { href: '/messages', label: 'Messages' },
    { href: '/my-listings', label: 'My listings' },
    { href: '/settings', label: 'Settings' }
  ];

  const isCurrent = (href: string) =>
    href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
  const reauth = $derived((page.form as { reauth?: Reauth } | null)?.reauth);
</script>

<a
  href="#main"
  class="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground no-underline focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
>
  Skip to main content
</a>

<header class="border-b bg-card">
  <div class="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
    <a href="/" class="text-xl font-semibold text-foreground no-underline">wunan</a>
    {#if data.member}
      <nav aria-label="Main" class="flex-1">
        <ul class="flex flex-wrap gap-x-1 gap-y-1">
          {#each links as link (link.href)}
            <li>
              <a
                href={link.href}
                aria-current={isCurrent(link.href) ? 'page' : undefined}
                class="inline-flex min-h-11 items-center rounded-md px-3 text-foreground no-underline hover:bg-accent aria-[current=page]:font-semibold aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
              >
                {link.label}
              </a>
            </li>
          {/each}
        </ul>
      </nav>
      <a href="/sign-out" class="inline-flex min-h-11 items-center px-2 text-muted-foreground">Sign out</a>
    {/if}
  </div>
</header>

<main id="main" tabindex="-1" class="mx-auto max-w-4xl px-4 py-8 outline-none">
  {#if reauth}
    <ReauthForm {reauth} />
  {:else}
    {@render children()}
  {/if}
</main>
