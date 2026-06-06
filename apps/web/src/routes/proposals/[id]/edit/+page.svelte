<script lang="ts">
  import FieldProblems from '#lib/components/FieldProblems.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import ProposalFields from '#lib/components/ProposalFields.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';

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
</script>

<svelte:head><title>Change your proposal · wunan</title></svelte:head>

<section class="grid max-w-2xl gap-6">
  <div class="grid gap-1">
    <h1 class="text-2xl font-semibold">Change your proposal</h1>
    <p class="text-muted-foreground">
      For <a href="/offerings/{data.offering.id}">{data.offering.title}</a> ·
      <a href="/proposals/{data.proposal.id}">Back to the proposal</a>
    </p>
  </div>
  {#if form?.error}<Notice kind="error"
      ><p>{form.error}</p>
      <FieldProblems fields={form.fields} {labels} /></Notice
    >{/if}
  <form method="POST" class="grid gap-6">
    <ProposalFields
      offering={data.offering}
      values={form?.values ?? data.values}
      fields={form?.fields ?? {}}
    />
    <p class="text-sm text-muted-foreground">
      {data.offering.owner.displayName} sees each change in your messages.
    </p>
    <div><Button type="submit">Save changes</Button></div>
  </form>
</section>
