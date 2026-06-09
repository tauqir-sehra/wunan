<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import OfferingCard from '#lib/components/OfferingCard.svelte';
  import { page } from '$app/state';
  import Notice from '#lib/components/Notice.svelte';
  import { typeLabels } from '#lib/format.ts';
  import type { Offering, OfferingType } from '@wunan/shared';
  import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
  import { tick } from 'svelte';

  let { data } = $props();

  // "Show more" adds the next page under what's shown, so the page stays where it is. Without
  // JavaScript it's a plain link to the next page. A new search starts the list afresh.
  let more = $state<Offering[]>([]);
  let nextQuery = $state<string | null>(null);
  let loading = $state(false);
  let announcement = $state('');
  let list: HTMLUListElement | undefined = $state();
  $effect(() => {
    void data;
    more = [];
    nextQuery = data.mine ? null : data.nextQuery;
  });
  const shown = $derived([...(data.mine ? [] : data.offerings), ...more]);

  async function showMore(event: MouseEvent) {
    if (!nextQuery) return;
    event.preventDefault();
    loading = true;
    const firstNew = shown.length;
    try {
      const response = await fetch(`/offerings/more?${nextQuery}`);
      if (!response.ok) throw new Error('Could not load more');
      const page = (await response.json()) as { offerings: Offering[]; nextQuery: string | null };
      more.push(...page.offerings);
      nextQuery = page.nextQuery;
      announcement = `${page.offerings.length} more shown.`;
      await tick();
      // Keyboard and screen-reader users continue at the first new result.
      const first = list?.querySelectorAll<HTMLElement>(':scope > li')[firstNew];
      first?.querySelector('a')?.focus({ preventScroll: true });
    } catch {
      window.location.href = `/offerings?${nextQuery}`; // Fall back to the next page.
    } finally {
      loading = false;
    }
  }
  const f = $derived(data.mine ? null : data.filters);
  const kinds = $derived(data.mine ? [] : data.kinds);
  const active = $derived(
    !f
      ? []
      : ([
          f.q && `Words: “${f.q}”`,
          kinds.length < 4 && `Kind: ${kinds.map((k) => typeLabels[k]).join(', ')}`,
          f.area && `Area: ${f.area}`,
          f.includeLent && 'Including lent out'
        ].filter(Boolean) as string[])
  );
  const groups = [
    { status: 'available', heading: 'Available' },
    { status: 'paused', heading: 'Paused' },
    { status: 'closed', heading: 'Closed' }
  ] as const;
  // The current tab is shown by its background only, so nothing shifts (constitution V).
  const tabClass =
    'inline-flex min-h-11 items-center rounded-md px-3 no-underline hover:bg-accent aria-[current=page]:bg-accent';
  const unseen = $derived(data.summary?.unseenFlags ?? 0);
</script>

{#snippet askNote()}
  <p class="text-muted-foreground">
    Can't find what you need?
    <a
      href="/requests/new{data.mine || !data.filters.q
        ? ''
        : `?title=${encodeURIComponent(data.filters.q)}`}">Request from the community</a
    >.
  </p>
{/snippet}

<svelte:head><title>Offerings · wunan</title></svelte:head>

<section class="grid gap-6">
  {#if page.url.searchParams.has('welcome')}<Notice
      ><p>Welcome to wunan. You're now a member.</p></Notice
    >{/if}
  <div class="flex flex-wrap items-start justify-between gap-3">
    <h1 class="text-2xl font-semibold">What people are offering</h1>
    <div class="flex flex-wrap items-center gap-3">
      <Button href="/offerings/new" size="action"
        ><ArrowUpRightIcon class="size-5" aria-hidden="true" />Offer something</Button
      >
      <HelpLink topic="finding" label="Help with offerings" />
    </div>
  </div>

  <nav aria-label="Which offerings">
    <ul class="flex flex-wrap gap-1">
      <li>
        <a href="/offerings" class={tabClass} aria-current={data.mine ? undefined : 'page'}
          >All offerings</a
        >
      </li>
      <li>
        <a
          href="/offerings?mine=true"
          class={tabClass}
          aria-current={data.mine ? 'page' : undefined}
        >
          My offerings
          {#if unseen}<span
              class="ml-1.5 rounded-full bg-primary px-1.5 text-xs leading-5 font-semibold text-primary-foreground"
              >{unseen}<span class="sr-only"> new requests from members</span></span
            >{/if}
        </a>
      </li>
    </ul>
  </nav>

  {#if data.mine}
    {#if data.myOfferings.length === 0}
      <p class="rounded-lg border bg-card p-6 text-center">
        You haven't offered anything yet. When you do, it shows up here.
      </p>
    {/if}
    {#each groups as group (group.status)}
      {@const items = data.myOfferings.filter((l) => l.status === group.status)}
      {#if items.length}
        <section class="grid gap-3" aria-labelledby="group-{group.status}">
          <h2 id="group-{group.status}" class="text-lg font-semibold">{group.heading}</h2>
          <ul class="grid gap-3">
            {#each items as offering (offering.id)}
              <li class="grid gap-1">
                <OfferingCard {offering} showOwner={false} />
                {#if offering.unseenFlags}
                  <p class="text-sm">
                    <a href="/offerings/{offering.id}"
                      >{offering.unseenFlags} new {offering.unseenFlags === 1
                        ? 'request'
                        : 'requests'} from members</a
                    >
                  </p>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}
  {:else}
    <form
      method="GET"
      action="/offerings"
      class="grid gap-4 rounded-xl border bg-card p-4"
      role="search"
    >
      <div class="grid gap-1.5">
        <Label for="q">What are you looking for?</Label>
        <Input
          id="q"
          name="q"
          type="search"
          value={data.filters.q}
          placeholder="For example: drill, rice, haircut"
        />
      </div>
      <fieldset class="grid min-w-0 gap-2">
        <legend class="text-base font-medium">Kind</legend>
        <div class="flex flex-wrap gap-x-5 gap-y-1">
          {#each Object.entries(typeLabels) as [value, label] (value)}
            <label class="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                name="type"
                {value}
                checked={data.kinds.includes(value as OfferingType)}
                class="size-5 accent-primary"
              />
              {label}
            </label>
          {/each}
        </div>
      </fieldset>
      <div class="grid gap-1.5">
        <Label for="area"
          >Area <span class="font-normal text-muted-foreground">(optional)</span></Label
        >
        <Input id="area" name="area" value={data.filters.area} class="sm:max-w-xs" />
      </div>
      <label class="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          name="includeLent"
          value="true"
          checked={Boolean(data.filters.includeLent)}
          class="size-6 accent-primary"
        />
        Include items currently lent out
      </label>
      <div><Button type="submit" variant="outline">Search</Button></div>
    </form>

    <section aria-labelledby="results-heading" class="grid gap-3 border-t pt-6">
      <h2 id="results-heading" class="text-lg font-semibold">Results</h2>
      {#if active.length}
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Active filters">
          <span class="text-muted-foreground">Showing:</span>
          {#each active as filter (filter)}<span class="rounded-md bg-muted px-2 py-0.5"
              >{filter}</span
            >{/each}
          <a href="/offerings" class="inline-flex min-h-11 items-center">Clear filters</a>
        </div>
      {/if}
      {#if data.offerings.length === 0}
        <div class="grid gap-2 rounded-lg border bg-card p-6 text-center">
          <p>Nothing matches yet. Try other words or clear the filters.</p>
          {@render askNote()}
        </div>
      {:else}
        <ul class="grid gap-3" bind:this={list}>
          {#each shown as offering (offering.id)}
            <li><OfferingCard {offering} /></li>
          {/each}
        </ul>
      {/if}
      {#if nextQuery}
        <p>
          <a
            href="/offerings?{nextQuery}"
            class="inline-flex min-h-11 items-center"
            onclick={showMore}
            aria-disabled={loading}
          >
            {loading ? 'Loading…' : 'Show more'}
          </a>
        </p>
      {/if}
      <div class="sr-only" aria-live="polite">{announcement}</div>
      {#if data.isLaterPage}<p><a href="/offerings">Back to the newest</a></p>{/if}
      {#if data.offerings.length}{@render askNote()}{/if}
    </section>
  {/if}
</section>
