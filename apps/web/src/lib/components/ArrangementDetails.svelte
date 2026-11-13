<!--
  An arrangement's details as a short list. While it's being arranged, each empty one is marked
  "Not decided yet", followed by what still stops it from being accepted, in plain words (002
  FR-017, FR-023). Once agreed the same list is the fixed record, headed "What was agreed", with
  the place in full and, for a loan, when it's due back (004 FR-015).
  The requester adds or changes each detail in its own row (006): the row's "Add when" / "Change
  when" link opens just that field there (`?detail=when`, which also works without JavaScript),
  and saving keeps the page where it was. A place at the lister's says who picked it. If it ends
  while a field is open, what was typed stays, greyed out, with why it wasn't saved.
-->
<script lang="ts">
  import { page } from '$app/state';
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import ArrangementFields from '#lib/components/ArrangementFields.svelte';
  import InfoNote from '#lib/components/InfoNote.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import {
    detailValues,
    isDetailKey,
    pressableDetails,
    type DetailKey
  } from '#lib/arrangement-form.ts';
  import { stayPut } from '#lib/stay-put.ts';
  import {
    duration,
    handoverText,
    placeText,
    quantity,
    timeOfDay,
    unitLabel,
    when
  } from '#lib/format.ts';
  import type { Arrangement, Offering } from '@wunan/shared';
  import { tick } from 'svelte';

  type DetailForm = {
    error?: string;
    fields?: Record<string, string>;
    values?: Record<string, string>;
    offering?: Offering;
  } | null;

  let {
    arrangement,
    offering = null,
    form = null
  }: {
    arrangement: Arrangement;
    /** The offering, loaded while a field is open (for its choices). */
    offering?: Offering | null;
    /** This page's last form result; only a `detail` one is shown here. */
    form?: DetailForm;
  } = $props();
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
  type Row = { key: DetailKey | null; label: string; value: string; note?: string };
  const rows = $derived.by(() => {
    const list: Row[] = [
      { key: 'when', label: 'When', value: whenText },
      {
        key: 'how',
        label: 'How',
        value: d.handover ? handoverText(type, d.handover, names) : notYet
      }
    ];
    if (d.handover !== 'online')
      list.push({
        key: 'where',
        label: 'Where',
        value: placeText(agreed?.place ?? d.place) ?? notYet,
        // The lister's own place isn't the requester's to choose (006 FR-009a).
        note:
          d.handover === 'at_lister' && !agreed
            ? `Picked by ${proposal.myRole === 'lister' ? 'you' : proposal.lister.displayName}`
            : undefined
      });
    if (type === 'lend')
      list.push({
        key: 'length',
        label: 'For how long',
        value: d.loanLength && d.loanLengthUnit ? duration(d.loanLength, d.loanLengthUnit) : notYet
      });
    if (type === 'gift' || type === 'trade')
      // Only when there's an amount, or one is asked for: the same rule as pressableDetails, so
      // the requester never sees an empty row they can't fill in.
      if (d.amount || proposal.issues.some((i) => i.field === 'amount'))
        list.push({
          key: 'amount',
          label: 'How much',
          value: d.amount ? quantity(d.amount, proposal.offering.unit) : notYet
        });
    if (type === 'trade') list.push({ key: 'return', label: 'In return', value: offerText });
    if (type === 'service') {
      list.push({
        key: 'session',
        label: 'Each time',
        value:
          d.sessionLength && d.sessionLengthUnit
            ? duration(d.sessionLength, d.sessionLengthUnit)
            : notYet
      });
      list.push({
        key: 'sessions',
        label: 'How many times',
        value: d.sessions ? String(d.sessions) : notYet
      });
    }
    if (agreed?.loanStartsAt && agreed.loanEndsAt)
      list.push({
        key: null,
        label: 'Loan',
        value: `${when(agreed.loanStartsAt)} to ${when(agreed.loanEndsAt)}`
      });
    // What was never filled in isn't part of what was agreed.
    return agreed ? list.filter((row) => row.value !== notYet) : list;
  });

  // Which rows this member can open, and which one is open: from the address, or from a save that
  // came back with a problem (without JavaScript the address is the form's).
  const pressable = $derived(pressableDetails(arrangement));
  const canOpen = (key: DetailKey | null): key is DetailKey =>
    key !== null && pressable.includes(key);
  const open = $derived.by((): DetailKey | null => {
    const asked = page.url.searchParams.get('detail') ?? form?.values?.detail;
    return isDetailKey(asked) && canOpen(asked) ? asked : null;
  });
  // A save that came back after the arrangement ended (or someone else changed it so this row no
  // longer applies): the row keeps what was typed, greyed out, with why it wasn't saved.
  const refused = $derived.by((): DetailKey | null => {
    const tried = form?.values?.detail;
    return form?.error && isDetailKey(tried) && !canOpen(tried) ? tried : null;
  });
  // What's typed in the open field, kept so that if the page updates by itself to show the
  // arrangement ended meanwhile, the typing isn't lost (it's shown greyed out, as above).
  let draft = $state<{
    key: DetailKey;
    values: Record<string, string>;
    offering: Offering;
  } | null>(null);
  const ended = $derived.by((): DetailKey | null =>
    draft && !arrangement.canEdit && !refused && page.url.searchParams.get('detail') === draft.key
      ? draft.key
      : null
  );
  // Once its field closes (saved or cancelled) or another opens, the kept typing is dropped, so an
  // arrangement ending later never shows old values as not saved. Ending keeps the address, so
  // the typing stays for that.
  $effect(() => {
    const asked = page.url.searchParams.get('detail');
    if (draft && asked !== draft.key) draft = null;
  });
  const fieldOffering = $derived(offering ?? form?.offering ?? null);

  /** Keeps a copy of the open field's values as they're typed. */
  function keepDraft(key: DetailKey, event: Event) {
    const formElement = event.currentTarget as HTMLFormElement;
    if (!fieldOffering) return;
    const values: Record<string, string> = {};
    for (const [name, value] of new FormData(formElement))
      if (typeof value === 'string') values[name] = value;
    draft = { key, values, offering: fieldOffering };
  }
  const fieldValues = $derived(
    form?.values?.detail === open && form?.values ? form.values : detailValues(arrangement)
  );

  /** The page's address with `detail` set to `key`, or taken out. */
  function addressFor(key: DetailKey | null, hash: string) {
    const url = new URL(page.url.href);
    url.searchParams.delete('detail');
    if (key) url.searchParams.set('detail', key);
    return `${url.pathname}${url.search}#${hash}`;
  }

  // When a field closes (saved or cancelled), focus goes back to its row's link.
  let lastOpen: DetailKey | null = null;
  $effect(() => {
    const now = open;
    if (lastOpen && !now) {
      const key = lastOpen;
      void tick().then(() => document.getElementById(`detail-${key}`)?.focus());
    }
    lastOpen = now;
  });

  /** Focuses the field's first box once, when it opens, without moving the page. */
  function focusFirst(node: HTMLElement) {
    node.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea')?.focus({
      preventScroll: true
    });
  }

  /** After saving `key`, its field closes, unless the member has opened another one meanwhile. */
  const closeField = (key: DetailKey) => () => {
    if (page.url.searchParams.get('detail') !== key) return;
    void goto(addressFor(null, 'details').replace(/#details$/, ''), {
      reset: false,
      replace: true
    });
  };
</script>

{#if agreed}<h2 id="details-heading" class="text-lg font-semibold">What was agreed</h2>{/if}
<dl
  id="details"
  class="grid gap-x-4 gap-y-3 surface p-5 sm:grid-cols-[10rem_1fr]"
  aria-labelledby={agreed ? 'details-heading' : undefined}
  aria-label={agreed ? undefined : 'Details'}
>
  {#each rows as row (row.label)}
    <dt class="font-medium">{row.label}</dt>
    <dd class="grid min-w-0 justify-items-start gap-1.5">
      <span class={row.value === notYet ? 'text-muted-foreground' : ''}>{row.value}</span>
      {#if row.note}<span class="text-sm text-muted-foreground">{row.note}</span>{/if}
      {#if canOpen(row.key) && open === row.key && fieldOffering}
        <form
          method="POST"
          action="?/detail#details"
          class="grid w-full gap-3"
          use:focusFirst
          use:enhance={stayPut(closeField(row.key), { reset: false, refreshAll: true })}
          oninput={(event) => keepDraft(row.key as DetailKey, event)}
          onchange={(event) => keepDraft(row.key as DetailKey, event)}
        >
          <input type="hidden" name="detail" value={row.key} />
          <ArrangementFields
            offering={fieldOffering}
            values={fieldValues}
            fields={form?.fields ?? {}}
            only={row.key}
          />
          {#if form?.error && !Object.keys(form.fields ?? {}).length}<p
              class="text-sm font-medium text-destructive"
            >
              {form.error}
            </p>{/if}
          <div class="flex flex-wrap items-center gap-4">
            <Button type="submit" variant="outline">Save</Button>
            <a href={addressFor(null, `detail-${row.key}`)} data-sveltekit-reset="false">Cancel</a>
          </div>
        </form>
      {:else if refused === row.key && fieldOffering && form?.values}
        <div class="grid w-full gap-2">
          <p class="text-sm font-medium" role="status">{form.error} This wasn't saved.</p>
          <fieldset disabled class="grid w-full gap-3 opacity-80">
            <ArrangementFields
              offering={fieldOffering}
              values={form.values}
              only={refused ?? undefined}
            />
          </fieldset>
        </div>
      {:else if ended === row.key && draft}
        <div class="grid w-full gap-2">
          <p class="text-sm font-medium" role="status">
            This has ended, so it can no longer be changed. This wasn't saved.
          </p>
          <fieldset disabled class="grid w-full gap-3 opacity-80">
            <ArrangementFields offering={draft.offering} values={draft.values} only={draft.key} />
          </fieldset>
        </div>
      {:else if canOpen(row.key)}
        <a
          id="detail-{row.key}"
          href={addressFor(row.key, 'details')}
          data-sveltekit-reset="false"
          class="text-sm">{row.value === notYet ? 'Add' : 'Change'} {row.label.toLowerCase()}</a
        >
      {/if}
    </dd>
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
