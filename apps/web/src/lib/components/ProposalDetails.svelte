<!--
  A proposal's current details as a short list, each empty one marked "Not decided yet", followed
  by what still stops it from being accepted, in plain words (002 FR-017, FR-023).
-->
<script lang="ts">
  import InfoNote from '#lib/components/InfoNote.svelte';
  import {
    duration,
    handoverText,
    placeText,
    quantity,
    timeOfDay,
    unitLabel,
    when
  } from '#lib/format.ts';
  import type { Proposal } from '@wunan/shared';

  let { proposal }: { proposal: Proposal } = $props();
  const d = $derived(proposal.details);
  const type = $derived(proposal.offering.type);
  const names = $derived({
    lister: proposal.myRole === 'lister' ? 'you' : proposal.lister.displayName,
    requester: proposal.myRole === 'requester' ? 'you' : proposal.requester.displayName
  });
  const notYet = 'Not decided yet';
  const whenText = $derived(
    d.startsAt
      ? new Date(d.startsAt).toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        }) + (d.hasTime ? `, ${timeOfDay(d.startsAt)}` : '')
      : notYet
  );
  const offerText = $derived(
    d.offers.length
      ? d.offers
          .map((o) =>
            o.amount ? `${o.description} (${quantity(o.amount, o.unit)})` : o.description
          )
          .join(', ')
      : d.ownOffer
        ? `${d.ownOffer}${d.ownOfferAmount ? ` (${d.ownOfferAmount} ${d.ownOfferUnit ? unitLabel(d.ownOfferUnit) : ''})` : ''}`
        : notYet
  );
  const rows = $derived.by(() => {
    const list: [string, string][] = [
      ['When', whenText],
      ['How', d.handover ? handoverText(type, d.handover, names) : notYet]
    ];
    if (d.handover !== 'online') list.push(['Where', placeText(d.place) ?? notYet]);
    if (type === 'lend')
      list.push([
        'For how long',
        d.loanLength && d.loanLengthUnit ? duration(d.loanLength, d.loanLengthUnit) : notYet
      ]);
    if (type === 'gift' || type === 'trade')
      if (d.amount || proposal.offering.unit)
        list.push(['How much', d.amount ? quantity(d.amount, proposal.offering.unit) : notYet]);
    if (type === 'trade') list.push(['In return', offerText]);
    if (type === 'service') {
      list.push([
        'Each time',
        d.sessionLength && d.sessionLengthUnit
          ? duration(d.sessionLength, d.sessionLengthUnit)
          : notYet
      ]);
      list.push(['How many times', d.sessions ? String(d.sessions) : notYet]);
    }
    return list;
  });
</script>

<dl class="grid gap-2 rounded-lg border bg-card p-4 sm:grid-cols-[10rem_1fr]">
  {#each rows as [label, value] (label)}
    <dt class="font-medium">{label}</dt>
    <dd class={value === notYet ? 'text-muted-foreground' : ''}>{value}</dd>
  {/each}
</dl>
{#if proposal.request}
  <p>
    For {proposal.myRole === 'requester' ? 'your' : `${proposal.requester.displayName}'s`} request:
    <a href="/requests/{proposal.request.id}">{proposal.request.title}</a
    >{#if proposal.request.status === 'open' && proposal.status === 'open'}. Accepting this closes
      the request.{/if}
  </p>
{/if}
{#if proposal.earlierLoanNotBack}
  <InfoNote
    >The previous loan of this item hasn't been marked returned yet (it was due back {when(
      proposal.earlierLoanNotBack.endsAt
    )}). It may be worth checking with each other before the pickup.</InfoNote
  >
{/if}
{#if proposal.areaUnchecked}
  <InfoNote
    >wunan couldn't check this place against the offering's area, because it was typed rather than
    picked from the suggestions.</InfoNote
  >
{/if}
{#if proposal.status === 'open' && proposal.issues.length}
  <section class="grid gap-1 rounded-lg border border-dashed p-4" aria-labelledby="issues-heading">
    <h2 id="issues-heading" class="font-semibold">
      {proposal.myRole === 'requester'
        ? 'Still to settle before it can be accepted'
        : `Still to settle before you can accept`}
    </h2>
    <ul class="list-disc pl-5">
      {#each proposal.issues as issue (issue.field + issue.message)}<li>{issue.message}</li>{/each}
    </ul>
  </section>
{/if}
