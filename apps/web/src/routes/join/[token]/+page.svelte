<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';

  let { data, form } = $props();
</script>

<svelte:head><title>Join wunan</title></svelte:head>

<section class="mx-auto grid max-w-md gap-5">
  {#if !data.valid}
    <h1 class="text-2xl font-semibold">This invitation can't be used</h1>
    <p>{data.message}</p>
  {:else if form?.sent}
    <h1 class="text-2xl font-semibold">Check your email</h1>
    <p>We've emailed a link to <strong>{form.email}</strong>. The link works for 7 days.</p>
    <p>Open it to finish joining. If you can't find it, check your spam folder.</p>
    {#if form.resent}
      <Notice><p>We've sent the link again.</p></Notice>
    {:else if form.error}
      <Notice kind="error"><p>{form.error}</p></Notice>
    {/if}
    <form method="POST" action="?/resend">
      <input type="hidden" name="email" value={form.email} />
      <Button type="submit" variant="outline">Send it again</Button>
    </form>
    <p><a href={page.url.pathname}>Wrong email? Start again</a></p>
  {:else}
    <h1 class="text-2xl font-semibold">Join {data.inviterName}'s community</h1>
    <p>{data.inviterName} invited you to wunan, a place to share things with people you trust.</p>
    {#if form?.error}
      <Notice kind="error"><p>{form.error}</p></Notice>
    {/if}
    <form method="POST" action="?/join" class="grid gap-5">
      <FormField
        label="Email"
        name="email"
        type="email"
        autocomplete="email"
        required
        hint="Used to sign in and reset your password. Never shown to other members."
        value={form?.values?.email}
        error={form?.fields?.email}
      />
      <FormField
        label="Your name"
        name="displayName"
        autocomplete="name"
        required
        maxlength={60}
        hint="Shown to other members."
        value={form?.values?.displayName}
        error={form?.fields?.displayName}
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autocomplete="new-password"
        required
        minlength={10}
        maxlength={128}
        hint="At least 10 characters. A few words in a row is easy to remember."
        error={form?.fields?.password}
      />
      <div class="grid gap-1.5">
        <label class="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            name="emailNotifications"
            class="mt-0.5 size-6 shrink-0 accent-primary"
            aria-describedby="email-notifications-hint"
            checked={form?.values?.emailNotifications === 'on'}
          />
          <span>Email me when someone messages me or something needs my attention</span>
        </label>
        <p id="email-notifications-hint" class="pl-9 text-sm text-muted-foreground">
          Optional. You can change this any time in Settings.
        </p>
      </div>
      <Button type="submit">Join</Button>
    </form>
  {/if}
</section>
