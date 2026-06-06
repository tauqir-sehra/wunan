<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import { page } from '$app/state';
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import MessageList from '#lib/components/MessageList.svelte';
  import Notice from '#lib/components/Notice.svelte';

  let { data, form } = $props();
  const c = $derived(data.conversation);
  const names = $derived(c.participants.map((p) => p.displayName).join(', '));
  const today = new Date().toISOString().slice(0, 10);
</script>

<svelte:head><title>Conversation with {names} · wunan</title></svelte:head>

<section class="grid max-w-3xl gap-6">
  <header class="grid gap-1">
    <h1 class="text-2xl font-semibold">{names}</h1>
    {#if c.listing}<p class="text-muted-foreground">
        About <a href="/listings/{c.listing.id}">{c.listing.title}</a>
      </p>{/if}
    <HelpLink topic="asking-for-help" label="Help with asking for help" />
  </header>

  {#if data.hasEarlier}<p class="text-sm text-muted-foreground">
      Showing the latest 50 messages.
    </p>{/if}
  {#if data.messages.length === 0}<p class="text-muted-foreground">No messages yet.</p>{/if}
  {#key data.messages}
    <MessageList messages={data.messages} meId={data.member?.id ?? ''} conversationId={c.id} />
  {/key}

  <p><a href={page.url.pathname}>Check for new messages</a></p>

  {#if !c.canWrite}
    <Notice><p>You can read these messages because they were shared with you to help. Only the two people in the agreement can write here.</p></Notice>
  {:else}

  {#if form?.error}<Notice kind="error"><p>{form.error}</p></Notice>{/if}
  {#if form?.proposed}<Notice><p>Your suggested time was sent.</p></Notice>{/if}
  {#if form?.accepted}<Notice
      ><p>
        You accepted the call time. The call itself happens outside wunan, by phone or any app you
        both use.
      </p></Notice
    >{/if}

  <form method="POST" action="?/send" class="grid gap-3">
    <FormField
      label="Write a message"
      name="body"
      multiline
      required
      maxlength={4000}
      value={form?.sent ? '' : form?.values?.body}
      error={form?.fields?.body}
    />
    <div><Button type="submit">Send</Button></div>
  </form>

  <section class="grid gap-3" aria-labelledby="more-heading">
    <h2 id="more-heading" class="text-lg font-semibold">Arrange the handover</h2>
    <p>
      <a href="/threads/{c.id}/share-contact">Share your phone number or email</a> — you'll see exactly
      what will be shared first.
    </p>
    <details class="rounded-lg border bg-card p-4" open={Boolean(form?.fields?.proposedTime)}>
      <summary class="min-h-11 cursor-pointer content-center font-medium"
        >Suggest a time to call</summary
      >
      <form method="POST" action="?/proposeCall" class="mt-3 grid gap-3">
        {#if form?.fields?.proposedTime}<p class="font-medium text-destructive">
            {form.fields.proposedTime}
          </p>{/if}
        <div class="flex flex-wrap gap-4">
          <FormField label="Day" name="date" type="date" min={today} required />
          <FormField label="Time" name="time" type="time" required />
        </div>
        <p class="text-sm text-muted-foreground">
          The call happens outside wunan. wunan only helps you agree on a time.
        </p>
        <div><Button type="submit" variant="outline">Suggest this time</Button></div>
      </form>
    </details>
  </section>
  {/if}
</section>
