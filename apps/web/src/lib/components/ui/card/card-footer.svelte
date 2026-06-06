<!-- Card footer. -->
<script lang="ts">
  import { cn, type WithElementRef } from '#lib/utils.ts';
  import type { HTMLAttributes } from 'svelte/elements';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<div
  bind:this={ref}
  data-slot="card-footer"
  class={cn('flex flex-wrap items-center gap-3 px-5', className)}
  {...restProps}
>
  {@render children?.()}
</div>
