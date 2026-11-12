<!--
  What has happened in an arrangement, oldest first, then what is still expected (004 FR-012,
  FR-013). Each line is text: the step, then its date, or "not yet". The dot beside it is only
  decoration (filled for done, hollow for still to come); the words say everything.
-->
<script lang="ts">
  import { shortDay, stepWords } from '#lib/format.ts';
  import type { TimelineStep } from '@wunan/shared';

  let { steps }: { steps: TimelineStep[] } = $props();
  /** Who did it, where that helps: "marked by Sam". */
  const who = (step: TimelineStep) =>
    step.by && (step.step === 'done' || step.step === 'returned')
      ? ` · marked by ${step.by.displayName}`
      : '';
</script>

<section class="grid gap-2" aria-labelledby="timeline-heading">
  <h2 id="timeline-heading" class="text-lg font-semibold">What has happened</h2>
  <ol class="grid gap-0" aria-labelledby="timeline-heading">
    {#each steps as step, index (index)}
      <li class="relative flex gap-3 pb-3 last:pb-0">
        <!-- The line between dots, and the dot: decoration only. -->
        {#if index < steps.length - 1}<span
            class="absolute top-4 left-[0.4375rem] h-full w-px bg-border"
            aria-hidden="true"
          ></span>{/if}
        <span
          class="relative mt-1.5 size-3.5 shrink-0 rounded-full border-2 {step.at
            ? 'border-primary bg-primary'
            : 'border-input bg-background'}"
          aria-hidden="true"
        ></span>
        <span class={step.at ? '' : 'text-muted-foreground'}>
          {stepWords[step.step]} · {step.at ? shortDay(step.at) : 'not yet'}{who(step)}
        </span>
      </li>
    {/each}
  </ol>
</section>
