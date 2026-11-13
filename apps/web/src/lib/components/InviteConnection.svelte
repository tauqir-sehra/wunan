<!--
  How you're connected to a member through invitations (005), on their profile.

  Two parts. One plain sentence says how you're connected ("You both trace back to Fay.", or for a
  single line the line itself: "Fay invited Ben, who invited you."). The drawing under it shows
  everyone in between and holds the links. Screen readers and keyboards use the drawing too: each
  branch is a list named "From Fay down to you", so Tab reaches each person once. The viewer's box
  reads "You"; the viewer's and the member's boxes have a heavier border. Nothing here moves or
  loads later.
-->
<script lang="ts">
  import type { Connection, ConnectionPerson } from '@wunan/shared';

  let {
    connection,
    viewerId,
    memberName
  }: { connection: Connection; viewerId: string; memberName: string } = $props();

  type Part = string | ConnectionPerson;

  const { kind, top, toYou, toThem } = $derived(connection);
  const memberId = $derived(
    kind === 'theyAreAbove' ? top?.id : kind === 'self' ? viewerId : toThem.at(-1)?.id
  );

  /** "Fay invited Ben, who invited you." as words and people, from `from` down `line`. */
  function lineSentence(from: ConnectionPerson, line: ConnectionPerson[]): Part[] {
    if (line.length === 0) {
      return from.id === viewerId
        ? ['You started this community.']
        : [from, ' started this community.'];
    }
    const parts: Part[] = [from, ' invited ', line[0]!];
    for (const person of line.slice(1)) parts.push(', who invited ', person);
    parts.push('.');
    return parts;
  }

  const sentences = $derived.by((): Part[][] => {
    if (kind === 'separate') {
      return [[`You and ${memberName} trace back to different founding members.`]];
    }
    if (!top) return [];
    if (kind === 'shared') {
      return [['You both trace back to ', top, '.']];
    }
    return [lineSentence(top, kind === 'youAreAbove' ? toThem : toYou)];
  });

  /** The columns of the drawing, the viewer's branch first. */
  const columns = $derived(
    kind === 'shared' || kind === 'separate'
      ? [toYou, toThem]
      : kind === 'youAreAbove'
        ? [toThem]
        : [toYou]
  );

  const nameOf = (person: ConnectionPerson | undefined) =>
    !person ? '' : person.id === viewerId ? 'you' : person.displayName;

  /** What each branch is called for screen readers: "From Fay down to you". */
  function columnName(column: ConnectionPerson[]): string {
    return `From ${nameOf(top ?? column[0])} down to ${nameOf(column.at(-1))}`;
  }

  const isYou = (person: ConnectionPerson) => person.id === viewerId;
  const isThem = (person: ConnectionPerson) => kind !== 'self' && person.id === memberId;
</script>

{#snippet name(person: ConnectionPerson, first: boolean)}
  {#if isYou(person)}{first ? 'You' : 'you'}{:else}{person.displayName}{/if}
{/snippet}

{#snippet node(person: ConnectionPerson, isTop: boolean)}
  <div
    class="grid max-w-full justify-items-center gap-0.5 rounded-lg border bg-background px-3 py-1.5 text-center {isYou(
      person
    ) || isThem(person)
      ? 'border-2 border-foreground'
      : 'border-border'}"
  >
    <span class="font-medium break-words">
      {#if isYou(person)}You{:else if person.isFormerMember}{person.displayName}{:else}<a
          href="/members/{person.id}">{person.displayName}</a
        >{/if}
    </span>
    <!-- The sentence above already says this to screen readers. -->
    {#if isTop && kind === 'shared'}<span aria-hidden="true" class="text-xs text-muted-foreground"
        >You both trace back to {person.displayName}</span
      >{/if}
    {#if person.isFounder}<span class="text-xs text-muted-foreground">Founding member</span>{/if}
  </div>
{/snippet}

<section aria-labelledby="connection-heading" class="grid gap-4">
  <h2 id="connection-heading" class="text-lg font-semibold">
    {kind === 'self' ? 'Your invite line' : "How you're connected"}
  </h2>

  <div class="grid gap-1">
    {#each sentences as sentence, index (index)}
      <p>
        {#each sentence as part, at (at)}{#if typeof part === 'string'}{part}{:else}{@render name(
              part,
              at === 0
            )}{/if}{/each}
      </p>
    {/each}
  </div>

  <div class="grid justify-items-center text-sm">
    {#if top}
      {@render node(top, true)}
      {#if columns.some((column) => column.length > 0)}<div class="h-4 w-px bg-border"></div>{/if}
    {/if}
    <div class="relative grid w-full gap-3 {columns.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}">
      {#if top && columns.length === 2}
        <div class="absolute top-0 right-1/4 left-1/4 border-t border-border"></div>
      {/if}
      {#each columns as column, index (index)}
        <ol
          class="grid list-none content-start justify-items-center"
          aria-label={columnName(column)}
        >
          {#each column as person, at (person.id)}
            <li class="grid justify-items-center">
              {#if top || at > 0}<div class="h-4 w-px bg-border"></div>{/if}
              {@render node(person, false)}
            </li>
          {/each}
        </ol>
      {/each}
    </div>
  </div>
</section>
