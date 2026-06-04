<!-- Alert title. -->
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

<p bind:this={ref} data-slot="alert-title" class={cn('font-semibold', className)} {...restProps}>
  {@render children?.()}
</p>
