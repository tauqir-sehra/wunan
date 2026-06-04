<!-- Dialog panel with a labelled close button. Focus is trapped and returned by Bits UI. -->
<script lang="ts">
  import { cn, type WithoutChildrenOrChild } from '#lib/utils.ts';
  import XIcon from '@lucide/svelte/icons/x';
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import DialogOverlay from './dialog-overlay.svelte';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & { children: Snippet } = $props();
</script>

<DialogPrimitive.Portal>
  <DialogOverlay />
  <DialogPrimitive.Content
    bind:ref
    data-slot="dialog-content"
    class={cn(
      'fixed top-1/2 left-1/2 z-50 grid max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl border bg-popover p-6 text-popover-foreground shadow-lg',
      className
    )}
    {...restProps}
  >
    {@render children()}
    <DialogPrimitive.Close
      class="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-md hover:bg-accent"
    >
      <XIcon class="size-5" aria-hidden="true" />
      <span class="sr-only">Close</span>
    </DialogPrimitive.Close>
  </DialogPrimitive.Content>
</DialogPrimitive.Portal>
