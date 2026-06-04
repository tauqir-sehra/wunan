<!-- Radio group (shadcn-svelte on Bits UI). -->
<script lang="ts">
  import { cn } from '#lib/utils.ts';
  import { RadioGroup as RadioGroupPrimitive } from 'bits-ui';

  let {
    ref = $bindable(null),
    value = $bindable(''),
    class: className,
    ...restProps
  }: RadioGroupPrimitive.RootProps = $props();
</script>

<RadioGroupPrimitive.Root
  bind:ref
  bind:value
  data-slot="radio-group"
  class={cn('grid gap-3', className)}
  {...restProps}
/>
