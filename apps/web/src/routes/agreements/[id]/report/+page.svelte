<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import { agreementSentence } from '#lib/format.ts';

  let { data, form } = $props();
  const a = $derived(data.agreement);
  const other = $derived(a.myRole === 'owner' ? a.otherMember : a.owner);
  const draft = $derived(form?.review ?? form?.values?.description ?? '');
</script>

<svelte:head><title>Ask for help · wunan</title></svelte:head>

<section class="grid max-w-2xl gap-5">
  <h1 class="text-2xl font-semibold">Ask for help</h1>
  <p>{agreementSentence(a)}</p>
  <p class="text-muted-foreground">
    If something went wrong, the person who invited {other.displayName} will be asked to help. You'll
    all talk in one shared conversation. Nobody is removed or penalised, and there is no rush.
  </p>
  {#if form?.error}<Notice kind="error"><p>{form.error}</p></Notice>{/if}

  {#if form?.review !== undefined && form.review !== ''}
    <p>This is what you'll share with {other.displayName} and the person helping:</p>
    <p class="whitespace-pre-line rounded-lg border border-input bg-card p-4">{form.review}</p>
    <form method="POST" action="?/send" class="flex flex-wrap items-center gap-3">
      <input type="hidden" name="description" value={form.review} />
      <Button type="submit">Ask for help</Button>
      <a href="/agreements/{a.id}/report">Change what I wrote</a>
    </form>
  {:else}
    <form method="POST" action="?/review" class="grid gap-4">
      <FormField
        label="What happened?"
        name="description"
        multiline
        required
        maxlength={2000}
        hint="In your own words. For example: “The drill was due back last week and I haven't heard back.”"
        value={draft}
        error={form?.fields?.description}
      />
      <div><Button type="submit">Review</Button></div>
    </form>
  {/if}
</section>
