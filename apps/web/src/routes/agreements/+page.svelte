<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import { agreementSentence } from '#lib/format.ts';

  let { data } = $props();
  const groups = [
    { key: 'lent', heading: 'You lent' },
    { key: 'borrowed', heading: 'You borrowed' },
    { key: 'given', heading: 'You gave or traded' },
    { key: 'provided', heading: 'You provided' },
    { key: 'received', heading: 'You received' }
  ] as const;
</script>

<svelte:head><title>Agreements · wunan</title></svelte:head>

<section class="grid gap-6">
  <div class="flex items-start justify-between gap-3">
    <h1 class="text-2xl font-semibold">Agreements</h1>
    <HelpLink topic="agreements" label="Help with agreements" />
  </div>
  {#if data.agreements.length === 0}
    <p class="text-muted-foreground">No agreements yet. When you agree to share something, it's recorded here.</p>
  {/if}
  {#each groups as group (group.key)}
    {@const items = data.agreements.filter((a) => a.group === group.key)}
    {#if items.length}
      <section class="grid gap-3" aria-labelledby="group-{group.key}">
        <h2 id="group-{group.key}" class="text-xl font-semibold">{group.heading}</h2>
        <ul class="grid gap-3">
          {#each items as agreement (agreement.id)}
            <li>
              <a href="/agreements/{agreement.id}" class="grid gap-1 rounded-xl border bg-card p-4 text-foreground no-underline hover:bg-accent">
                <span class="underline underline-offset-2">{agreementSentence(agreement)}</span>
                <span class="text-sm text-muted-foreground">
                  Agreed {new Date(agreement.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}{#if agreement.returnedAt} · Returned{:else if agreement.overdue} · It was due back already{/if}
                </span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/each}
</section>
