<script lang="ts">
  import { page } from '$app/state';
  import { Badge } from '#lib/components/ui/badge/index.ts';
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import PopupDialog from '#lib/components/PopupDialog.svelte';
  import { amountLine, handoverQuestion, handoverText, listingStatus, periodText, placeText, quantity, timesText, typeLabels } from '#lib/format.ts';
  import FlagIcon from '@lucide/svelte/icons/flag';

  let { data, form } = $props();
  const listing = $derived(data.listing);
  const isOwner = $derived(data.member?.id === listing.owner.id);
  const created = $derived(page.url.searchParams.has('created'));
  const issueSent = $derived(page.url.searchParams.has('issueSent'));
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
  /** The listing's details as label and value, for the table beside the description. */
  const details = $derived.by(() => {
    const rows: [string, string][] = [];
    const amount = amountLine(listing);
    if (amount) rows.push([{ lend: 'Loan', gift: 'Amount', trade: 'Amount', service: 'Sessions' }[listing.type], amount]);
    if (listing.type === 'trade') {
      rows.push([
        'In return',
        listing.accepts.length
          ? listing.accepts.map((a) => (a.amount ? `${a.description} (${quantity(a.amount, a.unit)})` : a.description)).join('\n')
          : `Open to offers: ${listing.owner.displayName} hasn't listed anything specific`
      ]);
    }
    rows.push([handoverQuestion[listing.type], listing.handovers.length ? listing.handovers.map((h) => handoverText(listing.type, h, names)).join('\n') : 'To be agreed']);
    if (listing.area) rows.push(['Area', placeText(listing.area)!]);
    if (listing.meetingPlace) rows.push(['Meeting place', placeText(listing.meetingPlace)!]);
    if (listing.type === 'service' && listing.availability.length) rows.push(["When it's offered", timesText(listing.availability).replaceAll('; ', '\n')]);
    if (listing.type === 'lend' && listing.takenPeriods.length) {
      rows.push(['Already lent', listing.takenPeriods.map((p) => `${periodText(p.startsAt, p.endsAt)}${p.overdue ? ' (not back yet)' : ''}`).join('\n')]);
    }
    return rows;
  });
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
  {#if issueSent && !form}<Notice><p>{doneText.flag}</p></Notice>{/if}
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
    <p class="text-sm text-muted-foreground">
      Listed by <a href="/members/{listing.owner.id}">{listing.owner.displayName}</a> on {since}
    </p>
  </header>

  <div class="grid gap-6 md:grid-cols-2">
    <div class="grid content-start gap-4">
      <!-- The owner's own words, set apart with large quotation marks (decorative only). -->
      <figure class="relative rounded-lg border bg-card px-8 py-5" aria-label="Description">
        <span class="pointer-events-none absolute top-0 left-2 font-serif text-5xl leading-none text-muted-foreground/40 select-none" aria-hidden="true">“</span>
        {#if listing.description}
          <p class="max-w-prose whitespace-pre-line">{listing.description}</p>
        {:else}
          <p class="text-muted-foreground">No description.</p>
        {/if}
        <span class="pointer-events-none absolute right-2 bottom-0 translate-y-3 font-serif text-5xl leading-none text-muted-foreground/40 select-none" aria-hidden="true">”</span>
      </figure>
      {#if listing.photos.length}
        <ul class="grid grid-cols-2 gap-2">
          {#each listing.photos as photo (photo.id)}
            <li><img src="/photos/{photo.key}" alt={photo.alt ?? ''} class="w-full rounded-lg" loading="lazy" /></li>
          {/each}
        </ul>
      {/if}
    </div>

    <dl class="grid content-start overflow-hidden rounded-lg border text-sm" aria-label="Details">
      {#each details as [label, value] (label)}
        <div class="grid grid-cols-[minmax(7rem,40%)_1fr] gap-3 px-3 py-2.5 even:bg-muted/60">
          <dt class="text-muted-foreground">{label}</dt>
          <dd class="whitespace-pre-line">{value}</dd>
        </div>
      {/each}
    </dl>
  </div>

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
    <div class="flex flex-wrap items-center justify-between gap-3">
      {#if listing.myOpenProposalId}
        <Button href="/proposals/{listing.myOpenProposalId}">See your proposal</Button>
      {:else if listing.status === 'available'}
        <Button href="/listings/{listing.id}/propose">{askWords[listing.type]}</Button>
      {:else}
        <span></span>
      {/if}
      <PopupDialog
        label="Raise an issue"
        icon={FlagIcon}
        variant="ghost"
        title="Raise an issue with {listing.owner.displayName}"
        description="For example, to ask them to update or take down this listing. It goes only to {listing.owner.displayName}, and the listing stays as it is."
        fallbackHref="/listings/{listing.id}/issue"
        open={Boolean(form?.fields?.request)}
      >
          <form method="POST" action="?/flag" class="grid gap-4">
            <FormField label="What would you like to ask?" name="request" multiline required maxlength={500} value={form?.values?.request} error={form?.fields?.request} />
            <div><Button type="submit">Send to {listing.owner.displayName}</Button></div>
          </form>
      </PopupDialog>
    </div>
  {/if}
</article>
