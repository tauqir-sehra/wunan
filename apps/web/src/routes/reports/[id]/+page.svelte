<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import { page } from '$app/state';
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';

  let { data, form } = $props();
  const r = $derived(data.report);
  const step = $derived(
    r.escalationLevel === 'founders'
      ? 'The founding members are helping. This is the last step.'
      : r.escalationLevel === 'inviters_inviter'
        ? 'People further up the invite chain are helping.'
        : 'The person who invited them is helping.'
  );
</script>

<svelte:head><title>Asking for help · wunan</title></svelte:head>

<section class="grid max-w-2xl gap-6">
  {#if page.url.searchParams.has('asked') && !form}
    <Notice
      ><p>
        Your request for help was sent. You can talk it over in the shared conversation.
      </p></Notice
    >
  {/if}
  {#if form?.done === 'escalate'}<Notice
      ><p>More help has been asked for. They've joined the conversation.</p></Notice
    >{/if}
  {#if form?.done === 'resolve'}<Notice
      ><p>Marked as settled. The note is kept with the agreement.</p></Notice
    >{/if}
  {#if form?.error}<Notice kind="error"><p>{form.error}</p></Notice>{/if}

  <header class="grid gap-2">
    <h1 class="text-2xl font-semibold">Asking for help: {r.listingTitle}</h1>
    <HelpLink topic="asking-for-help" label="How asking for help works" />
    <p class="text-muted-foreground">
      {r.reporter.displayName} asked for help with {r.reportedMember.displayName} ·
      {r.status === 'open' ? 'Still open' : 'Settled'}
    </p>
  </header>

  <p class="rounded-lg bg-muted p-4 whitespace-pre-line">{r.description}</p>

  <section class="grid gap-2" aria-labelledby="helping-heading">
    <h2 id="helping-heading" class="text-lg font-semibold">Who is helping</h2>
    <p>{r.mediators.map((m) => m.displayName).join(', ') || 'No one yet'}</p>
    <p class="text-muted-foreground">{step}</p>
    <div><Button href="/messages/{r.conversationId}">Open the shared conversation</Button></div>
  </section>

  {#if r.status === 'resolved'}
    <section class="grid gap-1 rounded-lg border bg-card p-4" aria-labelledby="settled-heading">
      <h2 id="settled-heading" class="font-semibold">How it was settled</h2>
      <p class="whitespace-pre-line">{r.outcomeNote}</p>
    </section>
  {:else}
    <p class="text-muted-foreground">
      There is no deadline. A request can stay open as long as it needs to, and nobody is ever
      removed or penalised because of it.
    </p>
    {#if r.canEscalate}
      <section class="grid gap-2" aria-labelledby="more-help-heading">
        <h2 id="more-help-heading" class="text-lg font-semibold">Need more help?</h2>
        <p class="text-muted-foreground">
          {r.escalationLevel === 'inviter'
            ? 'This asks the next person up the invite chain to join.'
            : 'This asks the founding members to join. It is the last step.'}
        </p>
        <form method="POST" action="?/escalate">
          <Button type="submit" variant="outline">Ask for more help</Button>
        </form>
      </section>
    {/if}
    {#if r.canResolve}
      <section class="grid gap-2" aria-labelledby="settle-heading">
        <h2 id="settle-heading" class="text-lg font-semibold">Settled?</h2>
        <form method="POST" action="?/resolve" class="grid gap-3">
          <FormField
            label="How was it settled?"
            name="outcomeNote"
            multiline
            required
            maxlength={1000}
            hint="A sentence is enough, for example “The drill came back on Sunday.”"
            value={form?.values?.outcomeNote}
            error={form?.fields?.outcomeNote}
          />
          <div><Button type="submit" variant="outline">Mark as settled</Button></div>
        </form>
      </section>
    {/if}
  {/if}

  <p><a href="/agreements/{r.agreementId}">Back to the agreement</a></p>
</section>
