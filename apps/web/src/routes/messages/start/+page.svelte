<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';

  let { data, form } = $props();
</script>

<svelte:head><title>Message {data.other.displayName} · wunan</title></svelte:head>

<section class="grid max-w-xl gap-5">
  <h1 class="text-2xl font-semibold">
    {`Message ${data.other.displayName}${data.listing ? ` about ${data.listing.title}` : ''}`}
  </h1>
  {#if form?.error}<Notice kind="error"><p>{form.error}</p></Notice>{/if}
  <form method="POST" class="grid gap-4">
    <input type="hidden" name="memberId" value={data.other.id} />
    {#if data.listing}<input type="hidden" name="listingId" value={data.listing.id} />{/if}
    <FormField
      label="Your message"
      name="body"
      multiline
      required
      maxlength={4000}
      hint="For example, ask if it's still available and when would suit them."
      value={form?.values?.body}
      error={form?.fields?.body}
    />
    <div><Button type="submit">Send</Button></div>
  </form>
</section>
