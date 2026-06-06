<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import ListingCard from '#lib/components/ListingCard.svelte';
  import { page } from '$app/state';
  import Notice from '#lib/components/Notice.svelte';
  import { typeLabels } from '#lib/format.ts';
  import type { Listing, ListingType } from '@wunan/shared';
  import { tick } from 'svelte';

  let { data } = $props();

  // "Show more" adds the next page under what's shown, so the page stays where it is. Without
  // JavaScript it's a plain link to the next page. A new search starts the list afresh.
  let more = $state<Listing[]>([]);
  let nextQuery = $state<string | null>(null);
  let loading = $state(false);
  let announcement = $state('');
  let list: HTMLUListElement | undefined = $state();
  $effect(() => {
    void data.listings;
    more = [];
    nextQuery = data.nextQuery;
  });
  const shown = $derived([...data.listings, ...more]);

  async function showMore(event: MouseEvent) {
    if (!nextQuery) return;
    event.preventDefault();
    loading = true;
    const firstNew = shown.length;
    try {
      const response = await fetch(`/listings/more?${nextQuery}`);
      if (!response.ok) throw new Error('Could not load more');
      const page = (await response.json()) as { listings: Listing[]; nextQuery: string | null };
      more.push(...page.listings);
      nextQuery = page.nextQuery;
      announcement = `${page.listings.length} more shown.`;
      await tick();
      // Keyboard and screen-reader users continue at the first new result.
      list?.querySelectorAll<HTMLElement>(':scope > li')[firstNew]?.querySelector('a')?.focus({ preventScroll: true });
    } catch {
      window.location.href = `/listings?${nextQuery}`; // Fall back to the next page.
    } finally {
      loading = false;
    }
  }
  const f = $derived(data.filters);
  const active = $derived(
    [
      f.q && `Words: “${f.q}”`,
      data.kinds.length < 4 && `Kind: ${data.kinds.map((k) => typeLabels[k]).join(', ')}`,
      f.area && `Area: ${f.area}`,
      f.includeLent && 'Including lent out'
    ].filter(Boolean) as string[]
  );
</script>

<svelte:head><title>Find · wunan</title></svelte:head>

<section class="grid gap-6">
  {#if page.url.searchParams.has('welcome')}<Notice><p>Welcome to wunan. You're now a member.</p></Notice>{/if}
  <div class="flex items-start justify-between gap-3">
    <h1 class="text-2xl font-semibold">Find something</h1>
    <HelpLink topic="finding" label="Help with finding things" />
  </div>

  <form
    method="GET"
    action="/listings"
    class="grid gap-4 rounded-xl border bg-card p-4"
    role="search"
  >
    <div class="grid gap-1.5">
      <Label for="q">What are you looking for?</Label>
      <Input
        id="q"
        name="q"
        type="search"
        value={f.q}
        placeholder="For example: drill, rice, haircut"
      />
    </div>
    <fieldset class="grid min-w-0 gap-2">
      <legend class="text-base font-medium">Kind</legend>
      <div class="flex flex-wrap gap-x-5 gap-y-1">
        {#each Object.entries(typeLabels) as [value, label] (value)}
          <label class="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="type" {value} checked={data.kinds.includes(value as ListingType)} class="size-5 accent-primary" />
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
    <label class="flex min-h-11 items-center gap-3">
      <input
        type="checkbox"
        name="includeLent"
        value="true"
        checked={Boolean(f.includeLent)}
        class="size-6 accent-primary"
      />
      Include items currently lent out
    </label>
    <div><Button type="submit">Search</Button></div>
  </form>

  <!-- A line and a heading set the results apart from the search form. -->
  <section aria-labelledby="results-heading" class="grid gap-3 pt-6">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      {#if active.length}
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Active filters">
          <span class="text-muted-foreground">Showing:</span>
          {#each active as filter (filter)}<span class="rounded-md bg-muted px-2 py-0.5">{filter}</span>{/each}
          <a href="/listings" class="inline-flex min-h-11 items-center">Clear filters</a>
        </div>
      {/if}
    </div>
    {#if data.listings.length === 0}
      <p class="rounded-lg border bg-card p-6 text-center">
        Nothing matches yet. Try other words or clear the filters.
      </p>
    {:else}
      <ul class="grid gap-3" bind:this={list}>
        {#each shown as listing (listing.id)}
          <li><ListingCard {listing} /></li>
        {/each}
      </ul>
    {/if}
    {#if nextQuery}
      <p>
        <a href="/listings?{nextQuery}" class="inline-flex min-h-11 items-center" onclick={showMore} aria-disabled={loading}>
          {loading ? 'Loading…' : 'Show more'}
        </a>
      </p>
    {/if}
    <div class="sr-only" aria-live="polite">{announcement}</div>
    {#if data.isLaterPage}
      <p><a href="/listings">Back to the newest</a></p>
    {/if}
  </section>
</section>
