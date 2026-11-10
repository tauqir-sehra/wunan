<script lang="ts">
  import MessagePanel from '#lib/components/MessagePanel.svelte';
  import HelpLink from '#lib/components/HelpLink.svelte';
  import MessageComposer from '#lib/components/MessageComposer.svelte';
  import MessageList from '#lib/components/MessageList.svelte';
  import Notice from '#lib/components/Notice.svelte';

  let { data, form } = $props();
  const c = $derived(data.conversation);
  const names = $derived(c.participants.map((p) => p.displayName).join(', '));
</script>

<svelte:head><title>Conversation with {names} · wunan</title></svelte:head>

<section class="grid gap-6">
  <header class="grid gap-1">
    <div class="flex items-start justify-between gap-3">
      <h1 class="text-2xl font-semibold sm:text-3xl">{names}</h1>
      <HelpLink topic="asking-for-help" label="Help with asking for help" />
    </div>
    {#if c.offering}<p class="text-muted-foreground">
        About <a href="/offerings/{c.offering.id}">{c.offering.title}</a>
      </p>{/if}
  </header>

  <div class="max-w-2xl">
    <MessagePanel id="messages" heading="Messages" refreshLabel="Check for new messages">
      {#if data.hasEarlier}<p class="text-sm text-muted-foreground">
          Showing the latest 50 messages.
        </p>{/if}
      {#if data.messages.length === 0}<p class="text-muted-foreground">No messages yet.</p>{/if}
      {#key data.messages}
        <MessageList messages={data.messages} meId={data.member?.id ?? ''} conversationId={c.id} />
      {/key}

      {#snippet footer()}
        {#if !c.canWrite}
          <Notice
            ><p>
              You can read these messages because they were shared with you to help. Only the two
              people in the agreement can write here.
            </p></Notice
          >
        {:else}
          {#if form?.error}<Notice kind="error"><p>{form.error}</p></Notice>{/if}
          <MessageComposer
            otherNames={names}
            contact={data.contact}
            sent={Boolean(form?.sent)}
            status={form?.sent
              ? 'Your message is sent.'
              : form?.callAccepted
                ? 'You accepted the call time. The call itself happens outside wunan, by phone or any app you both use.'
                : ''}
            values={form?.values ?? {}}
            fields={form?.fields ?? {}}
          />
        {/if}
      {/snippet}
    </MessagePanel>
  </div>
</section>
