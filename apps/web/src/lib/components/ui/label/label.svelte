<!-- Form label (shadcn-svelte on Bits UI). Always visible (constitution IV). -->
<script lang="ts">
  import { cn } from '#lib/utils.ts';
  import { Label as LabelPrimitive } from 'bits-ui';

  let { ref = $bindable(null), class: className, ...restProps }: LabelPrimitive.RootProps =
    $props();
</script>

<LabelPrimitive.Root
  bind:ref
  data-slot="label"
  class={cn(
    'flex items-center gap-2 text-base leading-snug font-medium select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
    className
  )}
  {...restProps}
/>
