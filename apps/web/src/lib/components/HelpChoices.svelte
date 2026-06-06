<!--
  The two ways to answer a request (003 FR-010, FR-013), shown after "I can help with this": make a
  new offering for it (the form starts from what was asked), or offer an offering you already have.
  Either way the offering shows on the request, so the asker can propose on it. Used in the pop-up
  on the request page and on its no-JavaScript page.
-->
<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import { helpWords } from '#lib/format.ts';
  import type { OfferingType } from '@wunan/shared';

  let {
    requestId,
    askerName,
    type,
    offerings,
    action
  }: {
    requestId: string;
    askerName: string;
    type: OfferingType;
    offerings: { id: string; title: string }[];
    /** The form action that links an existing offering (the page's own when left out). */
    action?: string;
  } = $props();
</script>

<div class="grid gap-6">
  <section class="grid gap-2" aria-labelledby="help-new">
    <h2 id="help-new" class="text-lg font-semibold">With a new offering</h2>
    <p class="text-muted-foreground">
      {helpWords[type].withNew} The form will start with what {askerName} asked for.
    </p>
    <div><Button href="/offerings/new?forRequest={requestId}">Make a new offering</Button></div>
  </section>

  <section class="grid gap-2 border-t pt-5" aria-labelledby="help-existing">
    <h2 id="help-existing" class="text-lg font-semibold">With an offering you already have</h2>
    {#if offerings.length}
      <p class="text-muted-foreground">
        It shows on {askerName}'s request. The offering itself doesn't change.
      </p>
      <form method="POST" {action} class="grid gap-4">
        <fieldset class="grid gap-2">
          <legend class="sr-only">{helpWords[type].listed}</legend>
          {#each offerings as offering, index (offering.id)}
            <label class="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name="offeringId"
                value={offering.id}
                checked={index === 0}
                class="size-5 accent-primary"
              />
              {offering.title}
            </label>
          {/each}
        </fieldset>
        <div><Button type="submit" variant="outline">Offer this</Button></div>
      </form>
    {:else}
      <p class="text-muted-foreground">
        {helpWords[type].none}
      </p>
    {/if}
  </section>
</div>
