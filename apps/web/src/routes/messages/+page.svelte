<script lang="ts">
  import { when } from '#lib/format.ts';

  let { data } = $props();
  const names = (people: { displayName: string }[]) => people.map((p) => p.displayName).join(', ') || 'Just you';
</script>

<svelte:head><title>Messages · wunan</title></svelte:head>

<section class="grid gap-6">
  <h1 class="text-2xl font-semibold">Messages</h1>
  {#if data.conversations.length === 0}
    <p class="text-muted-foreground">
      No conversations yet. To start one, open a listing and choose “Message about this”.
    </p>
  {:else}
    <ul class="grid gap-3">
      {#each data.conversations as conversation (conversation.id)}
        <li>
          <a
            href="/messages/{conversation.id}"
            class="grid gap-1 rounded-xl border bg-card p-4 text-foreground no-underline hover:bg-accent {conversation.unread ? 'border-l-4 border-l-primary' : ''}"
          >
            <span class="flex flex-wrap items-baseline gap-x-2">
              <span class="font-semibold underline underline-offset-2">{names(conversation.participants)}</span>
              {#if conversation.listing}<span class="text-muted-foreground">about {conversation.listing.title}</span>{/if}
              {#if conversation.isMediation}<span class="text-muted-foreground">(asking for help)</span>{/if}
              {#if conversation.unread}<strong>New messages</strong>{/if}
            </span>
            {#if conversation.lastMessage}
              <span class="text-muted-foreground">
                {conversation.lastMessage.preview} · {when(conversation.lastMessage.createdAt)}
              </span>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>
