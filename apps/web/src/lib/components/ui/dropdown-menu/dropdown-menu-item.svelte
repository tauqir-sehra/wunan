<!-- One menu option, at least 44 px tall. -->
<script lang="ts">
  import { cn } from '#lib/utils.ts';
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';

  let { ref = $bindable(null), class: className, ...restProps }: DropdownMenuPrimitive.ItemProps =
    $props();
</script>

<DropdownMenuPrimitive.Item
  bind:ref
  data-slot="dropdown-menu-item"
  class={cn(
    'relative flex min-h-11 cursor-default items-center gap-2 rounded-sm px-3 text-base outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-60 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
    className
  )}
  {...restProps}
/>
