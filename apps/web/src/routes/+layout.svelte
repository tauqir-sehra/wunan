<!--
  The app shell: skip link, one consistent header navigation, and the main area. The current page
  is marked with aria-current and in bold, never colour alone (constitution IV, V). On phones the
  links fold into a "Menu" disclosure; on wide screens your profile, settings, help and signing out
  sit under your name. Both work without JavaScript. "Request something" and "Offer something" are
  always in view, as outlined buttons so each page's own main action stays the one filled button
  (constitution II).
-->
<script lang="ts">
  import '../app.css';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import MenuIcon from '@lucide/svelte/icons/menu';
  import ArrowDownLeftIcon from '@lucide/svelte/icons/arrow-down-left';
  import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
  import ReauthForm from '#lib/components/ReauthForm.svelte';
  import type { Reauth } from '#lib/form-action.ts';

  let { data, children } = $props();

  type NavLink = { href: string; label: string; count?: number; countText?: string };
  const main = $derived<NavLink[]>([
    {
      href: '/offerings',
      label: 'Offerings',
      count: data.summary?.unseenFlags,
      countText: 'new requests about your offerings'
    },
    {
      href: '/requests',
      label: 'Requests',
      count: data.summary?.unseenRequestFlags,
      countText: 'new requests about your requests'
    },
    {
      href: '/proposals',
      label: 'Proposals',
      count: data.summary?.proposalsWithNews,
      countText: 'with something new'
    },
    {
      href: '/agreements',
      label: 'Agreements',
      count: data.summary?.agreementsNeedingAttention,
      countText: 'need a look'
    }
  ]);
  const account = $derived<NavLink[]>([
    { href: `/members/${data.member?.id ?? ''}`, label: 'Your profile' },
    { href: '/invitations', label: 'Invite someone' },
    { href: '/settings', label: 'Settings' },
    { href: '/help', label: 'Help' }
  ]);

  const headerButton =
    'inline-flex min-h-11 items-center gap-1.5 rounded-md border-2 border-primary bg-card px-3 font-medium whitespace-nowrap text-primary no-underline hover:bg-accent';

  const isCurrent = (href: string) =>
    href === '/offerings' ? page.url.pathname === '/offerings' : page.url.pathname.startsWith(href);
  // The menus close once a link in them has been followed.
  let menuOpen = $state(false);
  let accountOpen = $state(false);
  afterNavigate(() => {
    menuOpen = false;
    accountOpen = false;
  });
  const reauth = $derived((page.form as { reauth?: Reauth } | null)?.reauth);
</script>

<a
  href="#main"
  class="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground no-underline focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
>
  Skip to main content
</a>

<header class="relative border-b bg-card">
  <div class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
    <a
      href="/offerings"
      class="mr-2 inline-flex min-h-11 items-center text-xl font-semibold text-foreground no-underline"
      >wunan</a
    >
    {#if data.member}
      {#snippet navLink(link: NavLink, extra: string)}
        <a
          href={link.href}
          aria-current={isCurrent(link.href) ? 'page' : undefined}
          class="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 whitespace-nowrap text-foreground no-underline hover:bg-accent aria-[current=page]:bg-accent {extra}"
        >
          {link.label}
          {#if link.count}
            <span
              class="rounded-full bg-primary px-1.5 text-xs leading-5 font-semibold text-primary-foreground"
            >
              {link.count}<span class="sr-only"> {link.countText}</span>
            </span>
          {/if}
        </a>
      {/snippet}

      <!-- Wide screens: one row of the main places, then your account in a small menu. -->
      <nav aria-label="Main" class="hidden lg:block">
        <ul class="flex items-center gap-0.5">
          {#each main as link (link.href)}<li>{@render navLink(link, '')}</li>{/each}
        </ul>
      </nav>

      <!-- One piece of text in each, so the button's gap only sits between the icon and the words. -->
      <div class="ml-auto flex flex-wrap gap-2">
        <a href="/requests/new" class={headerButton}>
          <ArrowDownLeftIcon class="size-5" aria-hidden="true" />
          <span
            >Request<span class="hidden sm:inline lg:hidden xl:inline">&nbsp;something</span></span
          >
        </a>
        <a href="/offerings/new" class={headerButton}>
          <ArrowUpRightIcon class="size-5" aria-hidden="true" />
          <span>Offer<span class="hidden sm:inline lg:hidden xl:inline">&nbsp;something</span></span
          >
        </a>
      </div>

      <details class="relative hidden lg:block" bind:open={accountOpen}>
        <summary
          class="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md px-3 whitespace-nowrap hover:bg-accent [&::-webkit-details-marker]:hidden"
        >
          {data.member.displayName}
          <ChevronDownIcon class="size-4" aria-hidden="true" />
        </summary>
        <ul
          class="absolute right-0 z-40 mt-1 grid min-w-48 gap-0.5 rounded-md border bg-card p-1 shadow-sm"
        >
          {#each account as link (link.href)}<li>{@render navLink(link, 'w-full')}</li>{/each}
          <li class="border-t pt-0.5">
            <a
              href="/sign-out"
              class="inline-flex min-h-11 w-full items-center rounded-md px-3 text-muted-foreground hover:bg-accent"
              >Sign out</a
            >
          </li>
        </ul>
      </details>

      <!-- Narrower screens: everything under "Menu" (works without JavaScript). -->
      <details class="lg:hidden" bind:open={menuOpen}>
        <summary
          class="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border px-3 font-medium [&::-webkit-details-marker]:hidden"
        >
          <MenuIcon class="size-5" aria-hidden="true" />
          Menu
          {#if main.some((l) => l.count)}<span
              class="size-2 rounded-full bg-primary"
              aria-hidden="true"
            ></span>{/if}
        </summary>
        <nav
          aria-label="Main"
          class="absolute inset-x-0 z-40 mt-2 border-b bg-card px-4 pb-4 shadow-sm"
        >
          <ul class="grid gap-0.5">
            {#each main as link (link.href)}<li>{@render navLink(link, 'w-full')}</li>{/each}
            <li class="mt-1 border-t pt-1"></li>
            {#each account as link (link.href)}<li>{@render navLink(link, 'w-full')}</li>{/each}
            <li>
              <a
                href="/sign-out"
                class="inline-flex min-h-11 w-full items-center rounded-md px-3 text-muted-foreground hover:bg-accent"
                >Sign out</a
              >
            </li>
          </ul>
        </nav>
      </details>
    {/if}
  </div>
</header>

<main id="main" tabindex="-1" class="mx-auto max-w-5xl px-4 py-8 outline-none">
  {#if reauth}
    <ReauthForm {reauth} />
  {:else}
    {@render children()}
  {/if}
</main>
