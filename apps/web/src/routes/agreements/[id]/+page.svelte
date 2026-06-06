<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import Notice from '#lib/components/Notice.svelte';
  import { agreementSentence, duration, handoverText, placeText, quantity, when } from '#lib/format.ts';

  let { data, form } = $props();
  const a = $derived(data.agreement);
  const other = $derived(a.myRole === 'owner' ? a.otherMember : a.owner);
  const names = $derived({
    lister: a.myRole === 'owner' ? 'you' : a.owner.displayName,
    requester: a.myRole === 'other' ? 'you' : a.otherMember.displayName
  });
  const offer = $derived(
    a.offer
      ? [...a.offer.items, ...(a.offer.own ? [a.offer.own] : [])].map((o) => (o.amount ? `${o.description} (${quantity(o.amount, o.unit)})` : o.description)).join(', ')
      : null
  );
  const fullDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
</script>

<svelte:head><title>Agreement · wunan</title></svelte:head>

<section class="grid max-w-2xl gap-6">
  {#if form?.done === 'returned'}<Notice><p>Marked as returned. Those dates are free again.</p></Notice>{/if}
  {#if form?.error}<Notice kind="error"><p>{form.error}</p></Notice>{/if}

  <header class="grid gap-2">
    <div class="flex items-start justify-between gap-3">
      <h1 class="text-2xl font-semibold">Agreement</h1>
      <HelpLink topic="agreements" label="Help with agreements" />
    </div>
    <p class="text-lg">{agreementSentence(a)}</p>
    <p class="text-muted-foreground">Agreed on {fullDay(a.createdAt)}</p>
    <p>
      <a href="/listings/{a.listing.id}">{a.listing.title}</a> · with
      <a href="/members/{other.id}">{other.displayName}</a>
      {#if a.myRole !== 'mediator'} · <a href="/proposals/{a.proposalId}">Messages about it</a>{/if}
    </p>
  </header>

  <dl class="grid gap-2 rounded-lg border bg-card p-4 sm:grid-cols-[10rem_1fr]">
    {#if a.startsAt}<dt class="font-medium">When</dt><dd>{a.hasTime ? when(a.startsAt) : new Date(a.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })}</dd>{/if}
    {#if a.handover}<dt class="font-medium">How</dt><dd>{handoverText(a.listing.type, a.handover, names)}</dd>{/if}
    {#if a.place}<dt class="font-medium">Where</dt><dd>{placeText(a.place)}</dd>{/if}
    {#if a.amount}<dt class="font-medium">How much</dt><dd>{quantity(a.amount, a.listing.unit)}</dd>{/if}
    {#if offer}<dt class="font-medium">In return</dt><dd>{offer}</dd>{/if}
    {#if a.sessionLength && a.sessionLengthUnit}<dt class="font-medium">Each time</dt><dd>{duration(a.sessionLength, a.sessionLengthUnit)}</dd>{/if}
    {#if a.sessions}<dt class="font-medium">How many times</dt><dd>{a.sessions}</dd>{/if}
    {#if a.loanStartsAt && a.loanEndsAt}<dt class="font-medium">Loan</dt><dd>{when(a.loanStartsAt)} to {when(a.loanEndsAt)}</dd>{/if}
  </dl>

  {#if a.outcome === 'lent'}
    <p>
      {#if a.returnedAt}Returned on {fullDay(a.returnedAt)}.
      {:else if a.overdue}It was due back {when(a.loanEndsAt ?? a.createdAt)}. No rush: talk it over, and the owner can mark it returned when it's back.
      {/if}
    </p>
    {#if a.myRole === 'owner' && !a.returnedAt}
      <form method="POST" action="?/returned"><Button type="submit">Mark returned</Button></form>
    {/if}
  {/if}

  {#if a.reports?.length}
    <section class="grid gap-2" aria-labelledby="help-heading">
      <h2 id="help-heading" class="text-lg font-semibold">Asking for help</h2>
      <ul class="grid gap-2">
        {#each a.reports as report (report.id)}
          <li>
            <a href="/reports/{report.id}"
              >{report.status === 'open' ? 'Open request for help' : 'Settled'}</a
            >
            {#if report.outcomeNote}<span class="text-muted-foreground">
                — {report.outcomeNote}</span
              >{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if a.myRole !== 'mediator' && !a.reports?.some((r) => r.status === 'open')}
    <p class="text-muted-foreground">
      Something went wrong? <a href="/agreements/{a.id}/report">Ask for help</a> from the invite chain.
    </p>
  {/if}

  <p><a href="/agreements">All agreements</a></p>
</section>
