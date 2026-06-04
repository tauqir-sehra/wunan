<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import SettingsNav from '#lib/components/SettingsNav.svelte';

  let { data, form } = $props();

  // After an error, show what the member typed; otherwise what's saved.
  const values = $derived(form?.values ?? {});
  const savedText: Record<string, string> = {
    profile: 'Your profile is saved.',
    contact: 'Your contact details are saved.',
    password: 'Your password is changed. Other devices will need to sign in again.'
  };
</script>

<svelte:head><title>Settings · wunan</title></svelte:head>

<section class="grid gap-8">
  <div class="grid gap-4">
    <h1 class="text-2xl font-semibold">Settings</h1>
    <SettingsNav />
  </div>

  {#if form?.saved}
    <Notice><p>{savedText[form.saved]}</p></Notice>
  {:else if form?.error}
    <Notice kind="error"><p>{form.error}</p></Notice>
  {/if}

  <section class="grid max-w-xl gap-4" aria-labelledby="profile-heading">
    <h2 id="profile-heading" class="text-xl font-semibold">Your profile</h2>
    <p class="text-muted-foreground">
      Other members see this on <a href="/members/{data.me.id}">your profile</a>.
    </p>
    <form method="POST" action="?/profile" class="grid gap-4">
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
      <div><Button type="submit">Save profile</Button></div>
    </form>
  </section>

  <section class="grid max-w-xl gap-4" aria-labelledby="contact-heading">
    <h2 id="contact-heading" class="text-xl font-semibold">Contact details</h2>
    <p class="text-muted-foreground">
      Only shared when you choose to share it in a conversation, and only with that person.
    </p>
    <form method="POST" action="?/contact" class="grid gap-4">
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
      <div><Button type="submit" variant="outline">Save contact details</Button></div>
    </form>
  </section>

  <section class="grid max-w-xl gap-4" aria-labelledby="password-heading">
    <h2 id="password-heading" class="text-xl font-semibold">Password</h2>
    <form method="POST" action="?/password" class="grid gap-4">
      <FormField
        label="Current password"
        name="currentPassword"
        type="password"
        autocomplete="current-password"
        required
        error={form?.fields?.currentPassword}
      />
      <FormField
        label="New password"
        name="newPassword"
        type="password"
        autocomplete="new-password"
        required
        minlength={10}
        maxlength={128}
        hint="At least 10 characters."
        error={form?.fields?.newPassword}
      />
      <div><Button type="submit" variant="outline">Change password</Button></div>
    </form>
  </section>
</section>
