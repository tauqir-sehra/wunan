<script lang="ts">
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
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
    <h1 class="text-2xl font-semibold sm:text-3xl">Agreements</h1>
    <HelpLink topic="agreements" label="Help with agreements" />
  </div>
  {#if data.agreements.length === 0}
    <p class="text-muted-foreground">
      No agreements yet. When you agree to share something, it's recorded here.
    </p>
  {/if}
  {#each groups as group (group.key)}
    {@const items = data.agreements.filter((a) => a.group === group.key)}
    {#if items.length}
      <section class="grid gap-3" aria-labelledby="group-{group.key}">
        <h2 id="group-{group.key}" class="text-xl font-semibold">{group.heading}</h2>
        <ul class="grid gap-4 md:grid-cols-2">
          {#each items as agreement (agreement.id)}
            <li>
              <a
                href="/agreements/{agreement.id}"
                class="flex h-full items-center gap-3 surface p-5 text-foreground no-underline hover:border-input"
              >
                <span class="grid min-w-0 flex-1 gap-1">
                  <span class="font-medium underline underline-offset-[3px]"
                    >{agreementSentence(agreement)}</span
                  >
                  <span class="text-sm text-muted-foreground">
                    Agreed {new Date(agreement.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long'
                    })}{#if agreement.returnedAt}
                      · Returned{:else if agreement.overdue}
                      · It was due back already{/if}
                  </span>
                </span>
                <ChevronRightIcon
                  class="size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/each}
</section>
