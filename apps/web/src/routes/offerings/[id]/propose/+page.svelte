<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import InfoNote from '#lib/components/InfoNote.svelte';
  import FieldProblems from '#lib/components/FieldProblems.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import ProposalFields from '#lib/components/ProposalFields.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { amountLine } from '#lib/format.ts';

  let { data, form } = $props();
  const labels: Record<string, string> = {
    date: 'When',
    time: 'Time',
    handover: 'How',
    place: 'Where',
    loanLength: 'For how long',
    loanLengthUnit: 'For how long',
    amount: 'How much',
    offers: 'What you offer',
    ownOffer: 'What you offer',
    ownOfferAmount: 'How much of it',
    ownOfferUnit: 'How much of it',
    sessionLength: 'How long each time',
    sessionLengthUnit: 'How long each time',
    sessions: 'How many times',
    message: 'Message'
  };
  const offering = $derived(data.offering);
  const titles = { lend: 'Ask to borrow', gift: 'Ask for this', trade: 'Offer a trade', service: 'Ask for this service' } as const;
</script>

<svelte:head><title>{titles[offering.type]}: {offering.title} · wunan</title></svelte:head>

<section class="grid max-w-2xl gap-6">
  <div class="grid gap-1">
    <div class="flex items-start justify-between gap-3">
      <h1 class="text-2xl font-semibold">{titles[offering.type]}</h1>
      <HelpLink topic="proposals" label="Help with proposals" />
    </div>
    <p class="text-muted-foreground">
      <a href="/offerings/{offering.id}">{offering.title}</a> from {offering.owner.displayName}{#if amountLine(offering)} · {amountLine(offering)}{/if}
    </p>
  </div>
  {#if form?.error}<Notice kind="error"><p>{form.error}</p><FieldProblems fields={form.fields} {labels} /></Notice>{/if}

  {#if data.chooseFrom.length}
    <!-- Which of the member's requests is this for? Linked to several (003 FR-017), or not linked yet
         but one of theirs is open and could be fulfilled by it (FR-017a). -->
    <form method="GET" class="grid gap-4 rounded-lg border bg-card p-4">
      <fieldset class="grid gap-2">
        <legend class="font-medium">{data.askIfForRequest ? 'Is this for one of your requests?' : 'Which request is this for?'}</legend>
        {#if data.askIfForRequest}
          <p class="text-sm text-muted-foreground">If it is, the proposal starts from your request, and your request closes when it's accepted.</p>
        {/if}
        {#each data.chooseFrom as choice, index (choice.id)}
          <label class="flex min-h-11 items-center gap-3">
            <input type="radio" name="request" value={choice.id} checked={!data.askIfForRequest && index === 0} required class="size-5 accent-primary" />
            {data.askIfForRequest ? `Yes, for my request “${choice.title}”` : choice.title}
          </label>
        {/each}
        {#if data.askIfForRequest}
          <label class="flex min-h-11 items-center gap-3">
            <input type="radio" name="request" value="none" required class="size-5 accent-primary" />
            No, it's not for a request
          </label>
        {/if}
      </fieldset>
      <div><Button type="submit">Continue</Button></div>
    </form>
  {:else}
    {#if data.request}
      <InfoNote>This is for your request: <a href="/requests/{data.request.id}">{data.request.title}</a>. When it's accepted, your request closes.</InfoNote>
    {/if}
    <form method="POST" class="grid gap-6">
      {#if data.request}<input type="hidden" name="requestId" value={data.request.id} />{/if}
      {#if data.linkFirst}<input type="hidden" name="linkFirst" value="yes" />{/if}
      <ProposalFields {offering} values={form?.values ?? data.prefill} fields={form?.fields ?? {}} withMessage />
      <div><Button type="submit">Send proposal</Button></div>
    </form>
  {/if}
</section>
