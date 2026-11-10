<!--
  Public messages on a request or an offering (003 FR-023 to FR-023g): everyone in wunan can read and
  post, up to 240 characters each. Oldest first; "Show earlier messages" when there are more than
  20. Authors can remove their own messages (with a confirmation); others can raise an issue.
  New messages and removals arrive live and are announced politely; without JavaScript, the
  refresh button and plain form posts do the same, and the length is checked by the server.
-->
<script lang="ts">
  import { enhance, type SubmitFunction } from '$app/forms';
  import { page } from '$app/state';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import { stayPut } from '#lib/stay-put.ts';
  import MessageBox from '#lib/components/MessageBox.svelte';
  import MessageItem from '#lib/components/MessageItem.svelte';
  import MessagePanel from '#lib/components/MessagePanel.svelte';
  import PopupDialog from '#lib/components/PopupDialog.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { PUBLIC_MESSAGE_LIMIT, type PublicMessage, type PublicThread } from '@wunan/shared';
  import { onMount } from 'svelte';

  let {
    thread,
    liveUrl,
    closedText,
    form
  }: {
    thread: PublicThread;
    /** The page's live stream, e.g. /requests/<id>/messages/live. */
    liveUrl: string;
    closedText: string;
    form?: {
      done?: string;
      error?: string;
      fields?: Record<string, string>;
      values?: Record<string, string>;
      confirmRemoveMessage?: string;
    } | null;
  } = $props();

  // Live changes on top of what the page loaded: new messages added, removed ones updated.
  let changed = $state<PublicMessage[]>([]);
  const messages = $derived.by(() => {
    const byId = new Map(changed.map((m) => [m.id, m]));
    const merged = thread.items.map((m) => byId.get(m.id) ?? m);
    return [...merged, ...changed.filter((m) => !thread.items.some((i) => i.id === m.id))];
  });
  let announcement = $state('');
  // Each message's "Raise an issue" pop-up, closed once its request is sent.
  let raising = $state<Record<string, boolean>>({});

  onMount(() => {
    if (!('EventSource' in window)) return;
    const source = new EventSource(liveUrl);
    source.addEventListener('message', (event) => {
      const message = JSON.parse(event.data) as PublicMessage;
      const existing = changed.findIndex((m) => m.id === message.id);
      if (existing >= 0) changed[existing] = message;
      else changed.push(message);
      if (!message.mine && !message.removed && !thread.items.some((m) => m.id === message.id)) {
        announcement = `New message from ${message.author.displayName}: ${message.body}`;
      }
    });
    return () => source.close();
  });

  // Removing updates the thread in place, so the page stays where it is (without JavaScript, the
  // "#public-messages" in the form's address brings the reloaded page back here).
  const keepPlace: SubmitFunction =
    () =>
    async ({ result, update }) => {
      await update({ reset: false });
      if (
        result.type === 'success' &&
        (result.data as { done?: string } | undefined)?.done === 'removeMessage'
      )
        announcement = 'Your message is removed.';
    };

  const earlierHref = $derived(
    `${page.url.pathname}?before=${encodeURIComponent(thread.items[0]?.id ?? '')}#public-messages`
  );
  const posting = $derived(form?.values?.body !== undefined);
</script>

<MessagePanel
  id="public-messages"
  heading="Public messages"
  refreshLabel="Check for new public messages"
>
  {#if thread.hasEarlier}<p>
      <a href={earlierHref} class="inline-flex min-h-11 items-center">Show earlier messages</a>
    </p>{/if}
  {#if messages.length === 0}<p class="text-muted-foreground">No public messages yet.</p>{/if}

  <ol class="grid max-w-xl gap-2">
    {#each messages as message (message.id)}
      {@const confirming = form?.confirmRemoveMessage === message.id}
      <MessageItem
        mine={message.mine}
        author={message.author}
        createdAt={message.createdAt}
        removed={message.removed}
      >
        <p class="break-words whitespace-pre-line">{message.body}</p>
        {#if confirming}
          <form
            method="POST"
            action="?/removeMessage#public-messages"
            class="flex flex-wrap items-center gap-3 pt-1"
            use:enhance={keepPlace}
          >
            <input type="hidden" name="messageId" value={message.id} />
            <input type="hidden" name="confirmed" value="yes" />
            <span class="text-sm">Remove this message?</span>
            <Button type="submit" variant="destructive" size="sm">Yes, remove it</Button>
            <a
              href="{page.url.pathname}#public-messages"
              class="text-sm"
              data-sveltekit-reset="false">Keep it</a
            >
          </form>
        {/if}
        {#if message.flags?.length}
          <ul class="mt-1 grid gap-1 rounded-md bg-muted/60 p-2 text-sm">
            {#each message.flags as flag (flag.id)}<li>
                {flag.from.displayName} asked: {flag.request}
              </li>{/each}
          </ul>
        {/if}
        {#snippet actions()}
          {#if confirming}
            <!-- The confirmation is shown in the message. -->
          {:else if message.mine}
            <form method="POST" action="?/removeMessage#public-messages" use:enhance={keepPlace}>
              <input type="hidden" name="messageId" value={message.id} />
              <Button type="submit" variant="ghost" size="sm" class="text-sm font-normal"
                >Remove</Button
              >
            </form>
          {:else}
            <PopupDialog
              label="Raise an issue"
              bind:open={
                () => raising[message.id] ?? false, (value) => (raising[message.id] = value)
              }
              variant="ghost"
              class="text-sm font-normal"
              title="Raise an issue with {message.author.displayName}"
              description="For example, to ask them to remove it. It goes only to {message.author
                .displayName}, and the message stays as it is."
              fallbackHref="/public-messages/{message.id}/issue?back={encodeURIComponent(
                page.url.pathname
              )}"
            >
              <form
                method="POST"
                action="?/flagMessage#public-messages"
                class="grid gap-4"
                use:enhance={stayPut(() => (raising[message.id] = false))}
              >
                <input type="hidden" name="messageId" value={message.id} />
                <FormField
                  label="What would you like to ask?"
                  name="request"
                  multiline
                  required
                  maxlength={500}
                />
                <div><Button type="submit">Send to {message.author.displayName}</Button></div>
              </form>
            </PopupDialog>
          {/if}
        {/snippet}
      </MessageItem>
    {/each}
  </ol>
  {#if form?.done === 'flagMessage' || (!form && page.url.searchParams.get('messageIssue') === 'sent')}
    <Notice><p>Your request was sent to the person who wrote it.</p></Notice>
  {/if}

  <div class="sr-only" aria-live="polite">{announcement}</div>

  {#snippet footer()}
    {#if thread.canPost}
      <MessageBox
        id="public-body"
        label="Add a public message"
        action="?/post#public-messages"
        hint="Everyone on wunan can read this. Don't share phone numbers or addresses."
        maxlength={PUBLIC_MESSAGE_LIMIT}
        buttonLabel="Post"
        value={posting ? form?.values?.body : ''}
        error={form?.fields?.body}
        problem={posting && !form?.fields?.body ? form?.error : undefined}
        status={form?.done === 'post' ? 'Your message is posted.' : ''}
      />
    {:else}
      <p class="text-muted-foreground">{closedText}</p>
    {/if}
  {/snippet}
</MessagePanel>
