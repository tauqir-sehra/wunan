<!--
  Boxed message (shadcn-svelte). It has no live-region role by default: use Notice.svelte when a
  message must be announced, so screen readers are not interrupted by static boxes.
-->
<script lang="ts" module>
  import { type VariantProps, tv } from 'tailwind-variants';

  export const alertVariants = tv({
    base: 'relative grid w-full gap-1 rounded-lg border px-4 py-3 has-[>svg]:grid-cols-[1.5rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-5 [&>svg]:translate-y-0.5',
    variants: {
      variant: {
        default: 'border-input bg-card text-card-foreground',
        destructive: 'border-destructive bg-card text-foreground [&>svg]:text-destructive'
      }
    },
    defaultVariants: { variant: 'default' }
  });

  export type AlertVariant = VariantProps<typeof alertVariants>['variant'];
</script>

<script lang="ts">
  import { cn, type WithElementRef } from '#lib/utils.ts';
  import type { HTMLAttributes } from 'svelte/elements';

  let {
    ref = $bindable(null),
    class: className,
    variant = 'default',
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & { variant?: AlertVariant } = $props();
</script>

<div bind:this={ref} data-slot="alert" class={cn(alertVariants({ variant }), className)} {...restProps}>
  {@render children?.()}
</div>
