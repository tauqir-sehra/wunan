<!-- Dialog title; announced when the dialog opens. -->
<script lang="ts">
  import { cn } from '#lib/utils.ts';
  import { Dialog as DialogPrimitive } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: DialogPrimitive.TitleProps = $props();
</script>

<DialogPrimitive.Title
  bind:ref
  data-slot="dialog-title"
  class={cn('pr-10 text-xl leading-snug font-semibold', className)}
  {...restProps}
/>
