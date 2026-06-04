<!-- Multi-line text input (shadcn-svelte). Border meets 3:1 contrast. -->
<script lang="ts">
  import { cn, type WithElementRef } from '#lib/utils.ts';
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  type Props = WithElementRef<HTMLTextareaAttributes, HTMLTextAreaElement>;

  let { ref = $bindable(null), value = $bindable(), class: className, ...restProps }: Props =
    $props();
</script>

<textarea
  bind:this={ref}
  bind:value
  data-slot="textarea"
  class={cn(
    'flex min-h-28 w-full rounded-md border border-input bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-2 aria-invalid:border-destructive',
    className
  )}
  {...restProps}
></textarea>
