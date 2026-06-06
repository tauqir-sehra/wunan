<!-- Side panel (shadcn-svelte Sheet on Bits UI Dialog). Appears instantly, no slide-in. -->
<script lang="ts" module>
  import { tv, type VariantProps } from 'tailwind-variants';

  export const sheetVariants = tv({
    base: 'fixed z-50 flex flex-col gap-2 overflow-y-auto bg-popover text-popover-foreground shadow-lg',
    variants: {
      side: {
        top: 'inset-x-0 top-0 h-auto border-b',
        bottom: 'inset-x-0 bottom-0 h-auto border-t',
        left: 'inset-y-0 left-0 h-full w-4/5 max-w-sm border-r',
        right: 'inset-y-0 right-0 h-full w-4/5 max-w-sm border-l'
      }
    },
    defaultVariants: { side: 'right' }
  });

  export type Side = VariantProps<typeof sheetVariants>['side'];
</script>

<script lang="ts">
  import { cn, type WithoutChildrenOrChild } from '#lib/utils.ts';
  import XIcon from '@lucide/svelte/icons/x';
  import { Dialog as SheetPrimitive } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import DialogOverlay from '../dialog/dialog-overlay.svelte';

  let {
    ref = $bindable(null),
    class: className,
    side = 'right',
    children,
    ...restProps
  }: WithoutChildrenOrChild<SheetPrimitive.ContentProps> & {
    side?: Side;
    children: Snippet;
  } = $props();
</script>

<SheetPrimitive.Portal>
  <DialogOverlay />
  <SheetPrimitive.Content
    bind:ref
    data-slot="sheet-content"
    class={cn(sheetVariants({ side }), className)}
    {...restProps}
  >
    {@render children()}
    <SheetPrimitive.Close
      class="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-md hover:bg-accent"
    >
      <XIcon class="size-5" aria-hidden="true" />
      <span class="sr-only">Close</span>
    </SheetPrimitive.Close>
  </SheetPrimitive.Content>
</SheetPrimitive.Portal>
