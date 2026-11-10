<script lang="ts">
  import { enhance } from '$app/forms';
  import { reveal, stayPut } from '#lib/stay-put.ts';
  import PhotoGallery from '#lib/components/PhotoGallery.svelte';
  import { page } from '$app/state';
  import { Badge } from '#lib/components/ui/badge/index.ts';
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import InfoNote from '#lib/components/InfoNote.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import PopupDialog from '#lib/components/PopupDialog.svelte';
  import PublicThread from '#lib/components/PublicThread.svelte';
  import {
    amountLine,
    handoverQuestion,
    handoverText,
    offeringStatus,
    periodText,
    placeText,
    quantity,
    timesText,
    typeLabels
  } from '#lib/format.ts';
  import FlagIcon from '@lucide/svelte/icons/flag';

  let { data, form } = $props();
  const offering = $derived(data.offering);
  const isOwner = $derived(data.member?.id === offering.owner.id);
  const created = $derived(page.url.searchParams.has('created'));
  const issueSent = $derived(page.url.searchParams.has('issueSent'));
  const photoProblems = $derived(page.url.searchParams.get('photoProblems'));
  const doneText: Record<string, string> = {
    pause:
      'Your offering is paused. Nobody will find it in search until you make it available again.',
    resume: 'Your offering is available again.',
    remove: 'Your offering is removed. You can reopen it any time from this page.',
    reopen: 'Your offering is available again.',
    flag: 'Your request was sent to the person who listed this.',
    flagMessage: 'Your request was sent to the person who wrote it.'
  };
  // "Raise an issue" closes once sent; a problem with the text opens it again.
  let raising = $state(false);
  $effect(() => {
    if (form?.fields?.request) raising = true;
  });
  const notLinked = $derived(page.url.searchParams.has('notLinked'));
  // Proposals from the asker of a linked request start from that request (003 FR-017).
  const proposeHref = $derived.by(() => {
    const mine = offering.myOpenRequestsLinked ?? [];
    const chosen = mine.length === 1 ? mine[0]!.id : page.url.searchParams.get('request');
    return `/offerings/${offering.id}/propose${chosen && mine.some((r) => r.id === chosen) ? `?request=${chosen}` : ''}`;
  });
  const askWords = {
    lend: 'Ask to borrow',
    gift: 'Ask for this',
    trade: 'Offer a trade',
    service: 'Ask for this service'
  } as const;
  const names = $derived({
    lister: isOwner ? 'me' : offering.owner.displayName,
    requester: isOwner ? 'the recipient' : 'you'
  });
  /** The offering's details as label and value, for the table beside the description. */
  const details = $derived.by(() => {
    const rows: [string, string][] = [];
    const amount = amountLine(offering);
    if (amount)
      rows.push([
        { lend: 'Loan', gift: 'Amount', trade: 'Amount', service: 'Sessions' }[offering.type],
        amount
      ]);
    if (offering.type === 'trade') {
      rows.push([
        'In return',
        offering.accepts.length
          ? offering.accepts
              .map((a) =>
                a.amount ? `${a.description} (${quantity(a.amount, a.unit)})` : a.description
              )
              .join('\n')
          : `Open to offers: ${offering.owner.displayName} hasn't listed anything specific`
      ]);
    }
    rows.push([
      handoverQuestion[offering.type],
      offering.handovers.length
        ? offering.handovers.map((h) => handoverText(offering.type, h, names)).join('\n')
        : 'To be agreed'
    ]);
    if (offering.area) rows.push(['Area', placeText(offering.area)!]);
    if (offering.meetingPlace) rows.push(['Meeting place', placeText(offering.meetingPlace)!]);
    if (offering.type === 'service' && offering.availability.length)
      rows.push(["When it's offered", timesText(offering.availability).replaceAll('; ', '\n')]);
    if (offering.type === 'lend' && offering.takenPeriods.length) {
      rows.push([
        'Already lent',
        offering.takenPeriods
          .map((p) => `${periodText(p.startsAt, p.endsAt)}${p.overdue ? ' (not back yet)' : ''}`)
          .join('\n')
      ]);
    }
    return rows;
  });
  const since = $derived(
    new Date(offering.createdAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  );
</script>

{#snippet actionResult()}
  <!-- Results of this page's own actions show under its buttons; the public thread shows its own. -->
  {#if form?.done && form.done !== 'flagMessage' && doneText[form.done]}
    <Notice><p>{doneText[form.done]}</p></Notice>
  {:else if form?.error && form?.values?.body === undefined && form?.done === undefined}
    <Notice kind="error"><p>{form.error}</p></Notice>
  {:else if issueSent && !form}
    <Notice><p>{doneText.flag}</p></Notice>
  {/if}
{/snippet}

<svelte:head><title>{offering.title} · wunan</title></svelte:head>

<article class="grid gap-6">
  {#if created}
    <Notice><p>Your offering is published.</p></Notice>
  {/if}
  {#if notLinked}
    <InfoNote
      >The request was closed, so this offering wasn't linked to it. Your offering is up as usual.</InfoNote
    >
  {/if}
  {#if photoProblems}
    <Notice kind="error"
      ><p>Some photos couldn't be added. {photoProblems} You can try again from Edit.</p></Notice
    >
  {/if}

  <header class="grid gap-2">
    <div class="flex flex-wrap gap-2">
      <Badge>{typeLabels[offering.type]}</Badge>
      <Badge variant="outline">{offeringStatus(offering)}</Badge>
    </div>
    <h1 class="text-3xl font-semibold">{offering.title}</h1>
    <p class="text-sm text-muted-foreground">
      Listed by <a href="/members/{offering.owner.id}">{offering.owner.displayName}</a> on {since}
    </p>
    {#each offering.answers ?? [] as answer (answer.requestId)}
      <p class="text-sm text-muted-foreground">
        For {answer.asker.displayName}'s request
        <a href="/requests/{answer.requestId}">{answer.title}</a>
      </p>
    {/each}
  </header>

  <!-- Wide screens: the offering and what you can do with it on the left, the messages about it on the right. -->
  <div class="page-columns">
    <div class="grid gap-6">
      <div class="grid gap-6">
        <div class="grid content-start gap-4">
          <!-- The owner's own words, set apart with large quotation marks (decorative only). -->
          <figure class="relative surface px-8 py-5" aria-label="Description">
            <span
              class="pointer-events-none absolute top-0 left-2 font-serif text-5xl leading-none text-muted-foreground/40 select-none"
              aria-hidden="true">“</span
            >
            {#if offering.description}
              <p class="max-w-prose whitespace-pre-line">{offering.description}</p>
            {:else}
              <p class="text-muted-foreground">No description.</p>
            {/if}
            <span
              class="pointer-events-none absolute right-2 bottom-0 translate-y-3 font-serif text-5xl leading-none text-muted-foreground/40 select-none"
              aria-hidden="true">”</span
            >
          </figure>
          {#if offering.photos.length}
            <PhotoGallery photos={offering.photos} />
          {/if}
        </div>

        <dl class="grid content-start overflow-hidden surface" aria-label="Details">
          {#each details as [label, value] (label)}
            <div
              class="grid grid-cols-[minmax(7rem,40%)_1fr] gap-3 border-b px-5 py-3 last:border-b-0"
            >
              <dt class="text-muted-foreground">{label}</dt>
              <dd class="whitespace-pre-line">{value}</dd>
            </div>
          {/each}
        </dl>
      </div>

      {#if isOwner}
        <section id="actions" class="grid gap-4" aria-labelledby="manage-heading">
          <h2 id="manage-heading" class="text-xl font-semibold">Manage your offering</h2>
          <div class="flex flex-wrap gap-3">
            {#if offering.openProposalCount}<Button href="/proposals?role=lister"
                >Proposals ({offering.openProposalCount})</Button
              >{/if}
            {#if offering.status !== 'closed'}<Button
                href="/offerings/{offering.id}/edit"
                variant="outline">Edit</Button
              >{/if}
            {#if offering.status === 'available'}
              <form method="POST" action="?/pause#actions" use:enhance={stayPut()}>
                <Button type="submit" variant="outline">Pause</Button>
              </form>
            {:else if offering.status === 'paused'}
              <form method="POST" action="?/resume#actions" use:enhance={stayPut()}>
                <Button type="submit" variant="outline">Make available again</Button>
              </form>
            {/if}
            {#if offering.status === 'closed' && offering.closedReason === 'removed'}
              <form method="POST" action="?/reopen#actions" use:enhance={stayPut()}>
                <Button type="submit">Reopen</Button>
              </form>
            {/if}
            {#if offering.status !== 'closed' && !form?.confirmRemove}
              <form method="POST" action="?/remove#actions" use:enhance={stayPut()}>
                <Button type="submit" variant="outline">Remove</Button>
              </form>
            {/if}
          </div>
          {#if form?.confirmRemove}
            <form
              method="POST"
              action="?/remove#actions"
              class="grid gap-3 surface p-4"
              use:enhance={stayPut()}
              use:reveal
            >
              <input type="hidden" name="confirmed" value="yes" />
              <p>Remove this offering? People won't find it any more. You can reopen it later.</p>
              <div class="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="destructive">Yes, remove it</Button>
                <a href="/offerings/{offering.id}#actions" data-sveltekit-reset="false">Keep it</a>
              </div>
            </form>
          {/if}
          {@render actionResult()}

          <h3 class="text-lg font-semibold">Requests from members</h3>
          {#if offering.flags?.length}
            <ul class="grid gap-3">
              {#each offering.flags as flag (flag.id)}
                <li class="grid gap-1 surface p-4">
                  <p class="whitespace-pre-line">{flag.request}</p>
                  <p class="text-sm text-muted-foreground">
                    From <a href="/members/{flag.from.id}">{flag.from.displayName}</a>
                    · {new Date(flag.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long'
                    })}
                    {#if !flag.seen}· <strong>New</strong>{/if}
                  </p>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="text-muted-foreground">No requests about this offering.</p>
          {/if}
        </section>
      {:else}
        <div id="actions" class="grid gap-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            {#if offering.myOpenProposalId}
              <Button href="/proposals/{offering.myOpenProposalId}">See your proposal</Button>
            {:else if offering.status === 'available'}
              <Button href={proposeHref}>{askWords[offering.type]}</Button>
            {:else}
              <span></span>
            {/if}
            <PopupDialog
              label="Raise an issue"
              icon={FlagIcon}
              variant="ghost"
              title="Raise an issue with {offering.owner.displayName}"
              description="For example, to ask them to update or take down this offering. It goes only to {offering
                .owner.displayName}, and the offering stays as it is."
              fallbackHref="/offerings/{offering.id}/issue"
              bind:open={raising}
            >
              <form
                method="POST"
                action="?/flag#actions"
                class="grid gap-4"
                use:enhance={stayPut(() => (raising = false))}
              >
                <FormField
                  label="What would you like to ask?"
                  name="request"
                  multiline
                  required
                  maxlength={500}
                  value={form?.values?.request}
                  error={form?.fields?.request}
                />
                <div><Button type="submit">Send to {offering.owner.displayName}</Button></div>
              </form>
            </PopupDialog>
          </div>
          {@render actionResult()}
        </div>
      {/if}
    </div>

    <PublicThread
      thread={data.thread}
      liveUrl="/offerings/{offering.id}/messages/live"
      closedText="This offering is closed, so no new messages can be posted."
      {form}
    />
  </div>
</article>
