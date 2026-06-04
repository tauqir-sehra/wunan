<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import Notice from '#lib/components/Notice.svelte';

  let { data, form } = $props();
  const names = $derived(data.conversation.participants.map((p) => p.displayName).join(', '));
  const nothingSaved = $derived(!data.contact.sharePhone && !data.contact.shareEmail);
</script>

<svelte:head><title>Share contact details · wunan</title></svelte:head>

<section class="grid max-w-xl gap-5">
  <h1 class="text-2xl font-semibold">Share your contact details with {names}</h1>

  {#if nothingSaved}
    <p>You haven't saved a phone number or email to share yet.</p>
    <p><a href="/settings">Add them in Settings</a>, then come back here.</p>
  {:else if form?.review}
    <p>This is exactly what {names} will see in your conversation:</p>
    <div class="rounded-lg border border-input bg-card p-4">
      {#if form.review.phone}<p>Phone: {data.contact.sharePhone}</p>{/if}
      {#if form.review.email}<p>Email: {data.contact.shareEmail}</p>{/if}
    </div>
    <p class="text-muted-foreground">Once shared, it stays in the conversation.</p>
    <form method="POST" action="?/share" class="flex flex-wrap items-center gap-3">
      <input type="hidden" name="phone" value={form.review.phone ? 'yes' : 'no'} />
      <input type="hidden" name="email" value={form.review.email ? 'yes' : 'no'} />
      <Button type="submit">Yes, share it</Button>
      <a href="/messages/{data.conversation.id}/share-contact">Change what to share</a>
    </form>
  {:else}
    {#if form?.error}<Notice kind="error"><p>{form.error}</p></Notice>{/if}
    <form method="POST" action="?/review" class="grid gap-4">
      <fieldset class="grid gap-2">
        <legend class="mb-1 font-medium">What would you like to share?</legend>
        {#if data.contact.sharePhone}
          <label class="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="phone" class="size-6 accent-primary" /> My phone number
          </label>
        {/if}
        {#if data.contact.shareEmail}
          <label class="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="email" class="size-6 accent-primary" /> My email
          </label>
        {/if}
      </fieldset>
      <div><Button type="submit">Review</Button></div>
    </form>
    <p><a href="/messages/{data.conversation.id}">Back to the conversation</a></p>
  {/if}
</section>
