<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import InfoNote from '#lib/components/InfoNote.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import OfferingFields from '#lib/components/OfferingFields.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import FieldProblems from '#lib/components/FieldProblems.svelte';
  import PhotoPicker from '#lib/components/PhotoPicker.svelte';
  import PlaceField from '#lib/components/PlaceField.svelte';
  import Steps from '#lib/components/Steps.svelte';
  import { duration, handoverText, quantity, timesText, typeHints, typeLabels, unitLabel } from '#lib/format.ts';
  import { placeValue } from '#lib/offering-form.ts';
  import type { Handover, OfferingType, Unit } from '@wunan/shared';

  let { data, form } = $props();

  const labels = ['What kind', 'Details', 'Where', 'Photos and review'];
  const values = $derived<Record<string, string>>(
    form?.values ?? data.prefill ?? (data.startType ? { type: data.startType } : {})
  );
  // Answering a request starts at the details: its type is already fixed.
  const step = $derived<number>(form?.step ?? Number(form?.values?._step ?? (data.prefill ? 2 : 1)));
  const fields = $derived<Record<string, string>>(form?.fields ?? {});
  const type = $derived(values.type as OfferingType | undefined);

  // Which answers are on screen at each step; the rest travel along as hidden fields.
  const visible: Record<number, string[]> = {
    1: ['type'],
    2: [
      'title',
      'description',
      'amount',
      'unit',
      'loanLength',
      'loanLengthUnit',
      'handovers',
      'accepts',
      'availability',
      'sessionLength',
      'sessionLengthUnit',
      'sessionsAvailable'
    ],
    3: ['area', 'area_text', 'meetingPlace', 'meetingPlace_text'],
    4: []
  };
  const hidden = $derived(
    Object.entries(values).filter(
      ([name, value]) => !name.startsWith('_') && !visible[step]?.includes(name) && value !== ''
    )
  );

  /** Plain summary lines for the review step. */
  const summary = $derived.by(() => {
    const lines: [string, string][] = [];
    if (!type) return lines;
    lines.push(['Kind', typeLabels[type]], ['Title', values.title ?? '']);
    if (values.description) lines.push(['Description', values.description]);
    if (values.amount && values.unit)
      lines.push(['Amount', quantity(values.amount, values.unit as Unit)]);
    if (type === 'lend') {
      lines.push([
        'Loan',
        values.loanLength && values.loanLengthUnit
          ? `Up to ${duration(Number(values.loanLength), values.loanLengthUnit)}`
          : 'Loan length to be agreed'
      ]);
    }
    const json = <T,>(name: string, fallback: T): T => {
      try {
        return values[name] ? (JSON.parse(values[name]) as T) : fallback;
      } catch {
        return fallback;
      }
    };
    const handovers = json<Handover[]>('handovers', []);
    lines.push([
      'Handover',
      handovers.length ? handovers.map((h) => handoverText(type, h, { lister: 'me', requester: 'the recipient' })).join(', ') : 'To be agreed'
    ]);
    if (type === 'trade') {
      const accepts = json<{ description: string; amount?: string; unit?: Unit }[]>('accepts', []);
      lines.push([
        'In return',
        accepts.length ? accepts.map((a) => (a.amount ? `${a.description} (${a.amount} ${a.unit ? unitLabel(a.unit) : ''})` : a.description)).join(', ') : 'Open to offers'
      ]);
    }
    if (type === 'service') {
      if (values.sessionLength && values.sessionLengthUnit)
        lines.push(['Each time', duration(Number(values.sessionLength), values.sessionLengthUnit)]);
      lines.push(['Times available', values.sessionsAvailable || 'No limit']);
      const times = json<{ weekday: number; startTime: string; endTime: string }[]>('availability', []);
      lines.push(['When', times.length ? timesText(times) : 'To be agreed']);
    }
    const label = (name: string) => {
      const place = placeValue(values, name) as { label?: string } | string | undefined;
      return typeof place === 'string' ? place : place?.label;
    };
    lines.push(['Area', label('area') ?? 'Not shown']);
    if (label('meetingPlace')) lines.push(['Meeting place', label('meetingPlace')!]);
    return lines;
  });
</script>

<svelte:head><title>New offering · wunan</title></svelte:head>

<section class="grid max-w-2xl gap-6">
  <div class="flex items-start justify-between gap-3">
    <h1 class="text-2xl font-semibold">Offer something</h1>
    <HelpLink topic="offering" label="Help with offering something" />
  </div>
  {#if data.request}
    <InfoNote>You're answering {data.request.asker.displayName}'s request: <a href="/requests/{data.request.id}">{data.request.title}</a>. It starts filled in from the request; change anything you like.</InfoNote>
  {/if}
  <Steps current={step} {labels} />

  {#if form?.error}
    <Notice kind="error">
      <p>{form.error}</p>
      {#if step === 4 && Object.keys(fields).length}
        <FieldProblems {fields} labels={{ area: 'Area', meetingPlace: 'Meeting place', handovers: 'How it happens', accepts: 'What you’d accept', availability: 'When it’s offered' }} />
        <p>Use Back to fix them.</p>
      {/if}
    </Notice>
  {/if}

  <form method="POST" enctype="multipart/form-data" class="grid gap-6">
    <input type="hidden" name="_step" value={step} />
    {#each hidden as [name, value] (name)}
      <input type="hidden" {name} {value} />
    {/each}

    {#if step === 1}
      <fieldset class="grid min-w-0 gap-3" aria-describedby={fields.type ? 'type-error' : undefined}>
        <legend class="mb-2 text-lg font-medium">What would you like to share?</legend>
        {#if fields.type}<p id="type-error" class="font-medium text-destructive">
            {fields.type}
          </p>{/if}
        {#each Object.keys(typeLabels) as option (option)}
          <label
            class="flex cursor-pointer items-start gap-4 rounded-xl border-2 border-input bg-card p-4 has-[:checked]:border-primary has-[:checked]:bg-accent"
          >
            <input
              type="radio"
              name="type"
              value={option}
              class="mt-1 size-6 shrink-0 accent-primary"
              checked={values.type === option}
            />
            <span class="grid gap-1">
              <span class="text-lg font-semibold">{typeLabels[option as OfferingType]}</span>
              <span class="text-muted-foreground">{typeHints[option as OfferingType]}</span>
            </span>
          </label>
        {/each}
      </fieldset>
    {:else if step === 2 && type}
      <h2 class="text-lg font-medium">{typeLabels[type]}: the details</h2>
      <p class="text-muted-foreground">Only the title is needed. Add anything else that helps.</p>
      <OfferingFields {type} {values} {fields} />
    {:else if step === 3}
      <PlaceField
        label="Area"
        name="area"
        optional
        value={values.area || values.area_text}
        error={fields.area}
        hint="Your neighbourhood, or your address if people pick up from you. Others see only the neighbourhood and city until you accept their proposal."
      />
      <PlaceField
        label="Meeting place"
        name="meetingPlace"
        optional
        value={values.meetingPlace || values.meetingPlace_text}
        error={fields.meetingPlace}
        hint="Needed if you offer to meet somewhere else. A public place works best, like a library or a café."
      />
    {:else if step === 4}
      <h2 class="text-lg font-medium">Check it over</h2>
      <dl class="grid gap-2 rounded-lg border bg-card p-4 sm:grid-cols-[10rem_1fr]">
        {#each summary as [label, value] (label)}
          <dt class="font-medium">{label}</dt>
          <dd class="whitespace-pre-line text-muted-foreground sm:text-foreground">{value}</dd>
        {/each}
      </dl>
      <PhotoPicker />
    {/if}

    <div class="flex flex-wrap gap-3">
      {#if step === 4}
        <Button type="submit" formaction="?/publish">Publish offering</Button>
      {:else}
        <Button type="submit" formaction="?/next">Next</Button>
      {/if}
      {#if step > (values.forRequest ? 2 : 1)}
        <Button type="submit" variant="outline" formaction="?/back" formnovalidate>Back</Button>
      {/if}
    </div>
  </form>
</section>
