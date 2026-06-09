<!-- Button (shadcn-svelte). Renders a link when `href` is given. At least 44 px tall; no animation. -->
<script lang="ts" module>
  import { cn, type WithElementRef } from '#lib/utils.ts';
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
  import { type VariantProps, tv } from 'tailwind-variants';

  export const buttonVariants = tv({
    base: "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-base font-medium whitespace-nowrap no-underline disabled:pointer-events-none disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-card hover:bg-accent hover:text-accent-foreground',
        // The header's "Request" / "Offer": the filled button's shape and size, outlined in its colour.
        primaryOutline: 'border-2 border-primary bg-card text-primary hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline underline-offset-2'
      },
      size: {
        default: 'min-h-11 px-5 py-2',
        sm: 'min-h-11 px-3',
        // Same box as primaryOutline, so a filled "Offer something" matches the header's outlined one.
        action: 'min-h-11 gap-1.5 px-3',
        lg: 'min-h-12 px-6 text-lg',
        icon: 'size-11'
      }
    },
    // A filled action button gets an invisible border as wide as primaryOutline's, so both are one size.
    compoundVariants: [
      { variant: 'default', size: 'action', class: 'border-2 border-transparent' }
    ],
    defaultVariants: { variant: 'default', size: 'default' }
  });

  export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
  export type ButtonSize = VariantProps<typeof buttonVariants>['size'];
  export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
    WithElementRef<HTMLAnchorAttributes> & { variant?: ButtonVariant; size?: ButtonSize };
</script>

<script lang="ts">
  let {
    class: className,
    variant = 'default',
    size = 'default',
    ref = $bindable(null),
    href = undefined,
    type = 'button',
    disabled,
    children,
    ...restProps
  }: ButtonProps = $props();
</script>

{#if href}
  <a
    bind:this={ref}
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    href={disabled ? undefined : href}
    aria-disabled={disabled}
    role={disabled ? 'link' : undefined}
    tabindex={disabled ? -1 : undefined}
    {...restProps}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    bind:this={ref}
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    {type}
    {disabled}
    {...restProps}
  >
    {@render children?.()}
  </button>
{/if}
