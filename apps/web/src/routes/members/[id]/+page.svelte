<script lang="ts">
  import { Badge } from '#lib/components/ui/badge/index.ts';

  let { data } = $props();
  const profile = $derived(data.profile);
  const joined = $derived(new Date(profile.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));
  const isMe = $derived(data.member?.id === profile.id);
</script>

<svelte:head><title>{profile.displayName} · wunan</title></svelte:head>

<article class="grid gap-6">
  <header class="grid gap-2">
    <h1 class="text-2xl font-semibold">{profile.displayName}</h1>
    <p class="text-muted-foreground">Joined {joined}</p>
    {#if profile.isFounder}<div><Badge>Founding member</Badge></div>{/if}
  </header>

  {#if profile.bio}<p class="max-w-prose whitespace-pre-line">{profile.bio}</p>{/if}

  <section class="grid gap-2" aria-labelledby="invited-by">
    <h2 id="invited-by" class="text-lg font-semibold">Invited by</h2>
    {#if profile.invitedBy}
      <p><a href="/members/{profile.invitedBy.id}">{profile.invitedBy.displayName}</a></p>
      <p><a href="/members/{profile.id}/chain">See the full invite chain</a></p>
    {:else}
      <p>Founding member — they started this community.</p>
    {/if}
  </section>

  <section class="grid gap-2" aria-labelledby="invited">
    <h2 id="invited" class="text-lg font-semibold">People {isMe ? 'you' : 'they'} invited</h2>
    {#if profile.invitees.length === 0}
      <p class="text-muted-foreground">No one yet.</p>
    {:else}
      <ul class="grid gap-1">
        {#each profile.invitees as invitee (invitee.id)}
          <li><a href="/members/{invitee.id}">{invitee.displayName}</a></li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if isMe}
    <p><a href="/settings">Edit your profile</a> · <a href="/invitations">Invite someone</a></p>
  {/if}
</article>
