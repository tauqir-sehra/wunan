<!-- Checkbox (shadcn-svelte on Bits UI). 24 px box inside a 44 px label row. -->
<script lang="ts">
  import { cn, type WithoutChildrenOrChild } from '#lib/utils.ts';
  import CheckIcon from '@lucide/svelte/icons/check';
  import MinusIcon from '@lucide/svelte/icons/minus';
  import { Checkbox as CheckboxPrimitive } from 'bits-ui';

  let {
    ref = $bindable(null),
    checked = $bindable(false),
    indeterminate = $bindable(false),
    class: className,
    ...restProps
  }: WithoutChildrenOrChild<CheckboxPrimitive.RootProps> = $props();
</script>

<CheckboxPrimitive.Root
  bind:ref
  bind:checked
  bind:indeterminate
  data-slot="checkbox"
  class={cn(
    'peer flex size-6 shrink-0 items-center justify-center rounded-sm border-2 border-input bg-card text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:border-primary data-[state=checked]:bg-primary',
    className
  )}
  {...restProps}
>
  {#snippet children({ checked, indeterminate })}
    {#if checked}
      <CheckIcon class="size-4" aria-hidden="true" />
    {:else if indeterminate}
      <MinusIcon class="size-4" aria-hidden="true" />
    {/if}
  {/snippet}
</CheckboxPrimitive.Root>
