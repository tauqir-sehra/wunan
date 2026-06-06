<!--
  A small button that opens a floating dialog for one short task: sharing contact details,
  suggesting a call time, raising an issue about a listing. All of them look and behave the same:
  a title, a line saying what happens, the form, and a close button (Bits UI keeps focus inside
  and returns it afterwards). Without JavaScript the button is a link to a page doing the same task.
-->
<script lang="ts">
  import { onMount, type Component, type Snippet } from 'svelte';
  import { Button, buttonVariants, type ButtonVariant } from '#lib/components/ui/button/index.ts';
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '#lib/components/ui/dialog/index.ts';

  let {
    label,
    icon: Icon,
    title,
    description,
    fallbackHref,
    variant = 'outline',
    open = $bindable(false),
    children
  }: {
    label: string;
    icon?: Component<{ class?: string; 'aria-hidden'?: 'true' }>;
    title: string;
    description?: string;
    fallbackHref: string;
    variant?: ButtonVariant;
    open?: boolean;
    children: Snippet;
  } = $props();

  let ready = $state(false);
  onMount(() => (ready = true));
</script>

{#if !ready}
  <Button href={fallbackHref} {variant} size="sm">
    {#if Icon}<Icon class="size-4" aria-hidden="true" />{/if}
    {label}
  </Button>
{:else}
  <Dialog bind:open>
    <DialogTrigger class={buttonVariants({ variant, size: 'sm' })}>
      {#if Icon}<Icon class="size-4" aria-hidden="true" />{/if}
      {label}
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {#if description}<DialogDescription class="text-muted-foreground">{description}</DialogDescription>{/if}
      </DialogHeader>
      {@render children()}
    </DialogContent>
  </Dialog>
{/if}
