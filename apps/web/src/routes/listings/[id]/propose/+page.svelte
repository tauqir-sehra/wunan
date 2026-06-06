<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
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
  const listing = $derived(data.listing);
  const titles = { lend: 'Ask to borrow', gift: 'Ask for this', trade: 'Offer a trade', service: 'Ask for this service' } as const;
</script>

<svelte:head><title>{titles[listing.type]}: {listing.title} · wunan</title></svelte:head>

<section class="grid max-w-2xl gap-6">
  <div class="grid gap-1">
    <div class="flex items-start justify-between gap-3">
      <h1 class="text-2xl font-semibold">{titles[listing.type]}</h1>
      <HelpLink topic="proposals" label="Help with proposals" />
    </div>
    <p class="text-muted-foreground">
      <a href="/listings/{listing.id}">{listing.title}</a> from {listing.owner.displayName}{#if amountLine(listing)} · {amountLine(listing)}{/if}
    </p>
  </div>
  {#if form?.error}<Notice kind="error"><p>{form.error}</p><FieldProblems fields={form.fields} {labels} /></Notice>{/if}

  <form method="POST" class="grid gap-6">
    <ProposalFields {listing} values={form?.values ?? {}} fields={form?.fields ?? {}} withMessage />
    <div><Button type="submit">Send proposal</Button></div>
  </form>
</section>
