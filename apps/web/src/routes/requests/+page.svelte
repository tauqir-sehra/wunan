<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import PlaceField from '#lib/components/PlaceField.svelte';
  import RequestCard from '#lib/components/RequestCard.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import { kindLabels } from '#lib/format.ts';
  import type { RequestKind, RequestSummary } from '@wunan/shared';
  import ArrowDownLeftIcon from '@lucide/svelte/icons/arrow-down-left';
  import SearchIcon from '@lucide/svelte/icons/search';
  import { tick } from 'svelte';

  let { data } = $props();

  // "Show more" adds the next page under what's shown; without JavaScript it's a link to the next page.
  let more = $state<RequestSummary[]>([]);
  let nextQuery = $state<string | null>(null);
  let loading = $state(false);
  let announcement = $state('');
  let list: HTMLUListElement | undefined = $state();
  $effect(() => {
    void data.requests;
    more = [];
    nextQuery = data.nextQuery;
  });
  const shown = $derived([...data.requests, ...more]);

  async function showMore(event: MouseEvent) {
    if (!nextQuery) return;
    event.preventDefault();
    loading = true;
    const firstNew = shown.length;
    try {
      const response = await fetch(`/requests/more?${nextQuery}`);
      if (!response.ok) throw new Error('Could not load more');
      const page = (await response.json()) as {
        requests: RequestSummary[];
        nextQuery: string | null;
      };
      more.push(...page.requests);
      nextQuery = page.nextQuery;
      announcement = `${page.requests.length} more shown.`;
      await tick();
      const items = list?.querySelectorAll<HTMLElement>(':scope > li');
      items?.[firstNew]?.querySelector('a')?.focus({ preventScroll: true });
    } catch {
      window.location.href = `/requests?${nextQuery}`;
    } finally {
      loading = false;
    }
  }
  const f = $derived(data.filters);
  const active = $derived(
    [
      f.q && `Words: “${f.q}”`,
      data.kinds.length < 4 && `Kind: ${data.kinds.map((k) => kindLabels[k]).join(', ')}`,
      f.area && `Area: ${f.area}`
    ].filter(Boolean) as string[]
  );
  const unseen = $derived(data.summary?.unseenRequestFlags ?? 0);
</script>

<svelte:head><title>Requests · wunan</title></svelte:head>

<section class="grid gap-6">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <h1 class="text-2xl font-semibold sm:text-3xl">What people are asking for</h1>
    <div class="flex flex-wrap items-center gap-3">
      <Button href="/requests/new" size="action"
        ><ArrowDownLeftIcon class="size-5" aria-hidden="true" />Request something</Button
      >
      <HelpLink topic="requests" label="Help with requests" />
    </div>
  </div>

  <nav aria-label="Which requests">
    <ul class="segmented">
      <li>
        <a href="/requests" aria-current={data.mine ? undefined : 'page'}>All requests</a>
      </li>
      <li>
        <a href="/requests?mine=true" aria-current={data.mine ? 'page' : undefined}>
          My requests
          {#if unseen}<span
              class="ml-1.5 rounded-full bg-primary px-1.5 text-xs leading-5 font-semibold text-primary-foreground"
              >{unseen}<span class="sr-only"> new requests from members</span></span
            >{/if}
        </a>
      </li>
    </ul>
  </nav>

  {#if !data.mine}
    <form method="GET" action="/requests" class="grid gap-5 surface p-5" role="search">
      <div class="grid gap-1.5">
        <Label for="q">What could you help with?</Label>
        <div class="relative">
          <SearchIcon
            class="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="q"
            name="q"
            type="search"
            value={f.q}
            placeholder="For example: drill, sofa, haircut"
            class="min-h-12 rounded-full pr-4 pl-12"
          />
        </div>
      </div>
      <div class="grid gap-x-8 gap-y-5 md:grid-cols-[1fr_18rem]">
        <fieldset class="grid min-w-0 gap-2">
          <legend class="text-base font-medium">Kind</legend>
          <div class="flex flex-wrap gap-2">
            {#each Object.entries(kindLabels) as [value, label] (value)}
              <label class="choice-chip">
                <input
                  type="checkbox"
                  name="kind"
                  {value}
                  checked={data.kinds.includes(value as RequestKind)}
                  class="size-5 accent-primary"
                />
                {label}
              </label>
            {/each}
          </div>
        </fieldset>
        <PlaceField label="Area" name="area" value={f.area} optional filter />
      </div>
      <div class="flex justify-end">
        <Button type="submit" variant="outline" class="px-7">Search</Button>
      </div>
    </form>
  {/if}

  <section aria-labelledby="results-heading" class="grid gap-4">
    <h2 id="results-heading" class="text-xl font-semibold">
      {data.mine ? 'Your requests' : 'Open requests'}
    </h2>
    {#if active.length && !data.mine}
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Active filters">
        <span class="text-muted-foreground">Showing:</span>
        {#each active as filter (filter)}<span class="rounded-full bg-muted px-3 py-0.5"
            >{filter}</span
          >{/each}
        <a href="/requests" class="inline-flex min-h-11 items-center">Clear filters</a>
      </div>
    {/if}
    {#if data.requests.length === 0}
      <p class="surface p-6 text-center">
        {data.mine
          ? "You haven't asked for anything yet."
          : "Nobody's asking for anything that matches."}
      </p>
    {:else}
      <ul class="grid gap-4 md:grid-cols-2" bind:this={list}>
        {#each shown as request (request.id)}
          <li><RequestCard {request} showAsker={!data.mine} /></li>
        {/each}
      </ul>
    {/if}
    {#if nextQuery}
      <p class="text-center">
        <a
          href="/requests?{nextQuery}"
          class="inline-flex min-h-11 items-center rounded-full border border-input bg-card px-6 font-medium no-underline hover:bg-accent"
          onclick={showMore}
          aria-disabled={loading}
        >
          {loading ? 'Loading…' : 'Show more'}
        </a>
      </p>
    {/if}
    <div class="sr-only" aria-live="polite">{announcement}</div>
    {#if data.isLaterPage}<p>
        <a href={data.mine ? '/requests?mine=true' : '/requests'}>Back to the newest</a>
      </p>{/if}
  </section>
</section>
