<script lang="ts">
  import { page } from '$app/state';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';

  let { form } = $props();
  // Where to go back to afterwards: the page the message is on.
  const back = $derived(page.url.searchParams.get('back') ?? '');
</script>

<svelte:head><title>Raise an issue · wunan</title></svelte:head>

<section class="grid max-w-xl gap-5">
  <h1 class="text-2xl font-semibold sm:text-3xl">Raise an issue about a message</h1>
  <p class="text-muted-foreground">
    For example, to ask its writer to remove it. It goes only to them, and the message stays as it
    is.
  </p>
  {#if form?.error}<Notice kind="error"><p>{form.error}</p></Notice>{/if}
  <form method="POST" class="grid gap-4">
    <input type="hidden" name="back" value={back} />
    <FormField
      label="What would you like to ask?"
      name="request"
      multiline
      required
      maxlength={500}
      value={form?.values?.request}
      error={form?.fields?.request}
    />
    <div><Button type="submit">Send</Button></div>
  </form>
</section>
