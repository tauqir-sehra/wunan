<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';

  let { form } = $props();
</script>

<svelte:head><title>Sign in · wunan</title></svelte:head>

<section class="mx-auto grid max-w-md gap-5">
  <h1 class="text-2xl font-semibold">Sign in</h1>

  {#if form?.resent}
    <Notice>
      <p>If that account is waiting for confirmation, we've sent a new link. Please check your email.</p>
    </Notice>
  {:else if form?.notConfirmed}
    <Notice kind="info">
      <p>{form.error}</p>
      <form method="POST" action="?/resendConfirmation">
        <input type="hidden" name="email" value={form.email} />
        <Button type="submit" variant="outline" size="sm">Send it again</Button>
      </form>
    </Notice>
  {:else if form?.error}
    <Notice kind="error"><p>{form.error}</p></Notice>
  {/if}

  <form method="POST" action="?/signIn" class="grid gap-4">
    <FormField label="Email" name="email" type="email" autocomplete="email" required value={form?.email} />
    <FormField label="Password" name="password" type="password" autocomplete="current-password" required />
    <Button type="submit">Sign in</Button>
  </form>

  <p><a href="/password-reset">Forgot your password?</a></p>
  <p class="text-muted-foreground">
    New here? wunan is invite-only. Ask a member you know to send you an invitation link.
  </p>
</section>
