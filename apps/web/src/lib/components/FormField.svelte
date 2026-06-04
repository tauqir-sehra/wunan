<!--
  One labelled form field: visible label, optional hint (e.g. why we ask), and an error message
  linked to the control with aria-describedby (constitution IV). Renders a text input unless
  `multiline` is set or a custom control is passed as `children`.
-->
<script lang="ts">
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import { Textarea } from '#lib/components/ui/textarea/index.ts';
  import type { Snippet } from 'svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Control = { id: string; describedBy: string | undefined; invalid: boolean };

  let {
    label,
    name,
    id = name,
    hint,
    error,
    value = '',
    multiline = false,
    optional = false,
    children,
    ...inputProps
  }: Omit<HTMLInputAttributes, 'children'> & {
    label: string;
    name: string;
    id?: string;
    hint?: string;
    error?: string | undefined;
    value?: string | number | null | undefined;
    multiline?: boolean;
    optional?: boolean;
    children?: Snippet<[Control]>;
  } = $props();

  const hintId = $derived(hint ? `${id}-hint` : undefined);
  const errorId = $derived(error ? `${id}-error` : undefined);
  const describedBy = $derived([errorId, hintId].filter(Boolean).join(' ') || undefined);
</script>

<div class="grid gap-1.5">
  <Label for={id}>
    {label}
    {#if optional}<span class="font-normal text-muted-foreground">(optional)</span>{/if}
  </Label>
  {#if hint}
    <p id={hintId} class="text-sm text-muted-foreground">{hint}</p>
  {/if}
  {#if error}
    <p id={errorId} class="text-sm font-medium text-destructive">{error}</p>
  {/if}
  {#if children}
    {@render children({ id, describedBy, invalid: Boolean(error) })}
  {:else if multiline}
    <Textarea
      {id}
      {name}
      value={value ?? ''}
      aria-describedby={describedBy}
      aria-invalid={error ? 'true' : undefined}
      required={inputProps.required}
      maxlength={inputProps.maxlength}
    />
  {:else}
    <Input
      {id}
      {name}
      value={value ?? ''}
      aria-describedby={describedBy}
      aria-invalid={error ? 'true' : undefined}
      {...inputProps}
    />
  {/if}
</div>
