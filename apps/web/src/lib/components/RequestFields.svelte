<!--
  The request form (003 FR-001 to FR-006): what kind and a title, then everything else optional:
  description, when it's needed ("Needed after" / "Needed by"), area, how it could happen, and the
  kind's own details (how long, how much, what could be given back, how long each time, how many
  times, the times that suit). While the title is typed, offerings that might already have it are
  suggested. Handovers, give-back items, and times travel as hidden JSON fields filled from the
  page's state, so this form needs JavaScript (research §11) and says so when it's off.
-->
<script lang="ts">
  import FormField from '#lib/components/FormField.svelte';
  import InfoNote from '#lib/components/InfoNote.svelte';
  import PlaceField from '#lib/components/PlaceField.svelte';
  import RepeatingRows from '#lib/components/RepeatingRows.svelte';
  import RequestSuggestions from '#lib/components/RequestSuggestions.svelte';
  import { Label } from '#lib/components/ui/label/index.ts';
  import {
    dayNames,
    handoverQuestion,
    handoverText,
    handoverValues,
    kindHints,
    kindLabels,
    unitLabel,
    unitOptions
  } from '#lib/format.ts';
  import { offeringTypeFor, type Handover, type RequestKind } from '@wunan/shared';
  import { untrack } from 'svelte';

  let {
    values = {},
    fields = {},
    fixedKind
  }: {
    values?: Record<string, string | null | undefined>;
    fields?: Record<string, string>;
    /** When editing, the kind can't change. */
    fixedKind?: RequestKind;
  } = $props();

  const parse = <T,>(text: string | null | undefined, fallback: T): T => {
    try {
      return text ? (JSON.parse(text) as T) : fallback;
    } catch {
      return fallback;
    }
  };

  type Item = { description: string; amount: string; unit: string };
  type Time = { weekday: string; startTime: string; endTime: string };
  const start = untrack(() => values);
  let kind = $state<RequestKind | undefined>(
    (untrack(() => fixedKind) ?? start.kind ?? undefined) as RequestKind | undefined
  );
  let title = $state(start.title ?? '');
  let handovers = $state<Handover[]>(parse(start.handovers, []));
  let giveBack = $state<Item[]>(
    parse<Item[]>(start.giveBack, []).map((a) => ({
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

  const giveBackJson = $derived(
    JSON.stringify(
      giveBack
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

  const rowError = (prefix: string, index: number) =>
    Object.entries(fields)
      .filter(([key]) => key.startsWith(`${prefix}.${index}.`))
      .map(([, message]) => message)
      .join(' ');

  const selectClass = 'min-h-11 rounded-md border border-input bg-card px-3 text-base';
  const numberClass =
    'min-h-11 w-28 rounded-md border border-input bg-card px-3 text-base aria-invalid:border-2 aria-invalid:border-destructive';
  const offeringType = $derived(kind ? offeringTypeFor[kind] : undefined);
  const names = { lister: 'the person helping', requester: 'me' };
  const areaText = $derived.by(() => {
    const saved = parse<{ neighbourhood?: string; city?: string; label?: string } | null>(
      start.area,
      null
    );
    return saved?.neighbourhood ?? saved?.city ?? start.area_text ?? undefined;
  });
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
  {#if fixedKind}
    <input type="hidden" name="kind" value={fixedKind} />
  {:else}
    <fieldset class="grid min-w-0 gap-3" aria-describedby={fields.kind ? 'kind-error' : undefined}>
      <legend class="mb-1 text-lg font-medium">What do you need?</legend>
      {#if fields.kind}<p id="kind-error" class="font-medium text-destructive">
          {fields.kind}
        </p>{/if}
      <div class="grid gap-3 sm:grid-cols-2">
        {#each Object.keys(kindLabels) as option (option)}
          <label
            class="flex cursor-pointer items-start gap-4 rounded-xl border-2 border-input bg-card p-4 has-[:checked]:border-primary has-[:checked]:bg-accent"
          >
            <input
              type="radio"
              name="kind"
              value={option}
              class="mt-1 size-6 shrink-0 accent-primary"
              bind:group={kind}
            />
            <span class="grid gap-1">
              <span class="text-lg font-semibold">{kindLabels[option as RequestKind]}</span>
              <span class="text-muted-foreground">{kindHints[option as RequestKind]}</span>
            </span>
          </label>
        {/each}
      </div>
    </fieldset>
  {/if}

  <div class="grid gap-1.5">
    <Label for="title">Title</Label>
    <p id="title-hint" class="text-sm text-muted-foreground">
      A few words, like “Drill for putting up shelves” or “5 lb of rice”.
    </p>
    {#if fields.title}<p id="title-error" class="text-sm font-medium text-destructive">
        {fields.title}
      </p>{/if}
    <input
      id="title"
      name="title"
      required
      maxlength={100}
      class="min-h-11 w-full rounded-md border border-input bg-card px-3 text-base aria-invalid:border-2 aria-invalid:border-destructive"
      aria-describedby={fields.title ? 'title-error title-hint' : 'title-hint'}
      aria-invalid={fields.title ? 'true' : undefined}
      bind:value={title}
    />
  </div>

  {#if !fixedKind}<RequestSuggestions {kind} {title} area={areaText} />{/if}

  {#if kind && offeringType}
    <h2 class="text-lg font-medium">
      Anything else that helps <span class="font-normal text-muted-foreground">(all optional)</span>
    </h2>

    <FormField
      label="Description"
      name="description"
      multiline
      optional
      maxlength={2000}
      hint="What it's for, what would work, anything someone should know."
      value={values.description}
      error={fields.description}
    />

    <fieldset class="grid min-w-0 gap-2" aria-describedby="needed-hint">
      <legend class="text-base font-medium"
        >When it's needed <span class="font-normal text-muted-foreground">(optional)</span></legend
      >
      <p id="needed-hint" class="text-sm text-muted-foreground">
        Leave both empty if there's no fixed date. Use the same day in both for one day.
      </p>
      {#if fields.neededAfter ?? fields.neededBy}<p class="text-sm font-medium text-destructive">
          {fields.neededAfter ?? fields.neededBy}
        </p>{/if}
      <div class="flex flex-wrap gap-4">
        <div class="grid gap-1">
          <Label for="neededAfter">Needed after</Label>
          <input
            id="neededAfter"
            name="neededAfter"
            type="date"
            class={selectClass}
            value={values.neededAfter ?? ''}
            aria-invalid={fields.neededAfter ? 'true' : undefined}
          />
        </div>
        <div class="grid gap-1">
          <Label for="neededBy">Needed by</Label>
          <input
            id="neededBy"
            name="neededBy"
            type="date"
            class={selectClass}
            value={values.neededBy ?? ''}
            aria-invalid={fields.neededBy ? 'true' : undefined}
          />
        </div>
      </div>
    </fieldset>

    <PlaceField
      label="Area"
      name="area"
      optional
      value={values.area || values.area_text}
      error={fields.area}
      hint="Your neighbourhood or city. Others see only the neighbourhood and city."
    />

    <fieldset class="grid min-w-0 gap-2" aria-describedby="handovers-hint">
      <legend class="text-base font-medium"
        >{handoverQuestion[offeringType]}
        <span class="font-normal text-muted-foreground">(optional)</span></legend
      >
      <p id="handovers-hint" class="text-sm text-muted-foreground">
        Tick every way that would work for you. Leave all empty to agree on it together.
      </p>
      {#each handoverValues as option (option)}
        <label class="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            class="size-6 shrink-0 accent-primary"
            value={option}
            bind:group={handovers}
          />
          <span>{handoverText(offeringType, option, names)}</span>
        </label>
      {/each}
      <input type="hidden" name="handovers" value={JSON.stringify(handovers)} />
    </fieldset>

    {#if kind === 'borrow'}
      {@render numberWithUnit(
        'How long',
        'loanLength',
        'loanLengthUnit',
        'How long you’d need it, like 1 day.',
        [
          ['hours', 'hours'],
          ['days', 'days'],
          ['weeks', 'weeks']
        ]
      )}
    {/if}

    {#if kind === 'receive' || kind === 'trade'}
      {@render numberWithUnit(
        'How much',
        'amount',
        'unit',
        'Like 5 lb, or 1 item.',
        unitOptions.map((u) => [u, unitLabel(u)])
      )}
    {/if}

    {#if kind === 'trade'}
      <fieldset class="grid min-w-0 gap-2" aria-describedby="giveback-hint">
        <legend class="text-base font-medium"
          >What you could give back <span class="font-normal text-muted-foreground">(optional)</span
          ></legend
        >
        <p id="giveback-hint" class="text-sm text-muted-foreground">
          Add each thing you could offer, like “Jam, 2 jars”. <strong
            >Leave this empty if you’re open to talking about it.</strong
          >
        </p>
        {#if fields.giveBack}<p class="text-sm font-medium text-destructive">
            {fields.giveBack}
          </p>{/if}
        <RepeatingRows
          errorFor={(i) => rowError('giveBack', i)}
          bind:rows={giveBack}
          blank={() => ({ description: '', amount: '', unit: '' })}
          max={10}
          itemName="thing"
          addLabel={giveBack.length ? 'Add another' : 'Add something you could give'}
        >
          {#snippet row(item, index)}
            <div class="flex flex-wrap items-end gap-2">
              <div class="grid min-w-0 flex-1 basis-full gap-1 sm:basis-40">
                <Label for="giveback-{index}-what" class={index ? 'sm:sr-only' : ''}>What</Label>
                <input
                  id="giveback-{index}-what"
                  maxlength={100}
                  class="min-h-11 w-full rounded-md border border-input bg-card px-3 text-base"
                  bind:value={item.description}
                />
              </div>
              <div class="grid gap-1">
                <Label for="giveback-{index}-amount" class={index ? 'sm:sr-only' : ''}
                  >Amount<span class="sr-only"> (optional)</span></Label
                >
                <input
                  id="giveback-{index}-amount"
                  inputmode="decimal"
                  class={numberClass}
                  bind:value={item.amount}
                />
              </div>
              <div class="grid gap-1">
                <Label for="giveback-{index}-unit" class={index ? 'sm:sr-only' : ''}>Unit</Label>
                <select
                  id="giveback-{index}-unit"
                  class="{selectClass} w-36"
                  bind:value={item.unit}
                >
                  <option value="">Choose…</option>
                  {#each unitOptions as u (u)}<option value={u}>{unitLabel(u)}</option>{/each}
                </select>
              </div>
            </div>
          {/snippet}
        </RepeatingRows>
        {#if giveBack.length === 0}<InfoNote
            >Open to talking about it: people can suggest what would work.</InfoNote
          >{/if}
        <input type="hidden" name="giveBack" value={giveBackJson} />
      </fieldset>
    {/if}

    {#if kind === 'service'}
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
        label="How many times"
        name="sessions"
        inputmode="numeric"
        optional
        hint="Leave empty if it's just once or you're not sure."
        value={values.sessions}
        error={fields.sessions}
      />
      <fieldset class="grid min-w-0 gap-2" aria-describedby="times-hint">
        <legend class="text-base font-medium"
          >Times that suit you <span class="font-normal text-muted-foreground">(optional)</span
          ></legend
        >
        <p id="times-hint" class="text-sm text-muted-foreground">
          Add each day and the hours that work for you.
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
  {/if}
</div>
