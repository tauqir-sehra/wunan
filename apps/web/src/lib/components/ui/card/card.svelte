<!-- Card container (shadcn-svelte). -->
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

<div bind:this={ref} data-slot="card" class={cn('flex flex-col gap-4 rounded-xl border bg-card py-5 text-card-foreground', className)} {...restProps}>
  {@render children?.()}
</div>
