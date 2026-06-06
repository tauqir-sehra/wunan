<script lang="ts">
  import { page } from '$app/state';
  import { Badge } from '#lib/components/ui/badge/index.ts';
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import { acceptsLine, amountLine, handoverQuestion, handoverText, listingStatus, periodText, placeText, timesText, typeLabels } from '#lib/format.ts';

  let { data, form } = $props();
  const listing = $derived(data.listing);
  const isOwner = $derived(data.member?.id === listing.owner.id);
  const created = $derived(page.url.searchParams.has('created'));
  const photoProblems = $derived(page.url.searchParams.get('photoProblems'));
  const doneText: Record<string, string> = {
    pause: 'Your listing is paused. Nobody will find it in search until you make it available again.',
    resume: 'Your listing is available again.',
    remove: 'Your listing is removed. You can reopen it any time from this page.',
    reopen: 'Your listing is available again.',
    flag: 'Your request was sent to the person who listed this.'
  };
  const askWords = { lend: 'Ask to borrow', gift: 'Ask for this', trade: 'Offer a trade', service: 'Ask for this service' } as const;
  const names = $derived({ lister: isOwner ? 'me' : listing.owner.displayName, requester: isOwner ? 'the recipient' : 'you' });
  const since = $derived(new Date(listing.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
</script>

<svelte:head><title>{listing.title} · wunan</title></svelte:head>

<article class="grid max-w-3xl gap-6">
  {#if created}
    <Notice><p>Your listing is published.</p></Notice>
  {/if}
  {#if photoProblems}
    <Notice kind="error"><p>Some photos couldn't be added. {photoProblems} You can try again from Edit.</p></Notice>
  {/if}
  {#if form?.done}
    <Notice><p>{doneText[form.done]}</p></Notice>
  {:else if form?.error}
    <Notice kind="error"><p>{form.error}</p></Notice>
  {/if}

  <header class="grid gap-2">
    <div class="flex flex-wrap gap-2">
      <Badge>{typeLabels[listing.type]}</Badge>
      <Badge variant="outline">{listingStatus(listing)}</Badge>
    </div>
    <h1 class="text-3xl font-semibold">{listing.title}</h1>
    {#if amountLine(listing)}<p class="text-lg">{amountLine(listing)}</p>{/if}
    {#if acceptsLine(listing)}<p class="text-lg">{acceptsLine(listing)}</p>{/if}
  </header>

  <dl class="grid gap-2 rounded-lg border bg-card p-4 sm:grid-cols-[12rem_1fr]">
    <dt class="font-medium">{handoverQuestion[listing.type]}</dt>
    <dd>{listing.handovers.length ? listing.handovers.map((h) => handoverText(listing.type, h, names)).join(', or ') : 'To be agreed'}</dd>
    {#if listing.area}<dt class="font-medium">Area</dt><dd>{placeText(listing.area)}</dd>{/if}
    {#if listing.meetingPlace}<dt class="font-medium">Meeting place</dt><dd>{placeText(listing.meetingPlace)}</dd>{/if}
    {#if listing.type === 'service' && listing.availability.length}<dt class="font-medium">When it's offered</dt><dd>{timesText(listing.availability)}</dd>{/if}
    {#if listing.type === 'lend' && listing.takenPeriods.length}
      <dt class="font-medium">Already lent</dt>
      <dd>
        <ul>
          {#each listing.takenPeriods as period (period.startsAt)}<li>{periodText(period.startsAt, period.endsAt)}{period.overdue ? ' (not back yet)' : ''}</li>{/each}
        </ul>
      </dd>
    {/if}
  </dl>

  {#if listing.photos.length}
    <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {#each listing.photos as photo (photo.id)}
        <li><img src="/photos/{photo.key}" alt={photo.alt ?? ''} class="w-full rounded-lg" loading="lazy" /></li>
      {/each}
    </ul>
  {/if}

  {#if listing.description}<p class="max-w-prose whitespace-pre-line">{listing.description}</p>{/if}

  <section class="grid gap-1 rounded-lg border bg-card p-4" aria-labelledby="owner-heading">
    <h2 id="owner-heading" class="font-semibold">Listed by</h2>
    <p><a href="/members/{listing.owner.id}">{listing.owner.displayName}</a> on {since}</p>
    <p class="text-muted-foreground">
      {#if listing.owner.invitedBy}
        Invited by <a href="/members/{listing.owner.invitedBy.id}">{listing.owner.invitedBy.displayName}</a>
      {:else}
        Founding member
      {/if}
    </p>
  </section>

  {#if isOwner}
    <section class="grid gap-4" aria-labelledby="manage-heading">
      <h2 id="manage-heading" class="text-xl font-semibold">Manage your listing</h2>
      <div class="flex flex-wrap gap-3">
        {#if listing.openProposalCount}<Button href="/proposals?role=lister">Proposals ({listing.openProposalCount})</Button>{/if}
        {#if listing.status !== 'closed'}<Button href="/listings/{listing.id}/edit" variant="outline">Edit</Button>{/if}
        {#if listing.status === 'available'}
          <form method="POST" action="?/pause"><Button type="submit" variant="outline">Pause</Button></form>
        {:else if listing.status === 'paused'}
          <form method="POST" action="?/resume"><Button type="submit" variant="outline">Make available again</Button></form>
        {/if}
        {#if listing.status === 'closed' && listing.closedReason === 'removed'}
          <form method="POST" action="?/reopen"><Button type="submit">Reopen</Button></form>
        {/if}
        {#if listing.status !== 'closed' && !form?.confirmRemove}
          <form method="POST" action="?/remove"><Button type="submit" variant="outline">Remove</Button></form>
        {/if}
      </div>
      {#if form?.confirmRemove}
        <form method="POST" action="?/remove" class="grid gap-3 rounded-lg border border-input bg-card p-4">
          <input type="hidden" name="confirmed" value="yes" />
          <p>Remove this listing? People won't find it any more. You can reopen it later.</p>
          <div class="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="destructive">Yes, remove it</Button>
            <a href="/listings/{listing.id}">Keep it</a>
          </div>
        </form>
      {/if}

      <h3 class="text-lg font-semibold">Requests from members</h3>
      {#if listing.flags?.length}
        <ul class="grid gap-3">
          {#each listing.flags as flag (flag.id)}
            <li class="grid gap-1 rounded-lg border bg-card p-4">
              <p class="whitespace-pre-line">{flag.request}</p>
              <p class="text-sm text-muted-foreground">
                From <a href="/members/{flag.from.id}">{flag.from.displayName}</a>
                · {new Date(flag.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                {#if !flag.seen}· <strong>New</strong>{/if}
              </p>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="text-muted-foreground">No requests about this listing.</p>
      {/if}
    </section>
  {:else}
    {#if listing.myOpenProposalId}
      <div><Button href="/proposals/{listing.myOpenProposalId}">See your proposal</Button></div>
    {:else if listing.status === 'available'}
      <div><Button href="/listings/{listing.id}/propose">{askWords[listing.type]}</Button></div>
    {/if}

    <details class="grid gap-1 rounded-lg border bg-card p-4" open={Boolean(form?.fields?.request)}>
      <summary class="min-h-11 cursor-pointer content-center font-medium">Raise a conflict about this posting to the person who listed this</summary>
      <p class="mt-2 text-muted-foreground">
        For example, to ask them to update or take down the listing. It goes only to them, and the
        listing stays as it is.
      </p>
      <form method="POST" action="?/flag" class="mt-3 grid gap-3">
        <FormField label="Your request" name="request" multiline required maxlength={500} value={form?.values?.request} error={form?.fields?.request} />
        <div><Button type="submit" variant="outline">Send request</Button></div>
      </form>
    </details>
  {/if}
</article>
