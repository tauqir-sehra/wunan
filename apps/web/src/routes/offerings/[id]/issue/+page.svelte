<script lang="ts">
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';

  let { data, form } = $props();
  const owner = $derived(data.offering.owner.displayName);
</script>

<svelte:head><title>Raise an issue · wunan</title></svelte:head>

<section class="grid max-w-xl gap-5">
  <h1 class="text-2xl font-semibold">Raise an issue with {owner}</h1>
  <p class="text-muted-foreground">
    About <a href="/offerings/{data.offering.id}">{data.offering.title}</a>. For example, to ask them to update or take it down. It goes only
    to {owner}, and the offering stays as it is.
  </p>
  {#if form?.error}<Notice kind="error"><p>{form.error}</p></Notice>{/if}
  <form method="POST" class="grid gap-4">
    <FormField label="What would you like to ask?" name="request" multiline required maxlength={500} value={form?.values?.request} error={form?.fields?.request} />
    <div><Button type="submit">Send to {owner}</Button></div>
  </form>
</section>
