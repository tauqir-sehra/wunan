<!--
  The details of an offering for one type: title, description, how the handover happens, and the
  type's own fields (what a trade accepts, when a service is offered). Used when creating (step 2)
  and editing. Handovers, accepted things, and times travel as hidden JSON fields filled from the
  page's state, so this part needs JavaScript (002 research §10); the form says so when it's off.
  Places (area and meeting place) are asked separately, with PlaceField.
-->
<script lang="ts">
  import InfoNote from '#lib/components/InfoNote.svelte';
  import FormField from '#lib/components/FormField.svelte';
  import RepeatingRows from '#lib/components/RepeatingRows.svelte';
  import { Label } from '#lib/components/ui/label/index.ts';
  import {
    dayNames,
    handoverQuestion,
    handoverText,
    handoverValues,
    unitLabel,
    unitOptions
  } from '#lib/format.ts';
  import type { Handover, OfferingType } from '@wunan/shared';
  import { untrack } from 'svelte';

  let {
    type,
    values = {},
    fields = {},
    ownerName = 'me'
  }: {
    type: OfferingType;
    values?: Record<string, string | null | undefined>;
    fields?: Record<string, string>;
    ownerName?: string;
  } = $props();

  const parse = <T,>(text: string | null | undefined, fallback: T): T => {
    try {
      return text ? (JSON.parse(text) as T) : fallback;
    } catch {
      return fallback;
    }
  };

  type Accept = { description: string; amount: string; unit: string };
  type Time = { weekday: string; startTime: string; endTime: string };
  // The form starts from the saved values; after that, what the member changes is the state.
  const start = untrack(() => values);
  let handovers = $state<Handover[]>(parse(start.handovers, []));
  let accepts = $state<Accept[]>(
    parse<Accept[]>(start.accepts, []).map((a) => ({
      description: a.description ?? '',
      amount: a.amount ?? '',
      unit: a.unit ?? ''
    }))
  );
  let times = $state<Time[]>(
    parse<Time[]>(start.availability, []).map((t) => ({
      weekday: String(t.weekday ?? ''),
      startTime: t.startTime ?? '',
      endTime: t.endTime ?? ''
    }))
  );

  const acceptsJson = $derived(
    JSON.stringify(
      accepts
        .filter((a) => a.description.trim() || a.amount.trim())
        .map((a) => ({
          description: a.description.trim(),
          ...(a.amount.trim() ? { amount: a.amount.trim() } : {}),
          ...(a.unit ? { unit: a.unit } : {})
        }))
    )
  );
  const timesJson = $derived(
    JSON.stringify(
      times
        .filter((t) => t.weekday || t.startTime || t.endTime)
        .map((t) => ({ weekday: Number(t.weekday), startTime: t.startTime, endTime: t.endTime }))
    )
  );

  /** API field errors for rows arrive as "accepts.0.unit"; these collect them per row. */
  const rowError = (prefix: string, index: number) =>
    Object.entries(fields)
      .filter(([key]) => key.startsWith(`${prefix}.${index}.`))
      .map(([, message]) => message)
      .join(' ');

  const selectClass = 'min-h-11 rounded-md border border-input bg-card px-3 text-base';
  const numberClass =
    'min-h-11 w-28 rounded-md border border-input bg-card px-3 text-base aria-invalid:border-2 aria-invalid:border-destructive';
  const names = $derived({ lister: ownerName, requester: 'the recipient' });
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
      <select
        id={unitName}
        name={unitName}
        class={selectClass}
        aria-invalid={fields[unitName] ? 'true' : undefined}
      >
        <option value="">Choose…</option>
        {#each unitChoices as [value, text] (value)}
          <option {value} selected={values[unitName] === value}>{text}</option>
        {/each}
      </select>
    </div>
  </fieldset>
{/snippet}

<noscript
  ><p class="rounded-lg border border-dashed p-3">
    This form needs JavaScript turned on. Please turn it on in your browser, then reload the page.
  </p></noscript
>

<div class="grid gap-5">
  <FormField
    label="Title"
    name="title"
    required
    maxlength={100}
    hint="A few words, like “Drill” or “5 kg of rice”."
    value={values.title}
    error={fields.title}
  />

  <FormField
    label="Description"
    name="description"
    multiline
    optional
    maxlength={2000}
    hint="Anything that helps someone decide."
    value={values.description}
    error={fields.description}
  />

  {#if type !== 'service'}
    {@render numberWithUnit(
      'Amount',
      'amount',
      'unit',
      type === 'lend' ? 'How many you can lend, like 1 item.' : 'How much there is, like 5 kg.',
      unitOptions.map((u) => [u, unitLabel(u)])
    )}
  {/if}

  {#if type === 'lend'}
    {@render numberWithUnit(
      'Longest loan',
      'loanLength',
      'loanLengthUnit',
      'Leave empty if you’d rather agree on it together.',
      [
        ['hours', 'hours'],
        ['days', 'days'],
        ['weeks', 'weeks']
      ]
    )}
  {/if}

  <fieldset class="grid min-w-0 gap-2" aria-describedby="handovers-hint">
    <legend class="text-base font-medium"
      >{handoverQuestion[type]}
      <span class="font-normal text-muted-foreground">(optional)</span></legend
    >
    <p id="handovers-hint" class="text-sm text-muted-foreground">
      Tick every way that works for you. Leave all empty to agree on it together.
    </p>
    {#each handoverValues as option (option)}
      <label class="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          class="size-6 shrink-0 accent-primary"
          value={option}
          bind:group={handovers}
        />
        <span>{handoverText(type, option, names)}</span>
      </label>
    {/each}
    <input type="hidden" name="handovers" value={JSON.stringify(handovers)} />
    {#if handovers.includes('at_lister')}<InfoNote
        >You'll be asked for your area next. Others only see its neighbourhood and city until you
        accept their proposal.</InfoNote
      >{/if}
    {#if handovers.includes('elsewhere')}<InfoNote
        >You'll be asked for the place to meet next.</InfoNote
      >{/if}
  </fieldset>

  {#if type === 'trade'}
    <fieldset class="grid min-w-0 gap-2" aria-describedby="accepts-hint">
      <legend class="text-base font-medium"
        >What you’d accept in return <span class="font-normal text-muted-foreground"
          >(optional)</span
        ></legend
      >
      <p id="accepts-hint" class="text-sm text-muted-foreground">
        Add each thing you'd take, like “Eggs, 6” or “$30”. <strong
          >Leave this empty if you’re open to offers.</strong
        >
      </p>
      {#if fields.accepts}<p class="text-sm font-medium text-destructive">{fields.accepts}</p>{/if}
      <RepeatingRows
        errorFor={(i) => rowError('accepts', i)}
        bind:rows={accepts}
        blank={() => ({ description: '', amount: '', unit: '' })}
        max={10}
        itemName="thing"
        addLabel={accepts.length ? 'Add another' : 'Add something you’d accept'}
      >
        {#snippet row(item, index)}
          <div class="flex flex-wrap items-end gap-2">
            <div class="grid min-w-0 flex-1 basis-full gap-1 sm:basis-40">
              <Label for="accept-{index}-what" class={index ? 'sm:sr-only' : ''}>What</Label>
              <input
                id="accept-{index}-what"
                maxlength={100}
                class="min-h-11 w-full rounded-md border border-input bg-card px-3 text-base"
                bind:value={item.description}
              />
            </div>
            <div class="grid gap-1">
              <Label for="accept-{index}-amount" class={index ? 'sm:sr-only' : ''}
                >Amount<span class="sr-only"> (optional)</span></Label
              >
              <input
                id="accept-{index}-amount"
                inputmode="decimal"
                class={numberClass}
                bind:value={item.amount}
              />
            </div>
            <div class="grid gap-1">
              <Label for="accept-{index}-unit" class={index ? 'sm:sr-only' : ''}>Unit</Label>
              <select id="accept-{index}-unit" class="{selectClass} w-36" bind:value={item.unit}>
                <option value="">Choose…</option>
                {#each unitOptions as u (u)}<option value={u}>{unitLabel(u)}</option>{/each}
              </select>
            </div>
          </div>
        {/snippet}
      </RepeatingRows>
      {#if accepts.length === 0}<InfoNote
          >Open to offers: people can suggest what they'd give.</InfoNote
        >{/if}
      <input type="hidden" name="accepts" value={acceptsJson} />
    </fieldset>
  {/if}

  {#if type === 'service'}
    {@render numberWithUnit(
      'How long each time',
      'sessionLength',
      'sessionLengthUnit',
      'For example 1 hour, or 2 days.',
      [
        ['minutes', 'minutes'],
        ['hours', 'hours'],
        ['days', 'days'],
        ['weeks', 'weeks']
      ]
    )}
    <FormField
      label="How many times you can offer it"
      name="sessionsAvailable"
      inputmode="numeric"
      optional
      hint="Leave empty if there’s no limit."
      value={values.sessionsAvailable}
      error={fields.sessionsAvailable}
    />
    <fieldset class="grid min-w-0 gap-2" aria-describedby="times-hint">
      <legend class="text-base font-medium"
        >When it's offered <span class="font-normal text-muted-foreground">(optional)</span></legend
      >
      <p id="times-hint" class="text-sm text-muted-foreground">
        Add each day and the hours that suit you. People can only ask for those times. Leave empty
        to agree on times together.
      </p>
      {#if fields.availability}<p class="text-sm font-medium text-destructive">
          {fields.availability}
        </p>{/if}
      <RepeatingRows
        errorFor={(i) => rowError('availability', i)}
        bind:rows={times}
        blank={() => ({ weekday: '', startTime: '', endTime: '' })}
        max={14}
        itemName="time"
        addLabel={times.length ? 'Add another' : 'Add a time'}
      >
        {#snippet row(item, index)}
          <div class="flex flex-wrap items-end gap-2">
            <div class="grid gap-1">
              <Label for="time-{index}-day" class={index ? 'sm:sr-only' : ''}>Day</Label>
              <select id="time-{index}-day" class={selectClass} bind:value={item.weekday}>
                <option value="">Choose…</option>
                {#each [1, 2, 3, 4, 5, 6, 7] as d (d)}<option value={String(d)}
                    >{dayNames[d]}</option
                  >{/each}
              </select>
            </div>
            <div class="grid gap-1">
              <Label for="time-{index}-from" class={index ? 'sm:sr-only' : ''}>From</Label>
              <input
                id="time-{index}-from"
                type="time"
                class={selectClass}
                bind:value={item.startTime}
              />
            </div>
            <div class="grid gap-1">
              <Label for="time-{index}-to" class={index ? 'sm:sr-only' : ''}>To</Label>
              <input
                id="time-{index}-to"
                type="time"
                class={selectClass}
                bind:value={item.endTime}
              />
            </div>
          </div>
        {/snippet}
      </RepeatingRows>
      <input type="hidden" name="availability" value={timesJson} />
    </fieldset>
  {/if}
</div>
