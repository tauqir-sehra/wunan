<!--
  Choose photos, each with a short description used as alt text for people who can't see it.
  Plain file inputs, so it works without JavaScript; with JavaScript, a small preview is shown.
-->
<script lang="ts">
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';

  let { count = 3 }: { count?: number } = $props();
  let previews = $state<(string | null)[]>([]);

  function preview(index: number, event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (previews[index]) URL.revokeObjectURL(previews[index]!);
    previews[index] = file ? URL.createObjectURL(file) : null;
  }
</script>

<fieldset class="grid gap-4">
  <legend class="mb-1 text-base font-medium">Photos <span class="font-normal text-muted-foreground">(optional)</span></legend>
  <p class="text-sm text-muted-foreground">
    Up to 10 MB each. Location data is removed from photos before anyone sees them. You can add up
    to 6 photos; add more later by editing the listing.
  </p>
  {#each Array.from({ length: count }, (_, i) => i) as index (index)}
    <div class="grid gap-2 rounded-lg border p-3">
      <Label for="photo-{index}">Photo {index + 1}</Label>
      <input
        id="photo-{index}"
        name="photo_{index}"
        type="file"
        accept="image/*"
        class="min-h-11 text-base file:mr-3 file:min-h-11 file:rounded-md file:border file:border-input file:bg-card file:px-4 file:text-base"
        onchange={(event) => preview(index, event)}
      />
      {#if previews[index]}
        <img src={previews[index]} alt="Preview of photo {index + 1}" class="max-h-40 w-fit rounded-md" />
      {/if}
      <Label for="alt-{index}">Describe photo {index + 1}</Label>
      <p id="alt-{index}-hint" class="text-sm text-muted-foreground">A few words for people who can't see the photo, like "Bag of brown rice".</p>
      <Input id="alt-{index}" name="alt_{index}" maxlength={200} aria-describedby="alt-{index}-hint" />
    </div>
  {/each}
</fieldset>
