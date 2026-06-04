<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '#lib/components/ui/button/index.ts';
  import Notice from '#lib/components/Notice.svelte';
  import { agreementSentence, confirmationText, day } from '#lib/format.ts';

  let { data, form } = $props();
  const a = $derived(data.agreement);
  const doneText: Record<string, string> = {
    confirm: 'Thank you. The agreement is confirmed.',
    dispute: 'The owner has been told it needs a correction. You can talk it over in your messages.',
    returned: 'Marked as returned. The listing is available again.',
    cancel: 'The agreement is cancelled and the listing is back as it was.'
  };
  const other = $derived(a.myRole === 'owner' ? a.otherMember : a.owner);
</script>

<svelte:head><title>Agreement · wunan</title></svelte:head>

<section class="grid max-w-2xl gap-6">
  {#if page.url.searchParams.has('recorded') && !form}
    <Notice><p>The agreement is recorded and the listing is updated.</p></Notice>
  {/if}
  {#if form?.done}<Notice><p>{doneText[form.done]}</p></Notice>{/if}
  {#if form?.error}<Notice kind="error"><p>{form.error}</p></Notice>{/if}

  <header class="grid gap-2">
    <h1 class="text-2xl font-semibold">Agreement</h1>
    <p class="text-lg">{agreementSentence(a)}</p>
    <p class="text-muted-foreground">
      {confirmationText[a.confirmation]} · Recorded {new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
    </p>
    {#if a.outcome === 'lent'}
      <p>
        {#if a.returnedAt}Returned on {new Date(a.returnedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.
        {:else if a.overdue}The return date ({day(a.returnDue ?? '')}) has passed. No rush: talk it over, and the owner can mark it returned when it's back.
        {:else if a.returnDue}Back by {day(a.returnDue)}.{/if}
      </p>
    {/if}
    {#if a.note}<p class="whitespace-pre-line rounded-lg bg-muted p-3">{a.note}</p>{/if}
    <p><a href="/listings/{a.listing.id}">{a.listing.title}</a> · with <a href="/members/{other.id}">{other.displayName}</a></p>
  </header>

  {#if a.myRole === 'other' && a.confirmation === 'pending'}
    <section class="grid gap-3 rounded-lg border border-input bg-card p-4" aria-labelledby="answer-heading">
      <h2 id="answer-heading" class="font-semibold">Is this right?</h2>
      <div class="flex flex-wrap gap-3">
        <form method="POST" action="?/confirm"><Button type="submit">Yes, that's right</Button></form>
        <form method="POST" action="?/dispute"><Button type="submit" variant="outline">It needs a correction</Button></form>
      </div>
    </section>
  {/if}

  {#if a.myRole === 'owner'}
    <div class="flex flex-wrap gap-3">
      {#if a.outcome === 'lent' && !a.returnedAt && a.confirmation !== 'cancelled'}
        <form method="POST" action="?/returned"><Button type="submit">Mark returned</Button></form>
      {/if}
      {#if a.confirmation === 'pending' && !form?.confirmCancel}
        <form method="POST" action="?/cancel"><Button type="submit" variant="outline">Cancel this agreement</Button></form>
      {/if}
    </div>
    {#if form?.confirmCancel}
      <form method="POST" action="?/cancel" class="grid gap-3 rounded-lg border border-input bg-card p-4">
        <input type="hidden" name="confirmed" value="yes" />
        <p>Cancel this agreement? The listing goes back to how it was before, and {a.otherMember.displayName} is told.</p>
        <div class="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="destructive">Yes, cancel it</Button>
          <a href="/agreements/{a.id}">Keep it</a>
        </div>
      </form>
    {/if}
  {/if}

  {#if a.reports?.length}
    <section class="grid gap-2" aria-labelledby="help-heading">
      <h2 id="help-heading" class="text-lg font-semibold">Asking for help</h2>
      <ul class="grid gap-2">
        {#each a.reports as report (report.id)}
          <li>
            <a href="/reports/{report.id}">{report.status === 'open' ? 'Open request for help' : 'Settled'}</a>
            {#if report.outcomeNote}<span class="text-muted-foreground"> — {report.outcomeNote}</span>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if a.myRole !== 'mediator' && !a.reports?.some((r) => r.status === 'open')}
    <p class="text-muted-foreground">
      Something went wrong? <a href="/agreements/{a.id}/report">Ask for help</a> from the invite chain.
    </p>
  {/if}

  <p><a href="/agreements">All agreements</a></p>
</section>
