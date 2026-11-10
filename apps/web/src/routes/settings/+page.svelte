<script lang="ts">
  import FieldProblems from '#lib/components/FieldProblems.svelte';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';

  let { data, form } = $props();
  // After an error, show what the member typed; otherwise what's saved.
  const values = $derived<Record<string, string>>(form?.values ?? {});
  const labels: Record<string, string> = {
    displayName: 'Your name',
    bio: 'About you',
    sharePhone: 'Phone number',
    shareEmail: 'Email to share',
    currentPassword: 'Current password',
    newPassword: 'New password'
  };
</script>

<svelte:head><title>Settings · wunan</title></svelte:head>

{#if form?.saved}
  <Notice>
    <p>
      Your settings are saved.{#if form.passwordChanged}
        Your password is changed; other devices will need to sign in again.{/if}
    </p>
  </Notice>
{:else if form?.error}
  <Notice kind="error"
    ><p>{form.error}</p>
    <FieldProblems fields={form.fields} {labels} /></Notice
  >
{/if}

<form method="POST" class="grid max-w-2xl gap-6">
  <section class="grid gap-4 surface p-6" aria-labelledby="profile-heading">
    <h2 id="profile-heading" class="text-xl font-semibold">Your profile</h2>
    <p class="text-muted-foreground">
      Other members see this on <a href="/members/{data.me.id}">your profile</a>.
    </p>
    <FormField
      label="Your name"
      name="displayName"
      required
      maxlength={60}
      value={values.displayName ?? data.me.displayName}
      error={form?.fields?.displayName}
    />
    <FormField
      label="About you"
      name="bio"
      multiline
      optional
      maxlength={500}
      hint="A sentence or two, for example what you like to share or where you are."
      value={values.bio ?? data.me.bio}
      error={form?.fields?.bio}
    />
  </section>

  <section class="grid gap-4 surface p-6" aria-labelledby="contact-heading">
    <h2 id="contact-heading" class="text-xl font-semibold">Contact details</h2>
    <p class="text-muted-foreground">
      Only shared when you choose to share it in a conversation, and only with that person.
    </p>
    <FormField
      label="Phone number"
      name="sharePhone"
      type="tel"
      autocomplete="tel"
      optional
      value={values.sharePhone ?? data.contact.sharePhone}
      error={form?.fields?.sharePhone}
    />
    <FormField
      label="Email to share"
      name="shareEmail"
      type="email"
      optional
      hint="Can be different from the email you sign in with."
      value={values.shareEmail ?? data.contact.shareEmail}
      error={form?.fields?.shareEmail}
    />
  </section>

  <section class="grid gap-4 surface p-6" aria-labelledby="password-heading">
    <h2 id="password-heading" class="text-xl font-semibold">Password</h2>
    <p class="text-muted-foreground">Leave these empty to keep your password.</p>
    <FormField
      label="Current password"
      name="currentPassword"
      type="password"
      autocomplete="current-password"
      optional
      error={form?.fields?.currentPassword}
    />
    <FormField
      label="New password"
      name="newPassword"
      type="password"
      autocomplete="new-password"
      optional
      minlength={10}
      maxlength={128}
      hint="At least 10 characters."
      error={form?.fields?.newPassword}
    />
  </section>

  <div><Button type="submit">Save</Button></div>
</form>
