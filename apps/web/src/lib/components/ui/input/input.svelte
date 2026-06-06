<!-- Text input (shadcn-svelte). Border meets 3:1 contrast; at least 44 px tall. -->
<script lang="ts">
  import { cn, type WithElementRef } from '#lib/utils.ts';
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = WithElementRef<HTMLInputAttributes, HTMLInputElement>;

  let {
    ref = $bindable(null),
    value = $bindable(),
    class: className,
    ...restProps
  }: Props = $props();
</script>

<input
  bind:this={ref}
  bind:value
  data-slot="input"
  class={cn(
    'flex min-h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-2 aria-invalid:border-destructive',
    'file:mr-3 file:border-0 file:bg-transparent file:text-base file:font-medium file:text-foreground',
    className
  )}
  {...restProps}
/>
