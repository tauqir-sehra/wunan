<!--
  The details of a proposal for one offering (002 FR-011 to FR-015): when, how, where, and, by type,
  how long, how much, what's offered in return, or how many times. Every detail is optional, with
  "Not decided yet" as the empty choice, so members can talk things over first. The limits the
  offering sets are shown next to each field. Needs JavaScript (002 research §10).
  With `only`, it shows just that one detail's field, for changing it in place on the arrangement
  page (006). Those single fields work without JavaScript, except choosing from what the lister
  accepts in a trade.
-->
<script lang="ts">
  import InfoNote from '#lib/components/InfoNote.svelte';
  import FormField from '#lib/components/FormField.svelte';
  import PlaceField from '#lib/components/PlaceField.svelte';
  import { Label } from '#lib/components/ui/label/index.ts';
  import {
    duration,
    handoverText,
    handoverValues,
    periodText,
    placeText,
    quantity,
    timesText,
    unitLabel,
    unitOptions
  } from '#lib/format.ts';
  import type { DetailKey } from '#lib/arrangement-form.ts';
  import type { Handover, Offering } from '@wunan/shared';
  import { untrack } from 'svelte';

  let {
    offering,
    values = {},
    fields: given = {},
    withMessage = false,
    only
  }: {
    offering: Offering;
    values?: Record<string, string | null | undefined>;
    fields?: Record<string, string>;
    withMessage?: boolean;
    /** Show just this detail's field (006). */
    only?: DetailKey;
  } = $props();

  const show = (key: DetailKey) => !only || only === key;

  // Errors on parts ("offers.0.amount", "place.label") show at their field; a time error shows with the day.
  const fields = $derived.by(() => {
    const all: Record<string, string> = {};
    for (const [key, message] of Object.entries(given)) all[key.split('.')[0]!] ??= message;
    if (all.time) all.date ??= all.time;
    return all;
  });

  const owner = $derived(offering.owner.displayName);
  const names = $derived({ lister: owner, requester: 'you' });
  const choices = $derived<Handover[]>(
    offering.handovers.length ? offering.handovers : handoverValues
  );
  // The form starts from the saved values; after that, what the member changes is the state.
  const start = untrack(() => ({ values, offering }));
  let handover = $state<string>(start.values.handover ?? '');

  type Offer = { acceptId: string; amount?: string };
  const savedOffers = (() => {
    try {
      return start.values.offers ? (JSON.parse(start.values.offers) as Offer[]) : [];
    } catch {
      return [];
    }
  })();
  let chosen = $state<Record<string, { on: boolean; amount: string }>>(
    Object.fromEntries(
      start.offering.accepts.map((a) => {
        const saved = savedOffers.find((o) => o.acceptId === a.id);
        return [a.id, { on: Boolean(saved), amount: saved?.amount ?? '' }];
      })
    )
  );
  const offersJson = $derived(
    JSON.stringify(
      Object.entries(chosen)
        .filter(([, c]) => c.on)
        .map(([acceptId, c]) => ({
          acceptId,
          ...(c.amount.trim() ? { amount: c.amount.trim() } : {})
        }))
    )
  );

  const whenLabel = {
    lend: 'When would you pick it up?',
    gift: 'When would you pick it up?',
    trade: 'When would you trade?',
    service: 'When?'
  } as const;
  const today = new Date().toISOString().slice(0, 10);
  const selectClass = 'min-h-11 rounded-md border border-input bg-card px-3 text-base';
  const numberClass =
    'min-h-11 w-28 rounded-md border border-input bg-card px-3 text-base aria-invalid:border-2 aria-invalid:border-destructive';
</script>

{#snippet numberWithUnit(
  label: string,
  numberName: string,
  unitName: string,
  hint: string,
  unitChoices: [string, string][]
)}
  {@const error = fields[numberName] ?? fields[unitName]}
  <fieldset
    class="grid min-w-0 gap-1.5"
    aria-describedby="{numberName}-hint{error ? ` ${numberName}-error` : ''}"
  >
    <legend class="text-base font-medium"
      >{label} <span class="font-normal text-muted-foreground">(optional)</span></legend
    >
    <p id="{numberName}-hint" class="text-sm text-muted-foreground">{hint}</p>
    {#if error}<p id="{numberName}-error" class="text-sm font-medium text-destructive">
        {error}
      </p>{/if}
    <div class="flex flex-wrap items-center gap-3">
      <Label for={numberName} class="sr-only">{label}: number</Label>
      <input
        id={numberName}
        name={numberName}
        inputmode="decimal"
        class={numberClass}
        value={values[numberName] ?? ''}
        aria-invalid={fields[numberName] ? 'true' : undefined}
      />
      <Label for={unitName} class="sr-only">{label}: unit</Label>
      <select id={unitName} name={unitName} class={selectClass}>
        <option value="">Not decided yet</option>
        {#each unitChoices as [value, text] (value)}<option
            {value}
            selected={values[unitName] === value}>{text}</option
          >{/each}
      </select>
    </div>
  </fieldset>
{/snippet}

{#if !only || (only === 'return' && offering.accepts.length)}
  <noscript
    ><p class="rounded-lg border border-dashed p-3">
      This form needs JavaScript turned on. Please turn it on in your browser, then reload the page.
    </p></noscript
  >
{/if}

<div class="grid gap-5">
  {#if !only}
    <InfoNote
      >Fill in what you know. Anything you leave as “Not decided yet” you can talk over with {owner}
      first, and change later.</InfoNote
    >
  {/if}

  {#if show('when')}<fieldset
      class="grid min-w-0 gap-1.5"
      aria-describedby="when-hint{fields.date ? ' when-error' : ''}"
    >
      <legend class="text-base font-medium"
        >{whenLabel[offering.type]}
        <span class="font-normal text-muted-foreground">(optional)</span></legend
      >
      <p id="when-hint" class="text-sm text-muted-foreground">
        {#if offering.type === 'service' && offering.availability.length}{owner} offers this {timesText(
            offering.availability
          )}.{:else}A day, and a time if you know it.{/if}
        {#if offering.type === 'lend' && offering.takenPeriods.length}Already lent: {offering.takenPeriods
            .map((p) => periodText(p.startsAt, p.endsAt))
            .join('; ')}.{/if}
      </p>
      {#if fields.date}<p id="when-error" class="text-sm font-medium text-destructive">
          {fields.date}
        </p>{/if}
      <div class="flex flex-wrap gap-4">
        <div class="grid gap-1">
          <Label for="date">Day</Label><input
            id="date"
            name="date"
            type="date"
            min={today}
            class={selectClass}
            value={values.date ?? ''}
          />
        </div>
        <div class="grid gap-1">
          <Label for="time">Time</Label><input
            id="time"
            name="time"
            type="time"
            class={selectClass}
            value={values.time ?? ''}
          />
        </div>
      </div>
    </fieldset>{/if}

  {#if show('how')}<fieldset
      class="grid min-w-0 gap-1"
      aria-describedby={fields.handover ? 'handover-error' : undefined}
    >
      <legend class="mb-1 text-base font-medium"
        >How would it happen? <span class="font-normal text-muted-foreground">(optional)</span
        ></legend
      >
      {#if fields.handover}<p id="handover-error" class="text-sm font-medium text-destructive">
          {fields.handover}
        </p>{/if}
      <label class="flex min-h-11 items-center gap-3"
        ><input
          type="radio"
          name="handover"
          value=""
          class="size-6 accent-primary"
          bind:group={handover}
        />Not decided yet</label
      >
      {#each choices as option (option)}
        <label class="flex min-h-11 items-center gap-3"
          ><input
            type="radio"
            name="handover"
            value={option}
            class="size-6 accent-primary"
            bind:group={handover}
          />{handoverText(offering.type, option, names)}</label
        >
      {/each}
    </fieldset>{/if}

  {#if only && only !== 'where'}
    <!-- Just one other detail: no place here. -->
  {:else if handover === 'at_lister'}
    <InfoNote
      >Where: at {owner}'s place{offering.area ? ` (${placeText(offering.area)})` : ''}. You'll see
      the full address once {owner} accepts.</InfoNote
    >
  {:else if handover !== 'online'}
    <PlaceField
      label="Where?"
      name="place"
      optional
      value={values.place || values.place_text}
      error={fields.place}
      hint={handover === 'elsewhere' && offering.meetingPlace
        ? `Leave empty to meet at ${owner}'s meeting place (${placeText(offering.meetingPlace)}).`
        : handover === 'to_requester'
          ? `Where ${owner} should come. Only ${owner} sees this.`
          : `Only you and ${owner} see this.`}
    />
  {/if}

  {#if offering.type === 'lend' && show('length')}
    {@render numberWithUnit(
      'For how long?',
      'loanLength',
      'loanLengthUnit',
      offering.loanLength && offering.loanLengthUnit
        ? `${owner} lends this for up to ${duration(offering.loanLength, offering.loanLengthUnit)}.`
        : 'For example 3 days.',
      [
        ['hours', 'hours'],
        ['days', 'days'],
        ['weeks', 'weeks']
      ]
    )}
  {/if}

  {#if (offering.type === 'gift' || offering.type === 'trade') && offering.remaining !== null && show('amount')}
    <FormField
      label="How much would you like?"
      name="amount"
      inputmode="decimal"
      optional
      hint="Up to {quantity(offering.remaining, offering.unit)}{offering.unit &&
      offering.unit !== 'other'
        ? ''
        : ''}."
      value={values.amount ?? offering.remaining}
      error={fields.amount}
    />
  {/if}

  {#if offering.type === 'trade' && show('return')}
    {#if offering.accepts.length}
      <fieldset
        class="grid min-w-0 gap-2"
        aria-describedby={fields.offers ? 'offers-error' : undefined}
      >
        <legend class="text-base font-medium"
          >What would you offer? <span class="font-normal text-muted-foreground">(optional)</span
          ></legend
        >
        <p class="text-sm text-muted-foreground">Choose from what {owner} would accept.</p>
        {#if fields.offers}<p id="offers-error" class="text-sm font-medium text-destructive">
            {fields.offers}
          </p>{/if}
        {#each offering.accepts as thing (thing.id)}
          <div class="flex flex-wrap items-center gap-3">
            <label class="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                class="size-6 accent-primary"
                bind:checked={chosen[thing.id]!.on}
              />
              {thing.description}{#if thing.amount}
                (up to {quantity(thing.amount, thing.unit)}){/if}
            </label>
            {#if chosen[thing.id]!.on}
              <Label for="offer-{thing.id}" class="sr-only">How much {thing.description}</Label>
              <input
                id="offer-{thing.id}"
                inputmode="decimal"
                placeholder="How much"
                class={numberClass}
                bind:value={chosen[thing.id]!.amount}
              />
            {/if}
          </div>
        {/each}
        <input type="hidden" name="offers" value={offersJson} />
      </fieldset>
    {:else}
      <FormField
        label="What would you offer in return?"
        name="ownOffer"
        optional
        maxlength={300}
        hint="{owner} is open to offers. For example “a jar of honey” or “$20”."
        value={values.ownOffer}
        error={fields.ownOffer}
      />
      {@render numberWithUnit(
        'How much of it',
        'ownOfferAmount',
        'ownOfferUnit',
        'Optional, like 2 kg.',
        unitOptions.map((u) => [u, unitLabel(u)])
      )}
    {/if}
  {/if}

  {#if offering.type === 'service' && show('session')}
    {@render numberWithUnit(
      'How long each time?',
      'sessionLength',
      'sessionLengthUnit',
      offering.sessionLength && offering.sessionLengthUnit
        ? `Up to ${duration(offering.sessionLength, offering.sessionLengthUnit)}.`
        : 'For example 1 hour.',
      [
        ['minutes', 'minutes'],
        ['hours', 'hours'],
        ['days', 'days'],
        ['weeks', 'weeks']
      ]
    )}
  {/if}
  {#if offering.type === 'service' && show('sessions')}
    <FormField
      label="How many times?"
      name="sessions"
      inputmode="numeric"
      optional
      hint={offering.sessionsRemaining !== null
        ? `Up to ${offering.sessionsRemaining}.`
        : 'Usually 1.'}
      value={values.sessions}
      error={fields.sessions}
    />
  {/if}

  {#if withMessage}
    <FormField
      label="Anything you'd rather talk about first?"
      name="message"
      multiline
      optional
      maxlength={4000}
      hint="Sent to {owner} with your proposal."
      value={values.message}
      error={fields.message}
    />
  {/if}
</div>
