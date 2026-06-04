<!--
  The messages in a conversation, oldest first. With JavaScript, new messages arrive live
  (FR-018a): they are added without animation or sound, the page only follows them if the member
  is already at the bottom, and each one is announced politely to screen readers.
  Without JavaScript, the "Check for new messages" link on the page reloads it.
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { when } from '#lib/format.ts';
  import type { Message } from '@wunan/shared';

  let { messages: initial, meId, conversationId }: { messages: Message[]; meId: string; conversationId: string } = $props();

  let added = $state<Message[]>([]);
  let announcement = $state('');
  const messages = $derived([...initial, ...added.filter((m) => !initial.some((i) => i.id === m.id))]);

  onMount(() => {
    if (!('EventSource' in window)) return;
    const source = new EventSource(`/messages/${conversationId}/live`);
    source.addEventListener('message', async (event) => {
      const message = JSON.parse(event.data) as Message;
      if (messages.some((m) => m.id === message.id)) return;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80;
      added.push(message);
      if (message.author?.id !== meId) announcement = `New message from ${message.author?.displayName ?? 'wunan'}: ${describe(message)}`;
      await tick();
      // Follow new messages only if the member hasn't scrolled up to read earlier ones.
      if (atBottom) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    });
    return () => source.close();
  });

  function describe(message: Message): string {
    switch (message.kind) {
      case 'contact_shared':
        return `shared contact details. ${message.body}`;
      case 'call_proposed':
        return `suggested a call on ${when(message.proposedTime!)}`;
      case 'call_accepted':
        return `accepted the call on ${when(message.proposedTime!)}`;
      default:
        return message.body;
    }
  }
</script>

<ol class="grid gap-3" aria-label="Messages">
  {#each messages as message (message.id)}
    {@const mine = message.author?.id === meId}
    <li class="grid gap-1 rounded-xl border p-4 {mine ? 'ml-8 bg-accent' : 'mr-8 bg-card'} {message.kind === 'system' ? 'mx-0 border-dashed bg-muted' : ''}">
      <p class="text-sm text-muted-foreground">
        <span class="font-medium text-foreground">{mine ? 'You' : (message.author?.displayName ?? 'wunan')}</span>
        · <time datetime={message.createdAt}>{when(message.createdAt)}</time>
      </p>
      {#if message.kind === 'text' || message.kind === 'system'}
        <p class="whitespace-pre-line">{message.body}</p>
      {:else if message.kind === 'contact_shared'}
        <p class="font-medium">{mine ? 'You shared your contact details:' : 'Shared their contact details:'}</p>
        <p class="whitespace-pre-line">{message.body}</p>
      {:else if message.kind === 'call_proposed'}
        <p>{mine ? 'You suggested' : 'Suggested'} a call on <strong>{when(message.proposedTime!)}</strong>.</p>
        {#if message.accepted}
          <p class="text-muted-foreground">This time was accepted.</p>
        {:else if !mine}
          <form method="POST" action="?/acceptCall" class="flex flex-wrap items-center gap-3">
            <input type="hidden" name="messageId" value={message.id} />
            <Button type="submit" variant="outline" size="sm">Accept this time</Button>
            <span class="text-sm text-muted-foreground">Or suggest another time below.</span>
          </form>
        {/if}
      {:else if message.kind === 'call_accepted'}
        <p>{mine ? 'You accepted' : 'Accepted'} the call on <strong>{when(message.proposedTime!)}</strong>.</p>
      {/if}
    </li>
  {/each}
</ol>

<div class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
