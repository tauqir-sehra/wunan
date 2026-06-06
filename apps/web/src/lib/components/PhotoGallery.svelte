<!--
  An offering's photos as small tiles. Choosing one opens it large in a pop-up, where "Previous" and
  "Next" (or the arrow keys, or a swipe) move through the photos, with "2 of 4" and the photo's
  description under it. No animation (constitution V); focus stays in the pop-up and returns to
  the tile on closing (Bits UI). Without JavaScript each tile is a link to the full-size photo.
-->
<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Dialog, DialogContent, DialogTitle } from '#lib/components/ui/dialog/index.ts';
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

  let { photos }: { photos: { id: string; key: string; alt: string | null }[] } = $props();

  let open = $state(false);
  let current = $state(0);
  const photo = $derived(photos[current]);

  function show(index: number, event: MouseEvent) {
    event.preventDefault();
    current = index;
    open = true;
  }
  // Wraps around, so the buttons never become unusable under the pointer or the keyboard.
  const go = (step: number) => (current = (current + step + photos.length) % photos.length);

  function keys(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') go(-1);
    else if (event.key === 'ArrowRight') go(1);
  }
  let touchX: number | null = null;
  function touchEnd(event: TouchEvent) {
    const x = event.changedTouches[0]?.clientX;
    if (touchX !== null && x !== undefined && Math.abs(x - touchX) > 50) go(x < touchX ? 1 : -1);
    touchX = null;
  }
</script>

<ul class="grid grid-cols-2 gap-2">
  {#each photos as tile, index (tile.id)}
    <li>
      <a href="/photos/{tile.key}" class="block rounded-lg" onclick={(event) => show(index, event)}>
        <img
          src="/photos/{tile.key}"
          alt={tile.alt ?? ''}
          class="aspect-square w-full rounded-lg object-cover"
          loading="lazy"
        />
        <span class="sr-only">Photo {index + 1} of {photos.length}, open larger</span>
      </a>
    </li>
  {/each}
</ul>

<Dialog bind:open>
  <DialogContent class="max-w-4xl gap-3 p-4 pt-14 sm:p-6 sm:pt-14" onkeydown={keys}>
    <DialogTitle class="sr-only">Photo {current + 1} of {photos.length}</DialogTitle>
    {#if photo}
      <div
        class="flex items-center justify-center"
        ontouchstart={(event) => (touchX = event.touches[0]?.clientX ?? null)}
        ontouchend={touchEnd}
      >
        <img
          src="/photos/{photo.key}"
          alt={photo.alt ?? ''}
          class="max-h-[70vh] w-auto max-w-full rounded-md object-contain"
        />
      </div>
      <div
        class="flex items-center gap-3 {photos.length > 1 ? 'justify-between' : 'justify-center'}"
      >
        {#if photos.length > 1}<Button
            type="button"
            variant="outline"
            size="sm"
            onclick={() => go(-1)}
          >
            <ChevronLeftIcon class="size-4" aria-hidden="true" />Previous<span class="sr-only">
              photo</span
            >
          </Button>{/if}
        <p class="min-w-0 text-center text-sm text-muted-foreground" aria-live="polite">
          {current + 1} of {photos.length}{#if photo.alt}<span class="block text-foreground"
              >{photo.alt}</span
            >{/if}
        </p>
        {#if photos.length > 1}<Button
            type="button"
            variant="outline"
            size="sm"
            onclick={() => go(1)}
          >
            Next<span class="sr-only"> photo</span><ChevronRightIcon
              class="size-4"
              aria-hidden="true"
            />
          </Button>{/if}
      </div>
    {/if}
  </DialogContent>
</Dialog>
