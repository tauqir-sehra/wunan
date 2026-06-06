<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import FormField from '#lib/components/FormField.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import SettingsNav from '#lib/components/SettingsNav.svelte';
  import { when } from '#lib/format.ts';

  let { data, form } = $props();
</script>

<svelte:head><title>Leave wunan · Settings · wunan</title></svelte:head>

<section class="grid gap-8">
  <div class="grid gap-4">
    <h1 class="text-2xl font-semibold">Settings</h1>
    <HelpLink topic="your-data" label="Help with your data and leaving" />
    <SettingsNav />
  </div>

  {#if form?.error && !form?.fields?.password}
    <Notice kind="error"><p>{form.error}</p></Notice>
  {/if}

  <section class="grid max-w-xl gap-4" aria-labelledby="leave-heading">
    <h2 id="leave-heading" class="text-xl font-semibold">Leave wunan</h2>
    <p>If you delete your account:</p>
    <ul class="grid list-disc gap-1 pl-6">
      <li>Your email, password, bio, contact details and devices are deleted.</li>
      <li>Your listings and their photos are deleted.</li>
      <li>
        Your name stays, shown as "(no longer a member)", so the people you invited, and the
        agreements and conversations other members had with you, still make sense.
      </li>
      <li>Contact details you shared in conversations are removed.</li>
      <li>Invitation links you made and nobody used yet stop working.</li>
    </ul>
    <p>
      This can't be undone. If you might want your data,
      <a href="/settings/export">download it first</a>.
    </p>
  </section>

  {#if data.openLoans.length > 0}
    <section class="grid max-w-xl gap-4" aria-labelledby="loans-heading">
      <h2 id="loans-heading" class="text-xl font-semibold">Things still lent out</h2>
      <p>
        These loans haven't been marked as returned. You may want to sort them out with the other
        person first. The agreements stay visible to them after you leave.
      </p>
      <ul class="grid gap-2">
        {#each data.openLoans as loan (loan.id)}
          <li class="rounded-lg border bg-card p-4">
            <a href="/agreements/{loan.id}" class="font-medium">{loan.listing.title}</a>
            <span class="block text-sm text-muted-foreground">
              {loan.myRole === 'owner'
                ? `Lent to ${loan.otherMember.displayName}`
                : `Borrowed from ${loan.owner.displayName}`}{loan.loanEndsAt
                ? `, due back ${when(loan.loanEndsAt)}`
                : ''}
            </span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="grid max-w-xl gap-4" aria-labelledby="confirm-heading">
    <h2 id="confirm-heading" class="text-xl font-semibold">Delete your account</h2>
    <form method="POST" class="grid gap-4">
      <FormField
        label="Your password"
        name="password"
        type="password"
        autocomplete="current-password"
        required
        hint="To make sure it's you."
        error={form?.fields?.password}
      />
      <div><Button type="submit" variant="destructive">Delete my account</Button></div>
    </form>
  </section>
</section>
