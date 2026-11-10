<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import { onMount } from 'svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import Notice from '#lib/components/Notice.svelte';

  let { data, form } = $props();

  // "Copy link" needs JavaScript; without it the link is shown in a field ready to select.
  let canCopy = $state(false);
  let copied = $state(false);
  onMount(() => (canCopy = Boolean(navigator.clipboard)));

  async function copy(link: string) {
    await navigator.clipboard.writeText(link);
    copied = true;
  }

  const statusText: Record<string, string> = {
    unused: 'Not used yet',
    waiting: 'Someone signed up and is confirming their email',
    used: 'Used',
    expired: 'Expired',
    cancelled: 'Cancelled'
  };
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
</script>

<svelte:head><title>Invitations · wunan</title></svelte:head>

<section class="grid gap-6">
  <div class="grid gap-2">
    <div class="flex items-start justify-between gap-3">
      <h1 class="text-2xl font-semibold sm:text-3xl">Invite someone</h1>
      <HelpLink topic="joining" label="How invitations work" />
    </div>
    <p class="text-muted-foreground">
      Invite people you know and trust. Your name will show on their profile as the person who
      invited them, and you're the first person they can ask for help.
    </p>
  </div>

  {#if form?.created}
    <div class="grid gap-3 surface p-4">
      <p role="status" class="font-medium">Your invitation link is ready. Send it to one person.</p>
      <label for="invite-link" class="text-sm text-muted-foreground">
        This link is shown only once and works for 14 days.
      </label>
      <input
        id="invite-link"
        readonly
        value={form.created.link}
        class="min-h-11 w-full rounded-md border border-input bg-background px-3 font-mono text-sm"
        onfocus={(event) => event.currentTarget.select()}
      />
      {#if canCopy}
        <div>
          <Button variant="outline" onclick={() => copy(form.created.link)}>Copy link</Button>
          {#if copied}<span role="status" class="ml-3">Copied.</span>{/if}
        </div>
      {/if}
    </div>
  {:else}
    <form method="POST" action="?/create">
      <Button type="submit">Create an invitation link</Button>
    </form>
  {/if}

  {#if form?.cancelled}
    <Notice><p>The invitation was cancelled. That link no longer works.</p></Notice>
  {:else if form?.error}
    <Notice kind="error"><p>{form.error}</p></Notice>
  {/if}

  <h2 class="text-xl font-semibold">Your invitations</h2>
  {#if data.invitations.length === 0}
    <p class="text-muted-foreground">You haven't invited anyone yet.</p>
  {:else}
    <ul class="grid gap-3">
      {#each data.invitations as invite (invite.id)}
        <li class="grid gap-2 surface p-4">
          <p>
            <span class="font-medium">{statusText[invite.status]}</span>
            {#if invite.usedBy}
              — <a href="/members/{invite.usedBy.id}">{invite.usedBy.displayName}</a> joined
            {/if}
          </p>
          <p class="text-sm text-muted-foreground">
            Created {date(invite.createdAt)}{#if invite.status === 'unused'}, works until {date(
                invite.expiresAt
              )}{/if}
          </p>
          {#if invite.status === 'unused'}
            {#if form?.confirmCancel === invite.id}
              <form method="POST" action="?/cancel" class="flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={invite.id} />
                <input type="hidden" name="confirmed" value="yes" />
                <span>Cancel this invitation? The link will stop working.</span>
                <Button type="submit" variant="destructive" size="sm">Yes, cancel it</Button>
                <a href="/invitations">Keep it</a>
              </form>
            {:else}
              <form method="POST" action="?/cancel">
                <input type="hidden" name="id" value={invite.id} />
                <Button type="submit" variant="outline" size="sm">Cancel invitation</Button>
              </form>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>
