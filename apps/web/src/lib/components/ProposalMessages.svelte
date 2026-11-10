<!--
  The private messages between the two people on a proposal, with the message box. Shown on the
  proposal and on the agreement made from it, so the whole conversation stays in one place. The
  page's form actions come from `threadActions` in `#lib/proposal-thread.ts`.
-->
<script lang="ts">
  import MessageComposer from '#lib/components/MessageComposer.svelte';
  import MessageList from '#lib/components/MessageList.svelte';
  import MessagePanel from '#lib/components/MessagePanel.svelte';
  import type { ContactDetails, Message } from '@wunan/shared';

  let {
    thread,
    conversationId,
    meId,
    otherName,
    form,
    sendVariant = 'default'
  }: {
    thread: {
      messages: Message[];
      hasEarlier: boolean;
      conversation: { canWrite: boolean };
      contact: ContactDetails;
    };
    conversationId: string;
    meId: string;
    otherName: string;
    form: Record<string, unknown> | null | undefined;
    sendVariant?: 'default' | 'outline';
  } = $props();
</script>

<MessagePanel id="messages" heading="Messages" refreshLabel="Check for new messages">
  {#if thread.hasEarlier}<p class="text-sm text-muted-foreground">
      Showing the latest 50 messages.
    </p>{/if}
  {#if thread.messages.length === 0}<p class="text-muted-foreground">No messages yet.</p>{/if}
  {#key thread.messages}
    <MessageList messages={thread.messages} {meId} {conversationId} />
  {/key}

  {#snippet footer()}
    {#if thread.conversation.canWrite}
      <MessageComposer
        otherNames={otherName}
        contact={thread.contact}
        sent={Boolean(form?.sent)}
        status={form?.sent
          ? 'Your message is sent.'
          : form?.callAccepted
            ? 'You accepted the call time. The call itself happens outside wunan, by phone or any app you both use.'
            : ''}
        values={(form?.values as Record<string, string>) ?? {}}
        fields={(form?.fields as Record<string, string>) ?? {}}
        {sendVariant}
      />
    {:else}
      <p class="text-muted-foreground">This proposal has ended, so no new messages can be added.</p>
    {/if}
  {/snippet}
</MessagePanel>
