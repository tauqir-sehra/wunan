<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import { amountLine, day, quantity } from '#lib/format.ts';

  let { data, form } = $props();
  const listing = $derived(data.listing);
  const values = $derived<Record<string, string>>(form?.review ?? form?.values ?? {});
  const chosen = $derived(data.candidates.find((c) => c.id === values.otherMemberId));
  const measured = $derived((listing.type === 'gift' || listing.type === 'trade') && listing.remaining !== null);
  const today = new Date().toISOString().slice(0, 10);
  const fields = $derived<Record<string, string>>((form?.fields as Record<string, string> | undefined) ?? {});
</script>

<svelte:head><title>Record an agreement · wunan</title></svelte:head>

<section class="grid max-w-xl gap-5">
  <div class="grid gap-1">
    <h1 class="text-2xl font-semibold">Record an agreement</h1>
    <p class="text-muted-foreground">
      For <a href="/listings/{listing.id}">{listing.title}</a>{#if amountLine(listing)} · {amountLine(listing)}{/if}
    </p>
  </div>
  {#if form?.error}<Notice kind="error"><p>{form.error}</p></Notice>{/if}

  {#if data.candidates.length === 0}
    <p>
      Only people who messaged you about this listing can be chosen. When someone asks about it,
      you can record what you agreed here.
    </p>
  {:else if form?.review}
    <p>Please check this before recording it:</p>
    <div class="grid gap-1 rounded-lg border border-input bg-card p-4">
      <p>With <strong>{chosen?.displayName}</strong></p>
      {#if values.amount}<p>Amount: {quantity(values.amount, listing.unit)}</p>{/if}
      {#if values.returnDue}<p>Back by: {day(values.returnDue)}</p>{/if}
      {#if listing.type === 'service'}<p>Sessions: {values.sessions || 1}</p>{/if}
      {#if values.note}<p class="whitespace-pre-line">Note: {values.note}</p>{/if}
    </div>
    <p class="text-muted-foreground">
      {chosen?.displayName} will be asked to confirm it. Until then, you can cancel it if something's wrong.
    </p>
    <form method="POST" action="?/record" class="flex flex-wrap items-center gap-3">
      {#each Object.entries(values) as [name, value] (name)}<input type="hidden" {name} {value} />{/each}
      <Button type="submit">Record agreement</Button>
      <a href="/listings/{listing.id}/agreements/new">Change something</a>
    </form>
  {:else}
    <form method="POST" action="?/review" class="grid gap-5">
      <fieldset class="grid gap-2" aria-describedby={fields.otherMemberId ? 'who-error' : undefined}>
        <legend class="mb-1 font-medium">Who did you agree with?</legend>
        {#if fields.otherMemberId}<p id="who-error" class="font-medium text-destructive">{fields.otherMemberId}</p>{/if}
        {#each data.candidates as candidate (candidate.id)}
          <label class="flex min-h-11 items-center gap-3">
            <input type="radio" name="otherMemberId" value={candidate.id} class="size-6 accent-primary" checked={values.otherMemberId === candidate.id} />
            {candidate.displayName}
          </label>
        {/each}
      </fieldset>

      {#if measured}
        <FormField label="How much" name="amount" inputmode="decimal" required hint="Up to {quantity(listing.remaining ?? '0', listing.unit)}." value={values.amount} error={fields.amount} />
      {/if}
      {#if listing.type === 'lend'}
        <FormField label="Back by" name="returnDue" type="date" required min={today} hint="wunan sends you both one gentle reminder if it's not back by then." value={values.returnDue} error={fields.returnDue} />
      {/if}
      {#if listing.type === 'service'}
        <FormField label="How many sessions" name="sessions" inputmode="numeric" hint="Usually 1." value={values.sessions ?? '1'} error={fields.sessions} />
      {/if}
      <FormField label="Note" name="note" multiline optional maxlength={500} hint="Anything you both want to remember, like where you'll meet." value={values.note} error={fields.note} />
      <div><Button type="submit">Review</Button></div>
    </form>
  {/if}
</section>
