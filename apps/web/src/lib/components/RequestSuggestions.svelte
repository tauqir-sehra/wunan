<!--
  "These might already have what you need" (003 FR-009 to FR-011): while a request's title is typed,
  up to 5 available offerings that might answer it, after a short pause once there are 3 letters.
  Shown only when there is something to show; the count is announced politely. Opening one keeps
  the unfinished request (the form saves a draft).
-->
<script lang="ts">
  import { placeText, typeLabels } from '#lib/format.ts';
  import type { Offering, RequestKind } from '@wunan/shared';

  let { kind, title, area }: { kind: RequestKind | undefined; title: string; area?: string } =
    $props();

  let items = $state<Offering[]>([]);
  let announcement = $state('');
  let latest = 0;

  $effect(() => {
    const q = title.trim();
    const chosen = kind;
    const where = area;
    if (!chosen || q.length < 3) {
      items = [];
      return;
    }
    const call = ++latest;
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ kind: chosen, q, ...(where ? { area: where } : {}) });
        const response = await fetch(`/requests/suggestions?${query}`);
        const result = (await response.json()) as { items: Offering[] };
        if (call !== latest) return;
        const before = items.length;
        items = result.items;
        if (items.length && items.length !== before) {
          announcement = `${items.length} ${items.length === 1 ? 'offering' : 'offerings'} might already have what you need.`;
        }
      } catch {
        if (call === latest) items = [];
      }
    }, 400);
    return () => clearTimeout(timer);
  });
</script>

{#if items.length}
  <section
    class="grid gap-2 rounded-lg border border-dashed bg-card p-4"
    aria-labelledby="suggestions-heading"
  >
    <h2 id="suggestions-heading" class="font-semibold">These might already have what you need</h2>
    <ul class="grid gap-1">
      {#each items as offering (offering.id)}
        <li>
          <a href="/offerings/{offering.id}" class="inline-flex min-h-11 items-center"
            >{offering.title}</a
          >
          <span class="text-muted-foreground">
            · {typeLabels[offering.type]} {#if placeText(offering.area)}
              · {placeText(offering.area)}{/if} · {offering.owner.displayName}</span
          >
        </li>
      {/each}
    </ul>
    <p class="text-sm text-muted-foreground">
      If none of these fit, carry on and post your request.
    </p>
  </section>
{/if}
<div class="sr-only" aria-live="polite">{announcement}</div>
