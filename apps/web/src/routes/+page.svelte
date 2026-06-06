<!-- Home: search, browse by kind, and share something. Quiet counts arrive with US4 and US5. -->
<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import Notice from '#lib/components/Notice.svelte';
  import { typeHints, typeLabels } from '#lib/format.ts';

  let { data } = $props();
  const welcome = $derived(page.url.searchParams.has('welcome'));
</script>

<svelte:head><title>Home · wunan</title></svelte:head>

<section class="grid gap-8">
  {#if welcome}
    <Notice><p>Welcome to wunan. You're now a member.</p></Notice>
  {/if}
  <div class="grid gap-1">
    <h1 class="text-2xl font-semibold">Hello, {data.member?.displayName}</h1>
    <p class="text-muted-foreground">What would you like to find or share today?</p>
  </div>

  {#if data.summary && (data.summary.proposalsWithNews || data.summary.unseenFlags || data.summary.agreementsNeedingAttention)}
    <ul class="grid gap-1 rounded-lg border bg-card p-4" aria-label="Things for you">
      {#if data.summary.proposalsWithNews}
        <li><a href="/proposals">{data.summary.proposalsWithNews} {data.summary.proposalsWithNews === 1 ? 'proposal has' : 'proposals have'} something new</a></li>
      {/if}
      {#if data.summary.agreementsNeedingAttention}
        <li><a href="/agreements">{data.summary.agreementsNeedingAttention} {data.summary.agreementsNeedingAttention === 1 ? 'agreement needs' : 'agreements need'} a look</a></li>
      {/if}
      {#if data.summary.unseenFlags}
        <li><a href="/my-listings">{data.summary.unseenFlags} new {data.summary.unseenFlags === 1 ? 'request' : 'requests'} about your listings</a></li>
      {/if}
    </ul>
  {/if}

  <form method="GET" action="/listings" role="search" class="grid gap-2">
    <Label for="home-search">Search what's shared</Label>
    <div class="flex flex-wrap gap-3">
      <Input id="home-search" name="q" type="search" class="max-w-md flex-1" placeholder="For example: drill, rice, haircut" />
      <Button type="submit">Search</Button>
    </div>
  </form>

  <section class="grid gap-3" aria-labelledby="browse-heading">
    <h2 id="browse-heading" class="text-lg font-semibold">Browse by kind</h2>
    <ul class="grid gap-3 sm:grid-cols-2">
      {#each Object.entries(typeLabels) as [type, label] (type)}
        <li>
          <a href="/listings?type={type}" class="grid gap-1 rounded-xl border bg-card p-4 text-foreground no-underline hover:bg-accent">
            <span class="font-semibold underline underline-offset-2">{label}</span>
            <span class="text-sm text-muted-foreground">{typeHints[type as keyof typeof typeHints]}</span>
          </a>
        </li>
      {/each}
    </ul>
  </section>

  <section class="grid gap-3" aria-labelledby="share-heading">
    <h2 id="share-heading" class="text-lg font-semibold">Share something</h2>
    <p class="text-muted-foreground">Lend a tool, give away extra food, offer a skill.</p>
    <div class="flex flex-wrap gap-x-5 gap-y-2">
      <a href="/listings/new" class="inline-flex min-h-11 items-center">Create a listing</a>
      <a href="/my-listings" class="inline-flex min-h-11 items-center">Your listings</a>
      <a href="/invitations" class="inline-flex min-h-11 items-center">Invite someone you trust</a>
      <a href="/members/{data.member?.id}" class="inline-flex min-h-11 items-center">Your profile</a>
    </div>
  </section>
</section>
