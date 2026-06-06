<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import ListingCard from '#lib/components/ListingCard.svelte';
  import PlusIcon from '@lucide/svelte/icons/plus';

  let { data } = $props();
  const groups = [
    { status: 'available', heading: 'Available' },
    { status: 'paused', heading: 'Paused' },
    { status: 'closed', heading: 'Closed' }
  ] as const;
</script>

<svelte:head><title>My listings · wunan</title></svelte:head>

<section class="grid gap-6">
  <div class="flex items-start justify-between gap-3">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <h1 class="text-2xl font-semibold">My listings</h1>
      <Button href="/listings/new" variant="outline" size="sm" class="whitespace-normal"><PlusIcon class="size-4" aria-hidden="true" />Add something to share</Button>
    </div>
    <HelpLink topic="listing" label="Help with your listings" />
  </div>

  {#if data.listings.length === 0}
    <p class="text-muted-foreground">
      You haven't listed anything yet. When you do, it shows up here.
    </p>
  {/if}

  {#each groups as group (group.status)}
    {@const items = data.listings.filter((l) => l.status === group.status)}
    {#if items.length}
      <section class="grid gap-3" aria-labelledby="group-{group.status}">
        <h2 id="group-{group.status}" class="text-xl font-semibold">{group.heading}</h2>
        <ul class="grid gap-3">
          {#each items as listing (listing.id)}
            <li class="grid gap-1">
              <ListingCard {listing} showOwner={false} />
              {#if listing.unseenFlags}
                <p class="text-sm">
                  <a href="/listings/{listing.id}"
                    >{listing.unseenFlags} new {listing.unseenFlags === 1
                      ? 'request'
                      : 'requests'}</a
                  >
                </p>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/each}
</section>
