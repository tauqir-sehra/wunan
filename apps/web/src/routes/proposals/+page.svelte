<script lang="ts">
  import HelpLink from '#lib/components/HelpLink.svelte';
  import type { ProposalSummary } from '@wunan/shared';

  let { data } = $props();

  const groups = $derived(
    [
      { role: 'requester', heading: 'Asked by me', empty: "You haven't asked for anything yet. When you find something you'd like, make a proposal on it." },
      { role: 'lister', heading: 'On my listings', empty: 'Nobody has asked about your listings yet.' }
    ].filter((g) => !data.role || g.role === data.role)
  );
  const fieldWords: Record<string, string> = {
    date: 'when',
    handover: 'how',
    place: 'where',
    loanLength: 'how long',
    amount: 'how much',
    offers: 'what in return',
    ownOffer: 'what in return',
    sessionLength: 'how long',
    sessions: 'how many times'
  };

  /** The state of a proposal in words, from my side. */
  function state(p: ProposalSummary): string {
    if (p.status === 'accepted') return 'Agreed';
    if (p.status === 'declined') return 'Declined';
    if (p.status === 'withdrawn') return 'Withdrawn';
    if (p.status === 'closed') return p.closedReason === 'nothing_left' ? 'Closed: nothing left' : p.closedReason === 'quiet' ? 'Closed after a quiet month' : 'Closed';
    if (p.issues.length === 0) return p.myRole === 'lister' ? 'Ready for you to accept' : `Waiting for ${p.otherMember.displayName}`;
    const missing = [...new Set(p.issues.map((i) => fieldWords[i.field]).filter(Boolean))];
    return missing.length ? `Needs details: ${missing.join(', ')}` : 'Needs a change';
  }
</script>

<svelte:head><title>Proposals · wunan</title></svelte:head>

<section class="grid max-w-3xl gap-8">
  <div class="grid gap-1">
    <h1 class="text-2xl font-semibold">Proposals</h1>
    <p class="text-muted-foreground">Everything you're arranging with other members, with its messages.</p>
    <HelpLink topic="proposals" label="Help with proposals" />
  </div>

  {#each groups as group (group.role)}
    {@const items = data.items.filter((p) => p.myRole === group.role)}
    <section class="grid gap-3" aria-labelledby="group-{group.role}">
      <h2 id="group-{group.role}" class="text-xl font-semibold">{group.heading}</h2>
      {#if items.length === 0}
        <p class="text-muted-foreground">{group.empty}</p>
      {:else}
        <ul class="grid gap-3">
          {#each items as p (p.id)}
            <li>
              <a href="/proposals/{p.id}" class="grid gap-1 rounded-xl border bg-card p-4 text-foreground no-underline hover:bg-accent">
                <span class="font-medium underline underline-offset-2">{p.listing.title}</span>
                <span>With {p.otherMember.displayName} · {state(p)}</span>
                {#if p.unread}<span class="text-sm font-medium">New activity</span>{/if}
                {#if p.lastMessagePreview}<span class="truncate text-sm text-muted-foreground">{p.lastMessagePreview}</span>{/if}
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/each}
</section>
