<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import ListingFields from '#lib/components/ListingFields.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import PhotoPicker from '#lib/components/PhotoPicker.svelte';
  import Steps from '#lib/components/Steps.svelte';
  import { duration, quantity, typeHints, typeLabels } from '#lib/format.ts';
  import type { ListingType, Unit } from '@wunan/shared';

  let { data, form } = $props();

  const labels = ['What kind', 'Details', 'Where', 'Photos and review'];
  const values = $derived<Record<string, string>>(form?.values ?? (data.startType ? { type: data.startType } : {}));
  const step = $derived<number>(form?.step ?? Number(form?.values?._step ?? 1));
  const fields = $derived<Record<string, string>>(form?.fields ?? {});
  const type = $derived(values.type as ListingType | undefined);

  // Which answers are on screen at each step; the rest travel along as hidden fields.
  const visible: Record<number, string[]> = {
    1: ['type'],
    2: ['title', 'description', 'amount', 'unit', 'loanLength', 'loanLengthUnit', 'wanted', 'wantedAmount', 'wantedUnit', 'openToOffers', 'sessionLength', 'sessionLengthUnit', 'sessionsAvailable'],
    3: ['area'],
    4: []
  };
  const hidden = $derived(
    Object.entries(values).filter(([name, value]) => !name.startsWith('_') && !visible[step]?.includes(name) && value !== '')
  );

  /** Plain summary lines for the review step. */
  const summary = $derived.by(() => {
    const lines: [string, string][] = [];
    if (!type) return lines;
    lines.push(['Kind', typeLabels[type]], ['Title', values.title ?? '']);
    if (values.description) lines.push(['Description', values.description]);
    if (values.amount && values.unit) lines.push(['Amount', quantity(values.amount, values.unit as Unit)]);
    if (type === 'lend') {
      lines.push(['Loan', values.loanLength && values.loanLengthUnit ? `Up to ${duration(Number(values.loanLength), values.loanLengthUnit)}` : 'Loan length to be agreed']);
    }
    if (type === 'trade') {
      const wanted = [values.wanted, values.openToOffers === 'on' ? 'open to offers' : ''].filter(Boolean).join(', ');
      lines.push(['In return', wanted]);
    }
    if (type === 'service') {
      if (values.sessionLength && values.sessionLengthUnit) lines.push(['Each time', duration(Number(values.sessionLength), values.sessionLengthUnit)]);
      lines.push(['Times available', values.sessionsAvailable || 'No limit']);
    }
    lines.push(['Area', values.area || 'Not shown']);
    return lines;
  });
</script>

<svelte:head><title>New listing · wunan</title></svelte:head>

<section class="grid max-w-2xl gap-6">
  <h1 class="text-2xl font-semibold">Share something</h1>
  <Steps current={step} {labels} />

  {#if form?.error}
    <Notice kind="error"><p>{form.error}</p></Notice>
  {/if}

  <form method="POST" enctype="multipart/form-data" class="grid gap-6">
    <input type="hidden" name="_step" value={step} />
    {#each hidden as [name, value] (name)}
      <input type="hidden" {name} {value} />
    {/each}

    {#if step === 1}
      <fieldset class="grid gap-3" aria-describedby={fields.type ? 'type-error' : undefined}>
        <legend class="mb-2 text-lg font-medium">What would you like to share?</legend>
        {#if fields.type}<p id="type-error" class="font-medium text-destructive">{fields.type}</p>{/if}
        {#each Object.keys(typeLabels) as option (option)}
          <label class="flex cursor-pointer items-start gap-4 rounded-xl border-2 border-input bg-card p-4 has-[:checked]:border-primary has-[:checked]:bg-accent">
            <input type="radio" name="type" value={option} class="mt-1 size-6 shrink-0 accent-primary" checked={values.type === option} />
            <span class="grid gap-1">
              <span class="text-lg font-semibold">{typeLabels[option as ListingType]}</span>
              <span class="text-muted-foreground">{typeHints[option as ListingType]}</span>
            </span>
          </label>
        {/each}
      </fieldset>
    {:else if step === 2 && type}
      <h2 class="text-lg font-medium">{typeLabels[type]}: the details</h2>
      <p class="text-muted-foreground">Only the title is needed. Add anything else that helps.</p>
      <ListingFields {type} {values} {fields} />
    {:else if step === 3}
      <FormField
        label="Area"
        name="area"
        optional
        maxlength={60}
        hint="Your neighbourhood, not your address. You can share your address later in a message."
        value={values.area}
        error={fields.area}
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
        <Button type="submit" formaction="?/publish">Publish listing</Button>
      {:else}
        <Button type="submit" formaction="?/next">Next</Button>
      {/if}
      {#if step > 1}
        <Button type="submit" variant="outline" formaction="?/back" formnovalidate>Back</Button>
      {/if}
    </div>
  </form>
</section>
