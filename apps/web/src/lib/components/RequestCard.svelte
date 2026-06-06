<!-- A request in a list: kind, title, when it's needed, area, who asked, and how many offers. -->
<script lang="ts">
  import { Badge } from '#lib/components/ui/badge/index.ts';
  import { kindLabels, neededText, placeText } from '#lib/format.ts';
  import type { RequestSummary } from '@wunan/shared';

  let { request, showAsker = true }: { request: RequestSummary; showAsker?: boolean } = $props();
  const area = $derived(placeText(request.area));
  const offers = $derived(
    request.linkCount === 0
      ? 'No offers yet'
      : request.linkCount === 1
        ? '1 offer'
        : `${request.linkCount} offers`
  );
</script>

<article class="grid gap-1 rounded-xl border bg-card p-4">
  <div class="flex flex-wrap items-center gap-2">
    <Badge>{kindLabels[request.kind]}</Badge>
    {#if request.status === 'closed'}<Badge variant="outline"
        >{request.closedReason === 'agreed' ? 'Settled' : 'Closed'}</Badge
      >{/if}
    {#if request.unseenFlags}<Badge variant="outline"
        >{request.unseenFlags} new {request.unseenFlags === 1 ? 'request' : 'requests'} from members</Badge
      >{/if}
  </div>
  <h3 class="text-lg leading-snug font-semibold">
    <a href="/requests/{request.id}" class="text-foreground">{request.title}</a>
  </h3>
  <p>{neededText(request.neededAfter, request.neededBy)} · {offers}</p>
  <p class="text-sm text-muted-foreground">
    {#if area}{area}{/if}{#if area && showAsker}
      ·
    {/if}{#if showAsker}{request.asker.displayName}{/if}
  </p>
</article>
