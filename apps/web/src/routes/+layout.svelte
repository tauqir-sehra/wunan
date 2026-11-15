<!--
  The app shell: skip link, one consistent header navigation, and the main area. The current page
  is marked with aria-current and a filled pill behind it, never colour alone and never a change
  of weight or size (constitution IV, V). On wide screens the header stays in view. On phones the
  links fold into a "Menu" disclosure; on wide screens your profile, settings, help and signing out
  sit under your name. Both work without JavaScript. "Home" (007) comes first, and the wunan name
  leads there too. "Request something" and "Offer something" are one "New" button away on every
  screen, an outlined button so each page's own main action stays the one filled button
  (constitution II).
-->
<script lang="ts">
  import '../app.css';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { untrack } from 'svelte';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import MenuIcon from '@lucide/svelte/icons/menu';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import ArrowDownLeftIcon from '@lucide/svelte/icons/arrow-down-left';
  import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
  import { buttonVariants } from '#lib/components/ui/button/index.ts';
  import ReauthForm from '#lib/components/ReauthForm.svelte';
  import ThemePicker from '#lib/components/ThemePicker.svelte';
  import type { Reauth } from '#lib/form-action.ts';

  let { data, children } = $props();

  type NavLink = { href: string; label: string; count?: number; countText?: string };
  const main = $derived<NavLink[]>([
    { href: '/', label: 'Home' },
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
      href: '/arrangements',
      label: 'Arrangements',
      count: data.summary?.arrangementsNeedingYou,
      countText: 'waiting on you'
    }
  ]);
  const account = $derived<NavLink[]>([
    { href: `/members/${data.member?.id ?? ''}`, label: 'Your profile' },
    { href: '/invitations', label: 'Invite someone' },
    { href: '/settings', label: 'Settings' },
    { href: '/help', label: 'Help' }
  ]);

  const isCurrent = (href: string) =>
    href === '/' || href === '/offerings'
      ? page.url.pathname === href
      : page.url.pathname.startsWith(href);
  // The menus close once a link in them has been followed. Not on first load: a menu opened
  // before the page finished loading stays open.
  let menu: HTMLDetailsElement | undefined = $state();
  let accountMenu: HTMLDetailsElement | undefined = $state();
  let newMenu: HTMLDetailsElement | undefined = $state();
  // The header's menus open below the same row, so opening one closes the others.
  const closeOthers = (opened?: HTMLDetailsElement) => {
    if (!opened?.open) return;
    for (const other of [menu, accountMenu, newMenu])
      if (other && other !== opened) other.open = false;
  };
  afterNavigate((navigation) => {
    if (navigation.type === 'enter') return;
    if (menu) menu.open = false;
    if (newMenu) newMenu.open = false;
    if (accountMenu) accountMenu.open = false;
  });
  // Shared by both menus, so the one in view always shows the current choice.
  let theme = $state(untrack(() => data.theme));
  const reauth = $derived((page.form as { reauth?: Reauth } | null)?.reauth);
</script>

<a
  href="#main"
  class="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground no-underline focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
>
  Skip to main content
</a>

<!-- On wide screens the header stays at the top while the page scrolls; nothing in it moves. -->
<header class="relative border-b bg-card lg:sticky lg:top-0 lg:z-30">
  <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 sm:gap-x-3">
    <a
      href="/"
      class="inline-flex min-h-11 items-center gap-2 text-lg font-semibold tracking-tight text-foreground no-underline sm:mr-3"
    >
      <svg viewBox="0 0 32 32" class="size-7" aria-hidden="true">
        <rect width="32" height="32" rx="10" class="fill-primary" />
        <path
          d="M8 11l3 11 5-8 5 8 3-11"
          fill="none"
          class="stroke-primary-foreground"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <!-- On the narrowest phones only the mark shows, so the header stays one row; the name is
           still read out. -->
      <span class="max-[359px]:sr-only">wunan</span>
    </a>
    {#if data.member}
      {#snippet navLink(link: NavLink, extra: string)}
        <a
          href={link.href}
          aria-current={isCurrent(link.href) ? 'page' : undefined}
          class="inline-flex min-h-11 items-center gap-1.5 px-3.5 whitespace-nowrap text-foreground no-underline hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground {extra}"
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
          {#each main as link (link.href)}<li>{@render navLink(link, 'rounded-full')}</li>{/each}
        </ul>
      </nav>

      <!-- One "New" button on every screen, opening Request or Offer (works without JavaScript). -->
      <details class="relative ml-auto" bind:this={newMenu} ontoggle={() => closeOthers(newMenu)}>
        <summary
          class="{buttonVariants({
            variant: 'primaryOutline',
            size: 'action'
          })} list-none px-3 sm:px-4 [&::-webkit-details-marker]:hidden"
        >
          <PlusIcon class="size-5" aria-hidden="true" />
          New
        </summary>
        <ul class="absolute right-0 z-40 mt-2 grid min-w-60 gap-0.5 surface p-1.5">
          <li>
            <a
              href="/requests/new"
              class="inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-3.5 text-foreground no-underline hover:bg-accent"
              ><ArrowDownLeftIcon class="size-5" aria-hidden="true" />Request something</a
            >
          </li>
          <li>
            <a
              href="/offerings/new"
              class="inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-3.5 text-foreground no-underline hover:bg-accent"
              ><ArrowUpRightIcon class="size-5" aria-hidden="true" />Offer something</a
            >
          </li>
        </ul>
      </details>

      <!-- Narrower screens: everything under "Menu" (works without JavaScript). -->
      <details class="lg:hidden" bind:this={menu} ontoggle={() => closeOthers(menu)}>
        <summary
          class="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-input px-3 font-medium sm:px-4 [&::-webkit-details-marker]:hidden"
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
          class="absolute inset-x-0 z-40 mt-2 border-b bg-card px-4 pb-4 shadow-soft"
        >
          <ul class="grid gap-0.5">
            {#each main as link (link.href)}<li>
                {@render navLink(link, 'w-full rounded-lg')}
              </li>{/each}
            <li class="mt-1 border-t pt-1"></li>
            {#each account as link (link.href)}<li>
                {@render navLink(link, 'w-full rounded-lg')}
              </li>{/each}
            <li>
              <a
                href="/sign-out"
                class="inline-flex min-h-11 w-full items-center rounded-lg px-3.5 text-muted-foreground no-underline hover:bg-accent"
                >Sign out</a
              >
            </li>
            <li class="mt-1 border-t pt-1"><ThemePicker bind:theme /></li>
          </ul>
        </nav>
      </details>

      <details
        class="relative hidden lg:block"
        bind:this={accountMenu}
        ontoggle={() => closeOthers(accountMenu)}
      >
        <summary
          class="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full py-1 pr-3 pl-1.5 whitespace-nowrap hover:bg-accent [&::-webkit-details-marker]:hidden"
        >
          <!-- The initial is drawn by CSS, so the menu's own text is just the name. -->
          <span
            class="inline-flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground before:content-[attr(data-initial)]"
            data-initial={data.member.displayName.slice(0, 1).toUpperCase()}
            aria-hidden="true"
          ></span>
          {data.member.displayName}
          <ChevronDownIcon class="size-4" aria-hidden="true" />
        </summary>
        <ul class="absolute right-0 z-40 mt-2 grid min-w-60 gap-0.5 surface p-1.5">
          {#each account as link (link.href)}<li>
              {@render navLink(link, 'w-full rounded-lg')}
            </li>{/each}
          <li class="border-t pt-0.5">
            <a
              href="/sign-out"
              class="inline-flex min-h-11 w-full items-center rounded-lg px-3.5 text-muted-foreground no-underline hover:bg-accent"
              >Sign out</a
            >
          </li>
          <li class="border-t pt-1"><ThemePicker bind:theme /></li>
        </ul>
      </details>
    {/if}
  </div>
</header>

<main id="main" tabindex="-1" class="mx-auto max-w-6xl px-4 py-8 outline-none lg:py-10">
  {#if reauth}
    <ReauthForm {reauth} />
  {:else}
    {@render children()}
  {/if}
</main>
