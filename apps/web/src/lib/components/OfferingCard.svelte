<!-- An offering in a list: type (as text), title, the main amount line, the request it fulfils, area, first photo, owner. -->
<script lang="ts">
  import { Badge } from '#lib/components/ui/badge/index.ts';
  import { acceptsLine, amountLine, offeringStatus, placeText, typeLabels } from '#lib/format.ts';
  import type { Offering } from '@wunan/shared';

  let { offering, showOwner = true }: { offering: Omit<Offering, 'flags'>; showOwner?: boolean } =
    $props();
  const photo = $derived(offering.photos[0]);
  const line = $derived(amountLine(offering as Offering));
  const wanted = $derived(acceptsLine(offering));
  const area = $derived(placeText(offering.area));
  const status = $derived(offeringStatus(offering));
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
      <Badge>{typeLabels[offering.type]}</Badge>
      {#if status !== 'Available'}<Badge variant="outline">{status}</Badge>{/if}
    </div>
    <h3 class="text-lg leading-snug font-semibold">
      <a href="/offerings/{offering.id}" class="text-foreground">{offering.title}</a>
    </h3>
    {#if line}<p>{line}</p>{/if}
    {#if wanted}<p>{wanted}</p>{/if}
    {#if offering.answersRequest}<p class="text-sm text-muted-foreground">
        For {offering.answersRequest.asker.displayName}'s request
      </p>{/if}
    <p class="text-sm text-muted-foreground">
      {#if area}{area}{/if}{#if area && showOwner}
        ·
      {/if}{#if showOwner}{offering.owner.displayName}{/if}
    </p>
  </div>
</article>
