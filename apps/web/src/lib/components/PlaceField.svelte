<!--
  A place: an area, a meeting place, or where a handover happens (002 FR-027, FR-028).
  While typing, up to 8 suggestions (addresses, neighbourhoods, cities, businesses) appear from
  the operator's place service, following the ARIA combobox pattern: arrow keys move, Enter picks,
  Escape closes, and the number of suggestions is announced. Picking one keeps its parts (so wunan
  can show "neighbourhood, city" and compare areas); typing your own words is always fine. Each
  suggestion says what it is and where ("City or town · California, United States"), because
  many places share a name.
  The picked place travels in a hidden field `name` as JSON; the text box is `name_text`, so the
  field still works as plain text without JavaScript or when suggestions aren't available.
  With `filter` (the Area box on the search pages) it's a plain text field called `name` that
  suggests only neighbourhoods and cities, which is what searches match; picking one fills in
  its name.
-->
<script lang="ts">
  import InfoNote from '#lib/components/InfoNote.svelte';
  import { Label } from '#lib/components/ui/label/index.ts';
  import type { Place, PlaceView } from '@wunan/shared';
  import { untrack } from 'svelte';

  let {
    label,
    name,
    value = null,
    hint,
    error,
    optional = false,
    filter = false
  }: {
    label: string;
    name: string;
    value?: Place | PlaceView | string | null | undefined;
    hint?: string;
    error?: string | undefined;
    optional?: boolean;
    /** A search filter: plain text, suggesting only neighbourhoods and cities. */
    filter?: boolean;
  } = $props();

  /** A saved value as the place it stands for (a display-only view can't be re-saved, so it's text). */
  function fromValue(given: typeof value): Place | null {
    if (!given) return null;
    let v: Place | PlaceView;
    if (typeof given === 'string') {
      try {
        v = JSON.parse(given) as Place | PlaceView;
      } catch {
        return { label: given, source: 'typed' };
      }
    } else v = given;
    // Saved places come back with a `display` field, which is never sent back.
    if ('label' in v) {
      const { display: _display, ...place } = v as Place & { display?: string };
      return place;
    }
    return { label: v.display, source: 'typed' };
  }

  const initial = untrack(() =>
    filter
      ? typeof value === 'string' && value
        ? ({ label: value, source: 'typed' } as Place)
        : null
      : fromValue(value)
  );
  let text = $state(initial?.label ?? '');
  let picked = $state<Place | null>(initial?.source === 'suggestion' ? initial : null);
  let options = $state<Place[]>([]);
  let open = $state(false);
  let active = $state(-1);
  let unavailable = $state(false);
  let announcement = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest = 0;

  const listId = $derived(`${name}-suggestions`);
  const hintId = $derived(hint ? `${name}-hint` : undefined);
  const errorId = $derived(error ? `${name}-error` : undefined);
  const noteId = $derived(unavailable ? `${name}-note` : undefined);
  const describedBy = $derived([errorId, hintId, noteId].filter(Boolean).join(' ') || undefined);
  const saved = $derived(
    picked
      ? JSON.stringify(picked)
      : text.trim()
        ? JSON.stringify({ label: text.trim(), source: 'typed' })
        : ''
  );

  function onInput(event: Event & { currentTarget: HTMLInputElement }) {
    picked = null; // Typing again means it's the member's own words, until they pick again.
    clearTimeout(timer);
    // Read the box itself: the bound `text` may not have caught up with this keystroke yet.
    const q = event.currentTarget.value.trim();
    if (q.length < 3 || unavailable) {
      options = [];
      open = false;
      return;
    }
    timer = setTimeout(() => void lookup(q), 300);
  }

  async function lookup(q: string) {
    const call = ++latest;
    try {
      const response = await fetch(`/places?q=${encodeURIComponent(q)}`);
      const result = (await response.json()) as { items: Place[]; unavailable: boolean };
      if (call !== latest) return; // A newer lookup is on its way.
      if (result.unavailable) unavailable = true;
      options = (filter ? areasOf(result.items) : result.items).slice(0, 8);
    } catch {
      options = [];
    }
    active = -1;
    open = options.length > 0;
    announcement =
      options.length === 0
        ? ''
        : `${options.length} ${options.length === 1 ? 'suggestion' : 'suggestions'}. Use the arrow keys to choose.`;
  }

  /** The neighbourhoods and cities among the results, each once, for the search filter. */
  function areasOf(places: Place[]): Place[] {
    const areas: Place[] = [];
    const seen: string[] = [];
    for (const { neighbourhood, city, region, country } of places) {
      const found = [
        neighbourhood ? { label: neighbourhood, neighbourhood, city } : null,
        city ? { label: city, city } : null
      ];
      for (const area of found) {
        if (!area) continue;
        const key = [area.label, area.city, region, country].join('|');
        if (seen.includes(key)) continue;
        seen.push(key);
        areas.push({ ...area, source: 'suggestion', region, country });
      }
    }
    return areas;
  }

  function choose(option: Place & { display?: string }) {
    const { display: _display, ...place } = option; // Only the place itself is saved.
    picked = place;
    text = place.label;
    open = false;
    options = [];
    announcement = `${place.label} chosen.`;
  }

  function onKeydown(event: KeyboardEvent) {
    if (!open || options.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      active = (active + 1) % options.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      active = active <= 0 ? options.length - 1 : active - 1;
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault(); // Picks the suggestion instead of sending the form.
      choose(options[active]!);
    } else if (event.key === 'Escape') {
      open = false;
    }
  }

  const kindOf = (place: Place) =>
    place.houseNumber
      ? 'Address'
      : place.name && place.street
        ? 'Place'
        : place.neighbourhood
          ? 'Neighbourhood'
          : place.city
            ? 'City or town'
            : 'Place';
  /** What it is and where: the city, region and country its label doesn't already say. */
  function detailOf(place: Place) {
    const where = [place.city, place.region, place.country].filter(
      (part): part is string => Boolean(part) && !place.label.includes(part!)
    );
    return where.length ? `${kindOf(place)} · ${where.join(', ')}` : kindOf(place);
  }
</script>

<div class="relative grid gap-1.5">
  <Label for="{name}_text" class="text-base font-medium">
    {label}{#if optional}<span class="font-normal text-muted-foreground"> (optional)</span>{/if}
  </Label>
  {#if hint}<p id={hintId} class="text-sm text-muted-foreground">{hint}</p>{/if}
  {#if error}<p id={errorId} class="text-sm font-medium text-destructive">{error}</p>{/if}
  <input
    id="{name}_text"
    name={filter ? name : `${name}_text`}
    type="text"
    autocomplete="off"
    maxlength={200}
    role="combobox"
    aria-autocomplete="list"
    aria-expanded={open}
    aria-controls={listId}
    aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
    aria-describedby={describedBy}
    aria-invalid={error ? 'true' : undefined}
    class="min-h-11 w-full rounded-md border border-input bg-card px-3 text-base aria-invalid:border-2 aria-invalid:border-destructive"
    bind:value={text}
    oninput={onInput}
    onkeydown={onKeydown}
    onblur={() => setTimeout(() => (open = false), 150)}
  />
  {#if !filter}<input type="hidden" {name} value={saved} />{/if}
  {#if unavailable}<InfoNote id={noteId}
      >Suggestions aren't available right now. You can type the place.</InfoNote
    >{/if}
  <ul
    id={listId}
    role="listbox"
    aria-label="Suggestions for {label}"
    class="absolute top-full z-10 mt-1 grid w-full gap-0.5 rounded-md border bg-card p-1 shadow-soft {open
      ? ''
      : 'hidden'}"
  >
    {#each options as option, index (option.label + index)}
      <li
        id="{listId}-{index}"
        role="option"
        aria-selected={index === active}
        class="min-h-11 cursor-pointer rounded-lg px-3 py-2 hover:bg-accent {index === active
          ? 'bg-accent outline-2 outline-primary'
          : ''}"
        onmousedown={(event) => {
          event.preventDefault();
          choose(option);
        }}
      >
        <span class="block">{option.label}</span>
        <span class="block text-sm text-muted-foreground">{detailOf(option)}</span>
      </li>
    {/each}
  </ul>
  <div class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
</div>
