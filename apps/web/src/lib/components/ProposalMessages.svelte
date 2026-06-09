<!--
  The private messages between the two people on a proposal, with the message box. Shown on the
  proposal and on the agreement made from it, so the whole conversation stays in one place. The
  page's form actions come from `threadActions` in `#lib/proposal-thread.ts`.
-->
<script lang="ts">
  import { page } from '$app/state';
  import MessageComposer from '#lib/components/MessageComposer.svelte';
  import MessageList from '#lib/components/MessageList.svelte';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
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

<section id="messages" class="grid gap-4" aria-labelledby="messages-heading">
  <div class="flex items-center gap-1">
    <h2 id="messages-heading" class="text-xl font-semibold">Messages</h2>
    <a
      href="{page.url.pathname}#messages"
      aria-label="Check for new messages"
      title="Check for new messages"
      class="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <RefreshCwIcon class="size-4" aria-hidden="true" />
    </a>
  </div>
  {#if thread.hasEarlier}<p class="text-sm text-muted-foreground">
      Showing the latest 50 messages.
    </p>{/if}
  {#if thread.messages.length === 0}<p class="text-muted-foreground">No messages yet.</p>{/if}
  {#key thread.messages}
    <MessageList messages={thread.messages} {meId} {conversationId} />
  {/key}

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
</section>
