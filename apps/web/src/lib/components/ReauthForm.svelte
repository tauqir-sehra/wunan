<!--
  Shown in place of the page when a form was sent after the member's sign-in ran out. Their input
  is carried along in hidden fields, so signing in here also sends what they typed.
-->
<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import type { Reauth } from '#lib/form-action.ts';

  let { reauth }: { reauth: Reauth } = $props();
</script>

<svelte:head><title>Please sign in again · wunan</title></svelte:head>

<section class="mx-auto grid max-w-md gap-5" aria-labelledby="reauth-title">
  <h1 id="reauth-title" class="text-2xl font-semibold">Please sign in again</h1>
  <p>
    Your sign-in ran out. What you typed is kept, and it will be sent as soon as you sign in.
  </p>
  {#if reauth.hadFiles}
    <Notice kind="info"><p>Please choose your photos again after signing in.</p></Notice>
  {/if}
  {#if reauth.error}
    <Notice kind="error"><p>{reauth.error}</p></Notice>
  {/if}
  <form method="POST" action={reauth.action} class="grid gap-4">
    {#each reauth.fields as [name, value], index (index)}
      <input type="hidden" {name} {value} />
    {/each}
    <FormField label="Email" name="_reauth_email" type="email" autocomplete="email" required value={reauth.email} />
    <FormField label="Password" name="_reauth_password" type="password" autocomplete="current-password" required />
    <Button type="submit">Sign in and send</Button>
  </form>
</section>
