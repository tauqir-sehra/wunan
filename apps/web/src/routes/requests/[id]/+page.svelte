<script lang="ts">
  import { page } from '$app/state';
  import FormField from '#lib/components/FormField.svelte';
  import HelpChoices from '#lib/components/HelpChoices.svelte';
  import HelpLink from '#lib/components/HelpLink.svelte';
  import InfoNote from '#lib/components/InfoNote.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import PopupDialog from '#lib/components/PopupDialog.svelte';
  import PublicThread from '#lib/components/PublicThread.svelte';
  import { Badge } from '#lib/components/ui/badge/index.ts';
  import { Button } from '#lib/components/ui/button/index.ts';
  import {
    duration,
    handoverQuestion,
    handoverText,
    kindLabels,
    neededText,
    placeText,
    quantity,
    timesText,
    typeLabels
  } from '#lib/format.ts';
  import { offeringTypeFor } from '@wunan/shared';
  import FlagIcon from '@lucide/svelte/icons/flag';

  let { data, form } = $props();
  const request = $derived(data.request);
  const isAsker = $derived(data.member?.id === request.asker.id);
  const type = $derived(offeringTypeFor[request.kind]);
  const doneText: Record<string, string> = {
    close: 'Your request is closed. You can reopen it any time from this page.',
    reopen: 'Your request is open again.',
    link: 'Your offering now shows on this request.',
    unlink: 'It no longer shows on this request. The offering itself is unchanged.',
    flag: 'Your request was sent to the person who asked.',
    flagMessage: 'Your request was sent to the person who wrote it.'
  };
  const askWords = {
    lend: 'Ask to borrow',
    gift: 'Ask for this',
    trade: 'Offer a trade',
    service: 'Ask for this service'
  } as const;
  const names = $derived({
    lister: 'the person helping',
    requester: isAsker ? 'me' : request.asker.displayName
  });
  const notice = $derived(
    page.url.searchParams.has('posted')
      ? 'Your request is posted. Others can now offer something for it.'
      : page.url.searchParams.has('saved')
        ? 'Your changes are saved.'
        : page.url.searchParams.has('linked')
          ? 'Your offering now shows on this request.'
          : null
  );

  const details = $derived.by(() => {
    const rows: [string, string][] = [
      ["When it's needed", neededText(request.neededAfter, request.neededBy)]
    ];
    if (request.area) rows.push(['Area', placeText(request.area)!]);
    rows.push([
      handoverQuestion[type],
      request.handovers.length
        ? request.handovers.map((h) => handoverText(type, h, names)).join('\n')
        : 'To be agreed'
    ]);
    if (request.kind === 'borrow')
      rows.push([
        'How long',
        request.loanLength && request.loanLengthUnit
          ? duration(request.loanLength, request.loanLengthUnit)
          : 'To be agreed'
      ]);
    if ((request.kind === 'receive' || request.kind === 'trade') && request.amount)
      rows.push(['How much', quantity(request.amount, request.unit)]);
    if (request.kind === 'trade') {
      rows.push([
        'Could give back',
        request.giveBack.length
          ? request.giveBack
              .map((g) =>
                g.amount ? `${g.description} (${quantity(g.amount, g.unit)})` : g.description
              )
              .join('\n')
          : 'Open to talking about it'
      ]);
    }
    if (request.kind === 'service') {
      if (request.sessionLength && request.sessionLengthUnit)
        rows.push(['Each time', duration(request.sessionLength, request.sessionLengthUnit)]);
      if (request.sessions) rows.push(['How many times', String(request.sessions)]);
      if (request.availability.length)
        rows.push(['Times that suit', timesText(request.availability).replaceAll('; ', '\n')]);
    }
    return rows;
  });
  const since = $derived(
    new Date(request.createdAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  );
  const closedText = $derived(
    request.closedReason === 'agreed'
      ? 'Closed: settled by an agreement'
      : isAsker
        ? 'Closed by you'
        : `Closed by ${request.asker.displayName}`
  );
</script>

<svelte:head><title>{request.title} · wunan</title></svelte:head>

<article class="grid gap-6">
  <!-- The public thread shows its own confirmations and problems, next to the message box. -->
  {#if form?.done && doneText[form.done]}
    <Notice><p>{doneText[form.done]}</p></Notice>
  {:else if form?.error && form?.values?.body === undefined}
    <Notice kind="error"><p>{form.error}</p></Notice>
  {:else if notice}
    <Notice><p>{notice}</p></Notice>
  {/if}

  <header class="grid gap-2">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex flex-wrap gap-2">
        <Badge>{kindLabels[request.kind]}</Badge>
        <Badge variant="outline">{request.status === 'open' ? 'Open' : closedText}</Badge>
      </div>
      <HelpLink topic="requests" label="Help with requests" />
    </div>
    <h1 class="text-3xl font-semibold">{request.title}</h1>
    <p class="text-sm text-muted-foreground">
      Asked by <a href="/members/{request.asker.id}">{request.asker.displayName}</a> on {since}
    </p>
  </header>

  {#if request.datePassed}
    <InfoNote
      >The “Needed by” date has passed. You can change it, or close the request if you don't need it
      any more.</InfoNote
    >
  {/if}
  {#if request.myOtherOpenProposals?.length}
    <section
      class="grid gap-1 rounded-lg border border-dashed p-4"
      aria-labelledby="other-proposals-heading"
    >
      <h2 id="other-proposals-heading" class="font-semibold">
        You still have these proposals open:
      </h2>
      <ul class="list-disc pl-5">
        {#each request.myOtherOpenProposals as other (other.id)}
          <li><a href="/proposals/{other.id}">{other.offeringTitle}</a></li>
        {/each}
      </ul>
      <p class="text-sm text-muted-foreground">
        You can withdraw any you don't need from its page.
      </p>
    </section>
  {/if}
  {#if isAsker && request.closedByAgreementId}
    <p><a href="/agreements/{request.closedByAgreementId}">See the agreement</a></p>
  {/if}

  <div class="grid gap-6 md:grid-cols-2">
    <figure
      class="relative content-start rounded-lg border bg-card px-8 py-5"
      aria-label="Description"
    >
      <span
        class="pointer-events-none absolute top-0 left-2 font-serif text-5xl leading-none text-muted-foreground/40 select-none"
        aria-hidden="true">“</span
      >
      {#if request.description}
        <p class="max-w-prose whitespace-pre-line">{request.description}</p>
      {:else}
        <p class="text-muted-foreground">No description.</p>
      {/if}
      <span
        class="pointer-events-none absolute right-2 bottom-0 translate-y-3 font-serif text-5xl leading-none text-muted-foreground/40 select-none"
        aria-hidden="true">”</span
      >
    </figure>
    <dl class="grid content-start overflow-hidden rounded-lg border text-sm" aria-label="Details">
      {#each details as [label, value] (label)}
        <div class="grid grid-cols-[minmax(7rem,40%)_1fr] gap-3 px-3 py-2.5 even:bg-muted/60">
          <dt class="text-muted-foreground">{label}</dt>
          <dd class="whitespace-pre-line">{value}</dd>
        </div>
      {/each}
    </dl>
  </div>

  <!-- One filled button per page: "Edit request" for the asker, "I can help with this" for others. -->
  {#if isAsker}
    <div class="flex flex-wrap gap-3">
      {#if request.canEdit}<Button href="/requests/{request.id}/edit">Edit request</Button>{/if}
      {#if request.status === 'open' && !form?.confirmClose}
        <form method="POST" action="?/close">
          <Button type="submit" variant="outline">Close request</Button>
        </form>
      {:else if request.status === 'closed'}
        <form method="POST" action="?/reopen">
          <Button type="submit" variant="outline">Reopen</Button>
        </form>
      {/if}
    </div>
    {#if form?.confirmClose}
      <form
        method="POST"
        action="?/close"
        class="grid gap-3 rounded-lg border border-input bg-card p-4"
      >
        <input type="hidden" name="confirmed" value="yes" />
        <p>
          Close this request? People won't see it among open requests. What was offered for it stays
          up. You can reopen it later.
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="destructive">Yes, close it</Button>
          <a href="/requests/{request.id}">Keep it open</a>
        </div>
      </form>
    {/if}
  {:else if request.canAnswer}
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-3">
        <PopupDialog
          label="I can help with this"
          variant="default"
          size="default"
          title="How would you like to help?"
          description="Either way, your offering shows on {request.asker
            .displayName}'s request so they can propose on it."
          fallbackHref="/requests/{request.id}/help"
        >
          <HelpChoices
            requestId={request.id}
            askerName={request.asker.displayName}
            {type}
            offerings={data.myOfferings}
            action="?/link"
          />
        </PopupDialog>
      </div>
      <PopupDialog
        label="Raise an issue"
        icon={FlagIcon}
        variant="ghost"
        title="Raise an issue with {request.asker.displayName}"
        description="For example, to ask them to change or close this request. It goes only to {request
          .asker.displayName}, and the request stays as it is."
        fallbackHref="/requests/{request.id}/issue"
        open={Boolean(form?.fields?.request)}
      >
        <form method="POST" action="?/flag" class="grid gap-4">
          <FormField
            label="What would you like to ask?"
            name="request"
            multiline
            required
            maxlength={500}
            value={form?.values?.request}
            error={form?.fields?.request}
          />
          <div><Button type="submit">Send to {request.asker.displayName}</Button></div>
        </form>
      </PopupDialog>
    </div>
  {/if}

  <section class="grid gap-3" aria-labelledby="offered-heading">
    <h2 id="offered-heading" class="text-xl font-semibold">Offered for this request</h2>
    {#if request.links.length}
      <ul class="grid gap-3">
        {#each request.links as link (link.id)}
          <li
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4"
          >
            <div class="grid gap-0.5">
              <a
                href="/offerings/{link.offering.id}{isAsker && request.status === 'open'
                  ? `?request=${request.id}`
                  : ''}"
                class="font-medium">{link.offering.title}</a
              >
              <span class="text-sm text-muted-foreground">
                {typeLabels[link.offering.type]} · {link.offering.owner
                  .displayName}{#if !link.available}
                  · No longer available{/if}
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              {#if isAsker && request.status === 'open' && link.available}
                <Button
                  href="/offerings/{link.offering.id}/propose?request={request.id}"
                  variant="outline"
                  size="sm">{askWords[link.offering.type]}</Button
                >
              {/if}
              {#if link.canRemove}
                <form method="POST" action="?/unlink">
                  <input type="hidden" name="linkId" value={link.id} /><Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    >{link.offering.owner.id === data.member?.id ? 'Withdraw this offer' : 'Not for my request'}</Button
                  >
                </form>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-muted-foreground">Nothing offered yet.</p>
    {/if}
  </section>

  <PublicThread
    thread={data.thread}
    liveUrl="/requests/{request.id}/messages/live"
    closedText="This request is closed, so no new messages can be posted."
    {form}
  />

  {#if isAsker && request.flags?.length}
    <section class="grid gap-3" aria-labelledby="flags-heading">
      <h2 id="flags-heading" class="text-lg font-semibold">Requests from members</h2>
      <ul class="grid gap-3">
        {#each request.flags as flag (flag.id)}
          <li class="grid gap-1 rounded-lg border bg-card p-4">
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
    </section>
  {/if}
</article>
