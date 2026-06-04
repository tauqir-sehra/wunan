<!-- One radio option (shadcn-svelte on Bits UI). 24 px circle; pair with a Label for a 44 px row. -->
<script lang="ts">
  import { cn, type WithoutChildrenOrChild } from '#lib/utils.ts';
  import { RadioGroup as RadioGroupPrimitive } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: WithoutChildrenOrChild<RadioGroupPrimitive.ItemProps> = $props();
</script>

<RadioGroupPrimitive.Item
  bind:ref
  data-slot="radio-group-item"
  class={cn(
    'flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-input bg-card disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:border-primary',
    className
  )}
  {...restProps}
>
  {#snippet children({ checked })}
    {#if checked}
      <span class="size-3 rounded-full bg-primary" aria-hidden="true"></span>
    {/if}
  {/snippet}
</RadioGroupPrimitive.Item>
