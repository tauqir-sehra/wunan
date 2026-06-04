<!-- Separator line (shadcn-svelte on Bits UI). Decorative by default. -->
<script lang="ts">
  import { cn } from '#lib/utils.ts';
  import { Separator as SeparatorPrimitive } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    orientation = 'horizontal',
    decorative = true,
    ...restProps
  }: SeparatorPrimitive.RootProps = $props();
</script>

<SeparatorPrimitive.Root
  bind:ref
  data-slot="separator"
  {orientation}
  {decorative}
  class={cn(
    'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
    className
  )}
  {...restProps}
/>
