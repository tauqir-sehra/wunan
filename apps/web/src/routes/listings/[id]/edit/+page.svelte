<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import ListingFields from '#lib/components/ListingFields.svelte';
  import FieldProblems from '#lib/components/FieldProblems.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import PhotoPicker from '#lib/components/PhotoPicker.svelte';
  import PlaceField from '#lib/components/PlaceField.svelte';
  import { typeLabels } from '#lib/format.ts';
  import { listingValues } from '#lib/listing-form.ts';

  let { data, form } = $props();
  const labels: Record<string, string> = {
    title: 'Title',
    description: 'Description',
    amount: 'Amount',
    unit: 'Amount',
    loanLength: 'Longest loan',
    loanLengthUnit: 'Longest loan',
    handovers: 'How it happens',
    accepts: 'What you’d accept',
    sessionLength: 'How long each time',
    sessionLengthUnit: 'How long each time',
    sessionsAvailable: 'How many times',
    availability: 'When it’s offered',
    area: 'Area',
    meetingPlace: 'Meeting place'
  };
  const listing = $derived(data.listing);
  const values = $derived<Record<string, string>>(form?.values ? { ...listingValues(listing), ...form.values } : listingValues(listing));
  const room = $derived(6 - listing.photos.length);
</script>

<svelte:head><title>Edit {listing.title} · wunan</title></svelte:head>

<section class="grid max-w-2xl gap-8">
  <div class="grid gap-1">
    <h1 class="text-2xl font-semibold">Edit listing</h1>
    <p class="text-muted-foreground">{typeLabels[listing.type]} · <a href="/listings/{listing.id}">Back to the listing</a></p>
  </div>

  {#if form?.error}
    <Notice kind="error"><p>{form.error}</p><FieldProblems fields={form.fields} {labels} /></Notice>
  {/if}

  <form method="POST" action="?/save" class="grid gap-5">
    <input type="hidden" name="type" value={listing.type} />
    <ListingFields type={listing.type} {values} fields={form?.fields ?? {}} />
    <PlaceField label="Area" name="area" optional value={values.area} error={form?.fields?.area} hint="Your neighbourhood, or your address if people pick up from you. Others see only the neighbourhood and city until you accept their proposal." />
    <PlaceField label="Meeting place" name="meetingPlace" optional value={values.meetingPlace} error={form?.fields?.meetingPlace} hint="Needed if you offer to meet somewhere else. A public place works best, like a library or a café." />
    <div><Button type="submit">Save changes</Button></div>
  </form>

  <section class="grid gap-4" aria-labelledby="photos-heading">
    <h2 id="photos-heading" class="text-xl font-semibold">Photos</h2>
    {#if form?.photoError}
      <Notice kind="error"><p>{form.photoError}</p></Notice>
    {:else if form?.added}
      <Notice><p>{form.added === 1 ? 'Photo added.' : `${form.added} photos added.`}</p></Notice>
    {:else if form?.photoSaved}
      <Notice><p>Photo description saved.</p></Notice>
    {:else if form?.photoDeleted}
      <Notice><p>Photo deleted.</p></Notice>
    {/if}

    {#each listing.photos as photo, index (photo.id)}
      <div class="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[8rem_1fr]">
        <img src="/photos/{photo.key}" alt={photo.alt ?? ''} class="w-32 rounded-md" />
        <div class="grid gap-3">
          <form method="POST" action="?/updatePhoto" class="grid gap-2">
            <input type="hidden" name="photoId" value={photo.id} />
            <Label for="alt-saved-{index}">Describe photo {index + 1}</Label>
            <Input id="alt-saved-{index}" name="alt" maxlength={200} value={photo.alt ?? ''} />
            <div><Button type="submit" variant="outline" size="sm">Save description</Button></div>
          </form>
          {#if form?.confirmDelete === photo.id}
            <form method="POST" action="?/deletePhoto" class="flex flex-wrap items-center gap-3">
              <input type="hidden" name="photoId" value={photo.id} />
              <input type="hidden" name="confirmed" value="yes" />
              <span>Delete this photo?</span>
              <Button type="submit" variant="destructive" size="sm">Yes, delete it</Button>
              <a href="/listings/{listing.id}/edit">Keep it</a>
            </form>
          {:else}
            <form method="POST" action="?/deletePhoto">
              <input type="hidden" name="photoId" value={photo.id} />
              <Button type="submit" variant="ghost" size="sm">Delete photo</Button>
            </form>
          {/if}
        </div>
      </div>
    {/each}

    {#if room > 0}
      <form method="POST" action="?/addPhotos" enctype="multipart/form-data" class="grid gap-4">
        <PhotoPicker count={Math.min(room, 3)} />
        <div><Button type="submit" variant="outline">Add photos</Button></div>
      </form>
    {:else}
      <p class="text-muted-foreground">This listing has 6 photos, the most it can have.</p>
    {/if}
  </section>
</section>
