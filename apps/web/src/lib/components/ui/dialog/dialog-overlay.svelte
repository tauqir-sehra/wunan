<!-- Dimmed backdrop behind a dialog. Appears instantly (no fade). -->
<script lang="ts">
  import { cn } from '#lib/utils.ts';
  import { Dialog as DialogPrimitive } from 'bits-ui';

  let { ref = $bindable(null), class: className, ...restProps }: DialogPrimitive.OverlayProps =
    $props();
</script>

<DialogPrimitive.Overlay
  bind:ref
  data-slot="dialog-overlay"
  class={cn('fixed inset-0 z-50 bg-black/50', className)}
  {...restProps}
/>
