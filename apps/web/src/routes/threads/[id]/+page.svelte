<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import { page } from '$app/state';
  import MessageComposer from '#lib/components/MessageComposer.svelte';
  import MessageList from '#lib/components/MessageList.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';

  let { data, form } = $props();
  const c = $derived(data.conversation);
  const names = $derived(c.participants.map((p) => p.displayName).join(', '));
</script>

<svelte:head><title>Conversation with {names} · wunan</title></svelte:head>

<section class="grid max-w-3xl gap-6">
  <header class="grid gap-1">
    <div class="flex items-start justify-between gap-3">
      <h1 class="text-2xl font-semibold">{names}</h1>
      <HelpLink topic="asking-for-help" label="Help with asking for help" />
    </div>
    {#if c.listing}<p class="text-muted-foreground">About <a href="/listings/{c.listing.id}">{c.listing.title}</a></p>{/if}
  </header>

  <section class="grid gap-4" aria-labelledby="messages-heading">
    <div class="flex items-center gap-1">
      <h2 id="messages-heading" class="text-xl font-semibold">Messages</h2>
      <a href={page.url.pathname} aria-label="Check for new messages" title="Check for new messages" class="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
        <RefreshCwIcon class="size-4" aria-hidden="true" />
      </a>
    </div>
    {#if data.hasEarlier}<p class="text-sm text-muted-foreground">Showing the latest 50 messages.</p>{/if}
    {#if data.messages.length === 0}<p class="text-muted-foreground">No messages yet.</p>{/if}
    {#key data.messages}
      <MessageList messages={data.messages} meId={data.member?.id ?? ''} conversationId={c.id} />
    {/key}

    {#if !c.canWrite}
      <Notice><p>You can read these messages because they were shared with you to help. Only the two people in the agreement can write here.</p></Notice>
    {:else}
      {#if form?.error}<Notice kind="error"><p>{form.error}</p></Notice>{/if}
      {#if form?.proposed}<Notice><p>Your suggested time was sent.</p></Notice>{/if}
      {#if form?.accepted}<Notice><p>You accepted the call time. The call itself happens outside wunan, by phone or any app you both use.</p></Notice>{/if}
      {#if form?.shared}<Notice><p>Your contact details were shared.</p></Notice>{/if}
      <MessageComposer
        conversationId={c.id}
        otherNames={names}
        contact={data.contact}
        sent={Boolean(form?.sent)}
        values={form?.values ?? {}}
        fields={form?.fields ?? {}}
      />
    {/if}
  </section>
</section>
