<!--
  One arrangement in the list: the offering, whose ask it is, who it's with, where it stands, and
  the latest message's first line. The whole card is one link to the arrangement.
-->
<script lang="ts">
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import { Badge } from '#lib/components/ui/badge/index.ts';
  import { stageLabels, stageWords } from '#lib/format.ts';
  import type { ArrangementSummary } from '@wunan/shared';

  let { arrangement: a, myName }: { arrangement: ArrangementSummary; myName: string } = $props();
  const line = $derived(
    stageWords({
      ...a,
      listerName: a.myRole === 'requester' ? a.otherMember.displayName : myName
    })
  );
</script>

<a
  href="/arrangements/{a.id}"
  class="flex h-full items-center gap-3 surface p-5 text-foreground no-underline hover:border-input"
>
  <span class="grid min-w-0 flex-1 gap-1">
    <span class="flex flex-wrap items-center gap-2">
      <Badge variant={a.stage === 'ended' ? 'outline' : 'default'}>{stageLabels[a.stage]}</Badge>
      {#if a.unread}<span class="text-sm font-medium">New message</span>{/if}
    </span>
    <span class="text-lg leading-snug font-semibold underline underline-offset-[3px]"
      >{a.offering.title}</span
    >
    <span>
      {a.myRole === 'requester'
        ? `You asked ${a.otherMember.displayName}`
        : `${a.otherMember.displayName} asked you`}
    </span>
    <span>{line}</span>
    {#if a.lastMessagePreview}<span class="truncate text-sm text-muted-foreground"
        >{a.lastMessagePreview}</span
      >{/if}
  </span>
  <ChevronRightIcon class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
</a>
