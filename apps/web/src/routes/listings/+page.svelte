<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import ListingCard from '#lib/components/ListingCard.svelte';
  import { typeLabels } from '#lib/format.ts';

  let { data } = $props();
  const f = $derived(data.filters);
  const active = $derived(
    [
      f.q && `Words: “${f.q}”`,
      f.type && `Kind: ${typeLabels[f.type as keyof typeof typeLabels] ?? f.type}`,
      f.area && `Area: ${f.area}`,
      f.includeLent && 'Including lent out'
    ].filter(Boolean) as string[]
  );
</script>

<svelte:head><title>Find · wunan</title></svelte:head>

<section class="grid gap-6">
  <h1 class="text-2xl font-semibold">Find something</h1>
  <HelpLink topic="finding" label="Help with finding things" />

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
        {#each [['', 'Any'], ...Object.entries(typeLabels)] as [value, label] (value)}
          <label class="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="type"
              {value}
              checked={f.type === value}
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

  {#if active.length}
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Active filters">
      <span class="text-muted-foreground">Showing:</span>
      {#each active as filter (filter)}<span class="rounded-md bg-muted px-2 py-0.5">{filter}</span
        >{/each}
      <a href="/listings" class="inline-flex min-h-11 items-center">Clear filters</a>
    </div>
  {/if}

  <section aria-labelledby="results-heading" class="grid gap-3">
    <h2 id="results-heading" class="sr-only">Results</h2>
    {#if data.listings.length === 0}
      <p class="rounded-lg border bg-card p-6 text-center">
        Nothing matches yet. Try other words or clear the filters.
      </p>
    {:else}
      <ul class="grid gap-3">
        {#each data.listings as listing (listing.id)}
          <li><ListingCard {listing} /></li>
        {/each}
      </ul>
    {/if}
    {#if data.nextPage}
      <p><a href={data.nextPage} class="inline-flex min-h-11 items-center">Show more</a></p>
    {/if}
    {#if data.isLaterPage}
      <p><a href="/listings">Back to the newest</a></p>
    {/if}
  </section>
</section>
