<!-- Home. Search and quiet counts arrive with US3–US5. -->
<script lang="ts">
  import { page } from '$app/state';
  import Notice from '#lib/components/Notice.svelte';

  let { data } = $props();
  const welcome = $derived(page.url.searchParams.has('welcome'));
</script>

<svelte:head><title>Home · wunan</title></svelte:head>

<section class="grid gap-4">
  {#if welcome}
    <Notice><p>Welcome to wunan. You're now a member.</p></Notice>
  {/if}
  <h1 class="text-2xl font-semibold">Hello, {data.member?.displayName}</h1>
  <p class="text-muted-foreground">This is your community's sharing space.</p>
  <ul class="grid gap-2">
    <li><a href="/members/{data.member?.id}">Your profile</a></li>
    <li><a href="/invitations">Invite someone you trust</a></li>
  </ul>
</section>
