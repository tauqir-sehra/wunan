<script lang="ts">
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';

  let { data, form } = $props();
  const names = $derived(data.conversation.participants.map((p) => p.displayName).join(', '));
  const today = new Date().toISOString().slice(0, 10);
</script>

<svelte:head><title>Suggest a time to call · wunan</title></svelte:head>

<section class="grid max-w-xl gap-5">
  <h1 class="text-2xl font-semibold">Suggest a time to call</h1>
  <p class="text-muted-foreground">{names} can accept it. The call itself happens outside wunan.</p>
  {#if form?.error}<Notice kind="error"><p>{form.error}</p></Notice>{/if}
  <form method="POST" class="grid gap-4">
    {#if form?.fields?.proposedTime}<p class="font-medium text-destructive">
        {form.fields.proposedTime}
      </p>{/if}
    <div class="flex flex-wrap gap-4">
      <FormField label="Day" name="date" type="date" min={today} required />
      <FormField label="Time" name="time" type="time" required />
    </div>
    <div><Button type="submit">Suggest this time</Button></div>
  </form>
  <p><a href={data.back}>Back</a></p>
</section>
