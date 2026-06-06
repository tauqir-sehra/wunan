<!-- Alert body text. -->
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
  data-slot="alert-description"
  class={cn('text-foreground [&_p]:leading-relaxed', className)}
  {...restProps}
>
  {@render children?.()}
</div>
