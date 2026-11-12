<!--
  An arrangement's details as a short list. While it's being arranged, each empty one is marked
  "Not decided yet", followed by what still stops it from being accepted, in plain words (002
  FR-017, FR-023). Once agreed the same list is the fixed record, headed "What was agreed", with
  the place in full and, for a loan, when it's due back (004 FR-015).
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
  import type { Arrangement } from '@wunan/shared';

  let { arrangement }: { arrangement: Arrangement } = $props();
  const proposal = $derived(arrangement);
  const agreed = $derived(arrangement.agreed);
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
    agreed?.offer
      ? [...agreed.offer.items, ...(agreed.offer.own ? [agreed.offer.own] : [])]
          .map((o) =>
            o.amount ? `${o.description} (${quantity(o.amount, o.unit)})` : o.description
          )
          .join(', ')
      : d.offers.length
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
    if (d.handover !== 'online')
      list.push(['Where', placeText(agreed?.place ?? d.place) ?? notYet]);
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
    if (agreed?.loanStartsAt && agreed.loanEndsAt)
      list.push(['Loan', `${when(agreed.loanStartsAt)} to ${when(agreed.loanEndsAt)}`]);
    // What was never filled in isn't part of what was agreed.
    return agreed ? list.filter(([, value]) => value !== notYet) : list;
  });
</script>

{#if agreed}<h2 id="details-heading" class="text-lg font-semibold">What was agreed</h2>{/if}
<dl
  class="grid gap-x-4 gap-y-3 surface p-5 sm:grid-cols-[10rem_1fr]"
  aria-labelledby={agreed ? 'details-heading' : undefined}
  aria-label={agreed ? undefined : 'Details'}
>
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
  <section class="grid gap-1.5 rounded-xl bg-muted p-5" aria-labelledby="issues-heading">
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
