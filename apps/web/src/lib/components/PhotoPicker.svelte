<!--
  Choose photos, each with a short description used as alt text for people who can't see it.
  With JavaScript: one "Add a photo" button; each chosen photo becomes a row with a small preview,
  its description, and an X to take it out, and the button moves on to the next free place.
  Without JavaScript: plain file inputs, each with its description box. Either way the form sends
  `photo_<n>` and `alt_<n>`, and the hint about descriptions is said once, at the top.
-->
<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import ImagePlusIcon from '@lucide/svelte/icons/image-plus';
  import XIcon from '@lucide/svelte/icons/x';
  import { onMount, tick } from 'svelte';

  let { count = 3 }: { count?: number } = $props();
  const slots = $derived(Array.from({ length: count }, (_, i) => i));
  let previews = $state<(string | null)[]>([]);
  let scripted = $state(false);
  let announcement = $state('');
  const inputs: HTMLInputElement[] = $state([]);
  onMount(() => (scripted = true));

  /** The place the "Add a photo" button fills next. */
  const nextFree = $derived(slots.find((i) => !previews[i]) ?? -1);

  async function chosen(index: number, event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (previews[index]) URL.revokeObjectURL(previews[index]!);
    previews[index] = file ? URL.createObjectURL(file) : null;
    if (file && scripted) {
      await tick();
      document.getElementById(`alt-${index}`)?.focus();
    }
  }

  function takeOut(index: number) {
    if (previews[index]) URL.revokeObjectURL(previews[index]!);
    previews[index] = null;
    if (inputs[index]) inputs[index].value = '';
    const alt = document.getElementById(`alt-${index}`) as HTMLInputElement | null;
    if (alt) alt.value = '';
    announcement = 'Photo taken out.';
  }
</script>

<fieldset class="grid min-w-0 gap-3" aria-describedby="photos-hint">
  <legend class="mb-1 text-base font-medium">
    Photos <span class="font-normal text-muted-foreground">(optional)</span>
  </legend>
  <p id="photos-hint" class="text-sm text-muted-foreground">
    Up to 6 photos in all, 10 MB each; location data is removed. Describe each one in a few words
    for people who can't see it, like "Bag of brown rice".
  </p>

  <ol class="grid gap-3">
    {#each slots as index (index)}
      {@const filled = Boolean(previews[index])}
      <!-- Without JavaScript every place shows; with it, only chosen photos (and the button below). -->
      <li class={scripted ? (filled ? 'flex items-end gap-3' : 'hidden') : 'grid gap-1.5'}>
        {#if scripted}
          <img
            src={previews[index] ?? ''}
            alt=""
            class="size-14 shrink-0 rounded-md object-cover"
          />
        {:else}
          <Label for="photo-{index}" class="text-sm">Photo {index + 1}</Label>
        {/if}
        <input
          bind:this={inputs[index]}
          id="photo-{index}"
          name="photo_{index}"
          type="file"
          accept="image/*"
          class={scripted
            ? 'hidden'
            : 'min-h-11 w-full min-w-0 text-base file:mr-3 file:min-h-11 file:rounded-md file:border file:border-input file:bg-card file:px-4 file:text-base'}
          onchange={(event) => chosen(index, event)}
        />
        <div class="flex min-w-0 flex-1 items-end gap-1">
          <div class="grid min-w-0 flex-1 gap-1">
            <Label for="alt-{index}" class="text-sm">Describe photo {index + 1}</Label>
            <Input
              id="alt-{index}"
              name="alt_{index}"
              maxlength={200}
              aria-describedby="photos-hint"
            />
          </div>
          {#if scripted}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="shrink-0 text-muted-foreground"
              aria-label="Take out photo {index + 1}"
              title="Take out"
              onclick={() => takeOut(index)}
            >
              <XIcon class="size-5" aria-hidden="true" />
            </Button>
          {/if}
        </div>
      </li>
    {/each}
  </ol>

  {#if scripted}
    {#if nextFree >= 0}
      <div>
        <Button type="button" variant="outline" size="sm" onclick={() => inputs[nextFree]?.click()}>
          <ImagePlusIcon class="size-4" aria-hidden="true" />Add a photo
        </Button>
      </div>
    {:else}
      <p class="text-sm text-muted-foreground">That's the most you can add here.</p>
    {/if}
  {/if}
  <div class="sr-only" aria-live="polite">{announcement}</div>
</fieldset>
