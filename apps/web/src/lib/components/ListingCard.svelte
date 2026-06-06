<!-- A listing in a list: type (as text), title, the main amount line, area, first photo, owner. -->
<script lang="ts">
  import { Badge } from '#lib/components/ui/badge/index.ts';
  import { acceptsLine, amountLine, listingStatus, placeText, typeLabels } from '#lib/format.ts';
  import type { Listing } from '@wunan/shared';

  let { listing, showOwner = true }: { listing: Omit<Listing, 'flags'>; showOwner?: boolean } = $props();
  const photo = $derived(listing.photos[0]);
  const line = $derived(amountLine(listing as Listing));
  const wanted = $derived(acceptsLine(listing));
  const area = $derived(placeText(listing.area));
  const status = $derived(listingStatus(listing));
</script>

<article class="flex gap-4 rounded-xl border bg-card p-4">
  {#if photo}
    <img
      src="/photos/{photo.key}"
      alt={photo.alt ?? ''}
      class="size-24 shrink-0 rounded-lg object-cover"
      loading="lazy"
      width="96"
      height="96"
    />
  {/if}
  <div class="grid min-w-0 content-start gap-1">
    <div class="flex flex-wrap items-center gap-2">
      <Badge>{typeLabels[listing.type]}</Badge>
      {#if status !== 'Available'}<Badge variant="outline">{status}</Badge>{/if}
    </div>
    <h3 class="text-lg leading-snug font-semibold">
      <a href="/listings/{listing.id}" class="text-foreground">{listing.title}</a>
    </h3>
    {#if line}<p>{line}</p>{/if}
    {#if wanted}<p>{wanted}</p>{/if}
    <p class="text-sm text-muted-foreground">
      {#if area}{area}{/if}{#if area && showOwner} · {/if}{#if showOwner}{listing.owner.displayName}{/if}
    </p>
  </div>
</article>
