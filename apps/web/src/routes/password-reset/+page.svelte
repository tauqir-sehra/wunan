<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';

  let { form } = $props();
</script>

<svelte:head><title>Reset your password · wunan</title></svelte:head>

<section class="mx-auto grid max-w-md gap-5">
  <h1 class="text-2xl font-semibold sm:text-3xl">Reset your password</h1>
  {#if form?.sent}
    <Notice>
      <p>If that email is registered, we've sent a link. It works for one hour.</p>
    </Notice>
    <p><a href="/sign-in">Back to sign in</a></p>
  {:else}
    <p>Enter the email you use for wunan and we'll send you a link to choose a new password.</p>
    <form method="POST" class="grid gap-4">
      <FormField label="Email" name="email" type="email" autocomplete="email" required />
      <Button type="submit">Send the link</Button>
    </form>
    <p><a href="/sign-in">Back to sign in</a></p>
  {/if}
</section>
