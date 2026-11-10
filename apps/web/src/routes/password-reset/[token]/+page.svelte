<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';

  let { form } = $props();
</script>

<svelte:head><title>Choose a new password · wunan</title></svelte:head>

<section class="mx-auto grid max-w-md gap-5">
  <h1 class="text-2xl font-semibold sm:text-3xl">Choose a new password</h1>
  {#if form?.done}
    <Notice><p>Your password has been changed. You can sign in with it now.</p></Notice>
    <div><Button href="/sign-in">Sign in</Button></div>
  {:else}
    {#if form?.error}
      <Notice kind="error"><p>{form.error}</p></Notice>
    {/if}
    <form method="POST" class="grid gap-4">
      <FormField
        label="New password"
        name="password"
        type="password"
        autocomplete="new-password"
        hint="At least 10 characters. A few words in a row is easy to remember."
        minlength={10}
        maxlength={128}
        required
      />
      <FormField
        label="Type it again"
        name="confirm"
        type="password"
        autocomplete="new-password"
        error={form?.fields?.confirm}
        required
      />
      <Button type="submit">Save new password</Button>
    </form>
  {/if}
</section>
