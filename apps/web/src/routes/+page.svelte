<!--
  Home (007): what needs me right now, under "Waiting on you", in up to four groups shown only when
  they have lines: arrangements waiting on me, loans due back, new offers on my requests, and
  requests to change my things. Each line is one link. Nothing else: no search, no suggestions, no
  filled button, and no live updates, so nothing moves by itself (constitution I, V). A group shows
  its first 5 lines; "See all" adds the rest below them without moving anything above (`?all=`,
  which also works without JavaScript), and focus goes to the first new line.
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import HelpLink from '#lib/components/HelpLink.svelte';
  import HomeLine from '#lib/components/HomeLine.svelte';
  import {
    askedToChangeLine,
    dueBackLine,
    homeArrangementLine,
    offersLine,
    type HomeLineWords
  } from '#lib/format.ts';

  let { data } = $props();
  const FIRST = 5;
  const myName = $derived(data.member?.displayName ?? 'You');

  type Line = { key: string; href: string; words: HomeLineWords };
  const groups = $derived.by(() => {
    const h = data.home;
    const list: { id: string; heading: string; lines: Line[] }[] = [
      {
        id: 'arrangements',
        heading: 'Arrangements',
        lines: h.arrangements.map((a) => ({
          key: a.id,
          href: `/arrangements/${a.id}`,
          words: homeArrangementLine(a, myName)
        }))
      },
      {
        id: 'due-back',
        heading: 'Due back',
        lines: h.dueBack.map((d) => ({
          key: d.arrangementId,
          href: `/arrangements/${d.arrangementId}`,
          words: dueBackLine(d)
        }))
      },
      {
        id: 'offers',
        heading: 'Offers on your requests',
        lines: h.offers.map((o) => ({
          key: o.request.id,
          href: `/home/go?kind=offers&id=${o.request.id}`,
          words: offersLine(o)
        }))
      },
      {
        id: 'asked-to-change',
        heading: 'Asked to change',
        lines: h.askedToChange.map((a) => ({
          key: `${a.subject}-${a.id}`,
          href: `/home/go?kind=askedToChange&subject=${a.subject}&id=${a.id}`,
          words: askedToChangeLine(a)
        }))
      }
    ];
    return list.filter((g) => g.lines.length > 0);
  });

  /** Home's address with `group` added to the groups shown in full (Home has no other query). */
  const seeAll = (group: string) => `?all=${[...data.all, group].join(',')}#${group}`;

  // When "See all" opened a group, focus moves to its first new line (not on first load).
  let shownInFull: string[] = untrack(() => data.all);
  $effect(() => {
    const now = data.all;
    const opened = now.find((g) => !shownInFull.includes(g));
    shownInFull = now;
    if (opened)
      void tick().then(() =>
        document.getElementById(`${opened}-${FIRST}`)?.focus({ preventScroll: true })
      );
  });
</script>

<svelte:head><title>Home · wunan</title></svelte:head>

<section class="grid gap-8">
  <div class="flex items-start justify-between gap-3">
    <h1 class="text-2xl font-semibold sm:text-3xl">Waiting on you</h1>
    <HelpLink topic="home" label="Help with Home" />
  </div>

  {#if groups.length === 0}
    <p>Nothing right now.</p>
  {/if}

  {#each groups as group (group.id)}
    {@const full = data.all.includes(group.id)}
    <section id={group.id} class="grid gap-2" aria-labelledby="{group.id}-heading">
      <h2 id="{group.id}-heading" class="text-base font-semibold text-muted-foreground">
        {group.heading}
      </h2>
      <ul class="divide-y overflow-hidden surface p-0">
        {#each full ? group.lines : group.lines.slice(0, FIRST) as line, i (line.key)}
          <HomeLine href={line.href} words={line.words} id="{group.id}-{i}" />
        {/each}
      </ul>
      {#if !full && group.lines.length > FIRST}
        <p>
          <a href={seeAll(group.id)} data-sveltekit-reset="false">See all {group.lines.length}</a>
        </p>
      {/if}
    </section>
  {/each}
</section>
