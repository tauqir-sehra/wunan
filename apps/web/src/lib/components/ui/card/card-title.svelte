<!-- Card title; a heading so screen-reader users can jump between cards. -->
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

<h2
  bind:this={ref}
  data-slot="card-title"
  class={cn('text-lg leading-snug font-semibold', className)}
  {...restProps}
>
  {@render children?.()}
</h2>
