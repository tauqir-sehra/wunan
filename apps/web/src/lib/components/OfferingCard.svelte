<!-- An offering in a list: type (as text), title, the main amount line, the request it fulfils, area, owner, and its photos (first one shown) on the right. -->
<script lang="ts">
  import PhotoGallery from '#lib/components/PhotoGallery.svelte';
  import { Badge } from '#lib/components/ui/badge/index.ts';
  import { acceptsLine, amountLine, offeringStatus, placeText, typeLabels } from '#lib/format.ts';
  import type { Offering } from '@wunan/shared';

  let { offering, showOwner = true }: { offering: Omit<Offering, 'flags'>; showOwner?: boolean } =
    $props();
  const line = $derived(amountLine(offering as Offering));
  const wanted = $derived(acceptsLine(offering));
  const area = $derived(placeText(offering.area));
  const status = $derived(offeringStatus(offering));
  const byline = $derived(
    [area, showOwner ? offering.owner.displayName : null].filter(Boolean).join(' · ')
  );
</script>

<!--
  The photo sits on the right at a fixed size, so every card's text starts at the same place.
  The title's link covers the whole card, so anywhere on it opens the offering; the photo sits
  above that and still opens the photos.
-->
<article class="relative flex h-full items-start gap-4 surface p-5 hover:border-input">
  <div class="grid min-w-0 flex-1 content-start gap-1.5">
    <div class="flex flex-wrap items-center gap-2">
      <Badge>{typeLabels[offering.type]}</Badge>
      {#if status !== 'Available'}<Badge variant="outline">{status}</Badge>{/if}
    </div>
    <h3 class="text-lg leading-snug font-semibold">
      <a href="/offerings/{offering.id}" class="text-foreground after:absolute after:inset-0"
        >{offering.title}</a
      >
    </h3>
    {#if line}<p>{line}</p>{/if}
    {#if wanted}<p>{wanted}</p>{/if}
    {#if offering.answersRequest}<p class="text-sm text-muted-foreground">
        For {offering.answersRequest.asker.displayName}'s request
      </p>{/if}
    {#if byline}<p class="text-sm text-muted-foreground">{byline}</p>{/if}
  </div>
  {#if offering.photos.length}<div class="relative z-10">
      <PhotoGallery photos={offering.photos} cover />
    </div>{/if}
</article>
