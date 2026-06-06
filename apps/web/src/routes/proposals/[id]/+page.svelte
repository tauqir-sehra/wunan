<script lang="ts">
  import { page } from '$app/state';
  import FormField from '#lib/components/FormField.svelte';
  import HelpLink from '#lib/components/HelpLink.svelte';
  import MessageList from '#lib/components/MessageList.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import ProposalDetails from '#lib/components/ProposalDetails.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';

  let { data, form } = $props();
  const p = $derived(data.proposal);
  const other = $derived(p.myRole === 'lister' ? p.requester : p.lister);
  const today = new Date().toISOString().slice(0, 10);
  const asked = { lend: 'to borrow', gift: 'for', trade: 'to trade for', service: 'for' } as const;
  const closedText = {
    nothing_left: 'Closed, because nothing is left on the listing. Nobody did anything wrong.',
    quiet: 'Closed after a quiet month. You can make a new proposal any time.',
    member_left: 'Closed, because one of you left wunan.'
  } as const;
  const endedText = $derived.by(() => {
    switch (p.status) {
      case 'open':
        return null;
      case 'accepted':
        return 'Accepted. It is now an agreement.';
      case 'declined':
        return `${p.lister.displayName} declined this proposal.`;
      case 'withdrawn':
        return `${p.requester.displayName} withdrew this proposal.`;
      case 'closed':
        return closedText[p.closedReason ?? 'quiet'];
    }
  });
  const waitingFor = $derived(
    p.status !== 'open' || p.issues.length > 0 ? null : p.myRole === 'lister' ? 'you to accept it' : `${p.lister.displayName} to accept it`
  );
</script>

<svelte:head><title>Proposal for {p.listing.title} · wunan</title></svelte:head>

<section class="grid max-w-3xl gap-6">
  {#if page.url.searchParams.has('made') && !form}<Notice><p>Your proposal was sent to {p.lister.displayName}.</p></Notice>{/if}
  {#if form?.changed}<Notice kind="error"><p>{form.changed} The new details are shown below.</p></Notice>{/if}
  {#if form?.done}<Notice><p>{form.done === 'declined' ? 'You declined this proposal.' : 'You withdrew your proposal.'}</p></Notice>{/if}
  {#if form?.error}<Notice kind="error"><p>{form.error}</p></Notice>{/if}

  <header class="grid gap-1">
    <h1 class="text-2xl font-semibold">
      {p.myRole === 'requester' ? `You asked ${asked[p.listing.type]}` : `${p.requester.displayName} asked ${asked[p.listing.type]}`}
      <a href="/listings/{p.listing.id}">{p.listing.title}</a>
    </h1>
    <p class="text-muted-foreground">
      With <a href="/members/{other.id}">{other.displayName}</a> · <a href="/proposals">All proposals</a>
    </p>
    <HelpLink topic="proposals" label="Help with proposals" />
  </header>

  {#if endedText}
    <Notice><p>{endedText}{#if p.decisionNote} Note: {p.decisionNote}{/if}</p></Notice>
    {#if p.agreementId}<p><a href="/agreements/{p.agreementId}">See the agreement</a></p>{/if}
  {/if}

  <ProposalDetails proposal={p} />
  {#if waitingFor}<p>Everything is filled in. Waiting for {waitingFor}.</p>{/if}

  {#if p.status === 'open'}
    {#if p.myRole === 'lister'}
      {#if p.canAccept}
        <form method="POST" action="?/accept" class="grid gap-2">
          <input type="hidden" name="version" value={p.version} />
          <p>Accepting makes this an agreement on exactly these details.</p>
          <div><Button type="submit">Accept</Button></div>
        </form>
      {:else}
        <p class="text-muted-foreground">You can accept once {p.requester.displayName} has filled in everything above. You can ask them in a message.</p>
      {/if}
    {:else}
      <div><Button href="/proposals/{p.id}/edit">Change details</Button></div>
    {/if}

    {@const action = p.myRole === 'lister' ? 'decline' : 'withdraw'}
    {#if form?.confirm === action}
      <form method="POST" action="?/{action}" class="grid gap-3 rounded-lg border border-input bg-card p-4">
        <input type="hidden" name="confirmed" value="yes" />
        <p>{action === 'decline' ? `Decline this proposal? ${p.requester.displayName} is told, and can make a new one.` : `Withdraw your proposal? ${p.lister.displayName} is told.`}</p>
        <FormField label="A note" name="note" multiline optional maxlength={500} hint="Optional. Shown to {other.displayName}." />
        <div class="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="destructive">{action === 'decline' ? 'Yes, decline it' : 'Yes, withdraw it'}</Button>
          <a href="/proposals/{p.id}">Keep it open</a>
        </div>
      </form>
    {:else}
      <form method="POST" action="?/{action}"><Button type="submit" variant="outline">{action === 'decline' ? 'Decline' : 'Withdraw'}</Button></form>
    {/if}
  {/if}

  <section class="grid gap-4" aria-labelledby="messages-heading">
    <h2 id="messages-heading" class="text-xl font-semibold">Messages</h2>
    {#if data.hasEarlier}<p class="text-sm text-muted-foreground">Showing the latest 50 messages.</p>{/if}
    {#if data.messages.length === 0}<p class="text-muted-foreground">No messages yet.</p>{/if}
    {#key data.messages}
      <MessageList messages={data.messages} meId={data.member?.id ?? ''} conversationId={p.conversationId} />
    {/key}
    <p><a href={page.url.pathname}>Check for new messages</a></p>

    {#if data.conversation.canWrite}
      {#if form?.proposed}<Notice><p>Your suggested time was sent.</p></Notice>{/if}
      {#if form?.callAccepted}<Notice><p>You accepted the call time. The call itself happens outside wunan.</p></Notice>{/if}
      <form method="POST" action="?/send" class="grid gap-3">
        <FormField label="Write a message" name="body" multiline required maxlength={4000} value={form?.sent ? '' : form?.values?.body} error={form?.fields?.body} />
        <div><Button type="submit" variant={p.status === 'open' ? 'outline' : 'default'}>Send</Button></div>
      </form>
      <p>
        <a href="/threads/{p.conversationId}/share-contact">Share your phone number or email</a> — you'll see exactly what will be shared first.
      </p>
      <details class="rounded-lg border bg-card p-4" open={Boolean(form?.fields?.proposedTime)}>
        <summary class="min-h-11 cursor-pointer content-center font-medium">Suggest a time to call</summary>
        <form method="POST" action="?/proposeCall" class="mt-3 grid gap-3">
          {#if form?.fields?.proposedTime}<p class="font-medium text-destructive">{form.fields.proposedTime}</p>{/if}
          <div class="flex flex-wrap gap-4">
            <FormField label="Day" name="date" type="date" min={today} required />
            <FormField label="Time" name="time" type="time" required />
          </div>
          <div><Button type="submit" variant="outline">Suggest this time</Button></div>
        </form>
      </details>
    {:else}
      <p class="text-muted-foreground">This proposal has ended, so no new messages can be added.</p>
    {/if}
  </section>
</section>
