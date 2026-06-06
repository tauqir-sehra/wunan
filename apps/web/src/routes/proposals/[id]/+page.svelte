<script lang="ts">
  import { page } from '$app/state';
  import FormField from '#lib/components/FormField.svelte';
  import HelpLink from '#lib/components/HelpLink.svelte';
  import MessageComposer from '#lib/components/MessageComposer.svelte';
  import MessageList from '#lib/components/MessageList.svelte';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import Notice from '#lib/components/Notice.svelte';
  import ProposalDetails from '#lib/components/ProposalDetails.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';

  let { data, form } = $props();
  const p = $derived(data.proposal);
  const other = $derived(p.myRole === 'lister' ? p.requester : p.lister);
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
    <div class="flex items-start justify-between gap-3">
      <h1 class="text-2xl font-semibold">
      {p.myRole === 'requester' ? `You asked ${asked[p.listing.type]}` : `${p.requester.displayName} asked ${asked[p.listing.type]}`}
      <a href="/listings/{p.listing.id}">{p.listing.title}</a>
    </h1>
      <HelpLink topic="proposals" label="Help with proposals" />
    </div>
    <p class="text-muted-foreground">
      With <a href="/members/{other.id}">{other.displayName}</a> · <a href="/proposals">All proposals</a>
    </p>
  </header>

  {#if endedText}
    <Notice><p>{endedText}{#if p.decisionNote} Note: {p.decisionNote}{/if}</p></Notice>
    {#if p.agreementId}<p><a href="/agreements/{p.agreementId}">See the agreement</a></p>{/if}
  {/if}

  <ProposalDetails proposal={p} />
  {#if waitingFor}<p>Everything is filled in. Waiting for {waitingFor}.</p>{/if}

  {#if p.status === 'open'}
    {#if p.myRole === 'lister'}
      <!-- Always shown, so the lister knows where it will be; it can't be pressed until nothing blocks it. -->
      <form method="POST" action="?/accept" class="grid gap-2">
        <input type="hidden" name="version" value={p.version} />
        <p id="accept-note" class={p.canAccept ? '' : 'text-muted-foreground'}>
          {p.canAccept
            ? 'Accepting makes this an agreement on exactly these details.'
            : `You can accept once ${p.requester.displayName} has filled in everything above. You can ask them in a message.`}
        </p>
        <div><Button type="submit" disabled={!p.canAccept} aria-describedby="accept-note">Accept</Button></div>
      </form>
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
    <div class="flex items-center gap-1">
      <h2 id="messages-heading" class="text-xl font-semibold">Messages</h2>
      <a href={page.url.pathname} aria-label="Check for new messages" title="Check for new messages" class="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
        <RefreshCwIcon class="size-4" aria-hidden="true" />
      </a>
    </div>
    {#if data.hasEarlier}<p class="text-sm text-muted-foreground">Showing the latest 50 messages.</p>{/if}
    {#if data.messages.length === 0}<p class="text-muted-foreground">No messages yet.</p>{/if}
    {#key data.messages}
      <MessageList messages={data.messages} meId={data.member?.id ?? ''} conversationId={p.conversationId} />
    {/key}

    {#if data.conversation.canWrite}
      {#if form?.proposed}<Notice><p>Your suggested time was sent.</p></Notice>{/if}
      {#if form?.callAccepted}<Notice><p>You accepted the call time. The call itself happens outside wunan.</p></Notice>{/if}
      {#if form?.shared}<Notice><p>Your contact details were shared.</p></Notice>{/if}
      <MessageComposer
        conversationId={p.conversationId}
        otherNames={other.displayName}
        contact={data.contact}
        sent={Boolean(form?.sent)}
        values={form?.values ?? {}}
        fields={form?.fields ?? {}}
        sendVariant={p.status === 'open' ? 'outline' : 'default'}
      />
    {:else}
      <p class="text-muted-foreground">This proposal has ended, so no new messages can be added.</p>
    {/if}
  </section>
</section>
