<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import RequestCard from '#lib/components/RequestCard.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import { kindLabels } from '#lib/format.ts';
  import type { RequestKind, RequestSummary } from '@wunan/shared';
  import ArrowDownLeftIcon from '@lucide/svelte/icons/arrow-down-left';
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
  const tabClass =
    'inline-flex min-h-11 items-center rounded-md px-3 no-underline hover:bg-accent aria-[current=page]:bg-accent';
  const unseen = $derived(data.summary?.unseenRequestFlags ?? 0);
</script>

<svelte:head><title>Requests · wunan</title></svelte:head>

<section class="grid gap-6">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <h1 class="text-2xl font-semibold">What people are asking for</h1>
    <div class="flex flex-wrap items-center gap-3">
      <Button href="/requests/new" size="action"
        ><ArrowDownLeftIcon class="size-5" aria-hidden="true" />Request something</Button
      >
      <HelpLink topic="requests" label="Help with requests" />
    </div>
  </div>

  <nav aria-label="Which requests">
    <ul class="flex flex-wrap gap-1">
      <li>
        <a href="/requests" class={tabClass} aria-current={data.mine ? undefined : 'page'}
          >All requests</a
        >
      </li>
      <li>
        <a
          href="/requests?mine=true"
          class={tabClass}
          aria-current={data.mine ? 'page' : undefined}
        >
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
    <form
      method="GET"
      action="/requests"
      class="grid gap-4 rounded-xl border bg-card p-4"
      role="search"
    >
      <div class="grid gap-1.5">
        <Label for="q">What could you help with?</Label>
        <Input
          id="q"
          name="q"
          type="search"
          value={f.q}
          placeholder="For example: drill, sofa, haircut"
        />
      </div>
      <fieldset class="grid min-w-0 gap-2">
        <legend class="text-base font-medium">Kind</legend>
        <div class="flex flex-wrap gap-x-5 gap-y-1">
          {#each Object.entries(kindLabels) as [value, label] (value)}
            <label class="flex min-h-11 items-center gap-2">
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
      <div class="grid gap-1.5">
        <Label for="area"
          >Area <span class="font-normal text-muted-foreground">(optional)</span></Label
        >
        <Input id="area" name="area" value={f.area} class="sm:max-w-xs" />
      </div>
      <div><Button type="submit" variant="outline">Search</Button></div>
    </form>
  {/if}

  <section aria-labelledby="results-heading" class="grid gap-3 border-t pt-6">
    <h2 id="results-heading" class="text-lg font-semibold">
      {data.mine ? 'Your requests' : 'Open requests'}
    </h2>
    {#if active.length && !data.mine}
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Active filters">
        <span class="text-muted-foreground">Showing:</span>
        {#each active as filter (filter)}<span class="rounded-md bg-muted px-2 py-0.5"
            >{filter}</span
          >{/each}
        <a href="/requests" class="inline-flex min-h-11 items-center">Clear filters</a>
      </div>
    {/if}
    {#if data.requests.length === 0}
      <p class="rounded-lg border bg-card p-6 text-center">
        {data.mine
          ? "You haven't asked for anything yet."
          : "Nobody's asking for anything that matches."}
      </p>
    {:else}
      <ul class="grid gap-3" bind:this={list}>
        {#each shown as request (request.id)}
          <li><RequestCard {request} showAsker={!data.mine} /></li>
        {/each}
      </ul>
    {/if}
    {#if nextQuery}
      <p>
        <a
          href="/requests?{nextQuery}"
          class="inline-flex min-h-11 items-center"
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
