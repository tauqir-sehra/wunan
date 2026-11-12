<!--
  Arrangements (004 US1): everything I'm arranging with other members, from asking to the end, in
  three groups. The choice of side is a set of links (works without JavaScript); the current one is
  marked with aria-current and a raised background, never a change of size or weight. "Show more"
  adds older finished ones below, so nothing on screen moves. No filled button: the page's action
  is choosing an arrangement.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import ArrangementCard from '#lib/components/ArrangementCard.svelte';
  import HelpLink from '#lib/components/HelpLink.svelte';
  import { groupHeadings } from '#lib/format.ts';
  import type { ArrangementSummary } from '@wunan/shared';

  let { data } = $props();
  const myName = $derived(data.member?.displayName ?? 'You');

  let more = $state<ArrangementSummary[]>([]);
  let next = $state<string | null>(null);
  let loading = $state(false);
  let announcement = $state('');
  let finishedList: HTMLUListElement | undefined = $state();
  $effect(() => {
    void data;
    more = [];
    next = data.finishedNext;
  });
  const groups = $derived({
    needsYou: data.needsYou,
    inProgress: data.inProgress,
    finished: [...data.finished, ...more]
  });
  const empty = $derived(groupHeadings.every((g) => groups[g.key].length === 0));
  const sideQuery = $derived(data.side ? `side=${data.side}&` : '');

  async function showMore(event: MouseEvent) {
    if (!next) return;
    event.preventDefault();
    loading = true;
    const firstNew = groups.finished.length;
    try {
      const response = await fetch(`/arrangements/more?${sideQuery}group=finished&cursor=${next}`);
      if (!response.ok) throw new Error('Could not load more');
      const page = (await response.json()) as {
        finished: ArrangementSummary[];
        finishedNext: string | null;
      };
      more.push(...page.finished);
      next = page.finishedNext;
      announcement = `${page.finished.length} more shown.`;
      await tick();
      // Keyboard and screen-reader users continue at the first new one.
      const items = finishedList?.querySelectorAll<HTMLElement>(':scope > li');
      items?.[firstNew]?.querySelector('a')?.focus({ preventScroll: true });
    } catch {
      window.location.href = `/arrangements?${sideQuery}group=finished&cursor=${next}`;
    } finally {
      loading = false;
    }
  }

  const sides = [
    { side: null, label: 'All' },
    { side: 'asked', label: 'I asked' },
    { side: 'offered', label: 'On my offerings' }
  ] as const;
</script>

<svelte:head><title>Arrangements · wunan</title></svelte:head>

<section class="grid gap-6">
  <div class="grid gap-1">
    <div class="flex items-start justify-between gap-3">
      <h1 class="text-2xl font-semibold sm:text-3xl">Arrangements</h1>
      <HelpLink topic="arrangements" label="Help with arrangements" />
    </div>
    <p class="text-muted-foreground">
      Everything you're arranging with other members, from asking to the end.
    </p>
  </div>

  <nav aria-label="Which arrangements">
    <ul class="segmented">
      {#each sides as choice (choice.label)}
        <li>
          <a
            href={choice.side ? `/arrangements?side=${choice.side}` : '/arrangements'}
            aria-current={data.side === choice.side ? 'page' : undefined}>{choice.label}</a
          >
        </li>
      {/each}
    </ul>
  </nav>

  {#if empty}
    <div class="grid gap-2 surface p-6 text-center">
      <p>
        {data.side === 'asked'
          ? "You haven't asked for anything yet."
          : data.side === 'offered'
            ? 'Nobody has asked about your offerings yet.'
            : "You're not arranging anything yet."}
      </p>
      <p class="text-muted-foreground">
        Find something in <a href="/offerings">Offerings</a>, or
        <a href="/requests/new">request something</a>.
      </p>
    </div>
  {/if}

  {#each groupHeadings as group (group.key)}
    {@const items = groups[group.key]}
    {#if items.length}
      <section class="grid gap-3" aria-labelledby="group-{group.key}">
        <h2 id="group-{group.key}" class="text-xl font-semibold">{group.heading}</h2>
        {#if group.key === 'finished'}
          <ul class="grid gap-4 md:grid-cols-2" bind:this={finishedList}>
            {#each items as arrangement (arrangement.id)}
              <li><ArrangementCard {arrangement} {myName} /></li>
            {/each}
          </ul>
          {#if next}
            <p class="text-center">
              <a
                href="/arrangements?{sideQuery}group=finished&cursor={next}"
                class="inline-flex min-h-11 items-center rounded-full border border-input bg-card px-6 font-medium no-underline hover:bg-accent"
                onclick={showMore}
                aria-disabled={loading}>{loading ? 'Loading…' : 'Show more'}</a
              >
            </p>
          {/if}
        {:else}
          <ul class="grid gap-4 md:grid-cols-2">
            {#each items as arrangement (arrangement.id)}
              <li><ArrangementCard {arrangement} {myName} /></li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  {/each}
  <div class="sr-only" aria-live="polite">{announcement}</div>
</section>
