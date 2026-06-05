<!--
  The details of a listing for one type: title, description, and the type's own fields.
  Used when creating (step 2) and editing. Native inputs and selects, so it works without JavaScript.
-->
<script lang="ts">
  import FormField from '#lib/components/FormField.svelte';
  import { Label } from '#lib/components/ui/label/index.ts';
  import { unitLabel, unitOptions } from '#lib/format.ts';
  import type { ListingType } from '@wunan/shared';

  let {
    type,
    values = {},
    fields = {}
  }: { type: ListingType; values?: Record<string, string | null | undefined>; fields?: Record<string, string> } = $props();

  const selectClass = 'min-h-11 rounded-md border border-input bg-card px-3 text-base';
  const numberClass = 'min-h-11 w-28 rounded-md border border-input bg-card px-3 text-base aria-invalid:border-2 aria-invalid:border-destructive';
</script>

{#snippet numberWithUnit(label: string, numberName: string, unitName: string, hint: string, unitChoices: [string, string][])}
  {@const error = fields[numberName] ?? fields[unitName]}
  <fieldset class="grid min-w-0 gap-1.5" aria-describedby="{numberName}-hint{error ? ` ${numberName}-error` : ''}">
    <legend class="text-base font-medium">{label} <span class="font-normal text-muted-foreground">(optional)</span></legend>
    <p id="{numberName}-hint" class="text-sm text-muted-foreground">{hint}</p>
    {#if error}<p id="{numberName}-error" class="text-sm font-medium text-destructive">{error}</p>{/if}
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
      <select id={unitName} name={unitName} class={selectClass} aria-invalid={fields[unitName] ? 'true' : undefined}>
        <option value="">Choose…</option>
        {#each unitChoices as [value, text] (value)}
          <option {value} selected={values[unitName] === value}>{text}</option>
        {/each}
      </select>
    </div>
  </fieldset>
{/snippet}

<div class="grid gap-5">
  <FormField label="Title" name="title" required maxlength={100} hint="A few words, like “Drill” or “5 kg of rice”." value={values.title} error={fields.title} />

  <FormField
    label="Description"
    name="description"
    multiline
    optional
    maxlength={2000}
    hint="Anything that helps, including how the handover could work (pick-up, drop-off, where)."
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
    {@render numberWithUnit('Longest loan', 'loanLength', 'loanLengthUnit', 'Leave empty if you’d rather agree on it together.', [
      ['hours', 'hours'],
      ['days', 'days'],
      ['weeks', 'weeks']
    ])}
  {/if}

  {#if type === 'trade'}
    <FormField
      label="What you’d like in return"
      name="wanted"
      maxlength={300}
      hint="For example “leather boots” or “$30”. Leave empty if you’re open to offers."
      value={values.wanted}
      error={fields.wanted}
    />
    {@render numberWithUnit('How much of it', 'wantedAmount', 'wantedUnit', 'Optional, like 2 kg.', unitOptions.map((u) => [u, unitLabel(u)]))}
    <label class="flex min-h-11 items-center gap-3">
      <input type="checkbox" name="openToOffers" class="size-6 shrink-0 accent-primary" checked={values.openToOffers === 'on' || values.openToOffers === 'true'} />
      <span>Open to offers</span>
    </label>
  {/if}

  {#if type === 'service'}
    {@render numberWithUnit('How long each time', 'sessionLength', 'sessionLengthUnit', 'For example 1 hour.', [
      ['minutes', 'minutes'],
      ['hours', 'hours']
    ])}
    <FormField
      label="How many times you can offer it"
      name="sessionsAvailable"
      inputmode="numeric"
      optional
      hint="Leave empty if there’s no limit."
      value={values.sessionsAvailable}
      error={fields.sessionsAvailable}
    />
  {/if}
</div>
