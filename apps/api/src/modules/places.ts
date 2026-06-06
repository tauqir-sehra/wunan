// Places (002 FR-027 to FR-030, research §1–§2): suggestions while typing, how a place is shown to
// whom, and whether two places are in the same area. Every place in an API response goes through
// `viewPlace`, so an offering's full address is never shown to someone who shouldn't see it.
// Suggestions come from the operator's Photon server. Only the typed text (and the operator's fixed
// bias) is sent, from this server: never who is typing. What is typed is never logged.
import type { Place } from '@wunan/shared';
import { z } from 'zod';
import { config } from '../config.ts';
import { ApiError } from '../lib/errors.ts';

/** Lower-cased and without accents, so "Méndez" and "mendez" match. */
export function normalise(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** "Neighbourhood, City" (whichever is known); a typed place shows as typed. */
export function displayOf(place: Place) {
  if (place.source === 'typed') return place.label;
  const parts = [place.neighbourhood, place.city].filter((part): part is string => Boolean(part));
  // Only a street address with no area parts would be left, and that must stay private.
  return parts.length > 0 ? [...new Set(parts)].join(', ') : (place.name ?? 'Area not given');
}

export type PlaceView = (Place & { display: string }) | { display: string };

/** The full place for those allowed to see it, otherwise only its neighbourhood and city. */
export function viewPlace(place: Place | null | undefined, { full }: { full: boolean }): PlaceView | null {
  if (!place) return null;
  return full ? { ...place, display: displayOf(place) } : { display: displayOf(place) };
}

/**
 * Whether `place` is within `area` (002 FR-014): the same neighbourhood, or the same city when the
 * area is a whole city. `null` means wunan can't tell, because one of them was typed rather than
 * picked from a suggestion; the lister then decides.
 */
export function sameArea(area: Place, place: Place): boolean | null {
  if (area.source !== 'suggestion' || place.source !== 'suggestion') return null;
  if (area.neighbourhood) {
    return place.neighbourhood ? normalise(area.neighbourhood) === normalise(place.neighbourhood) : false;
  }
  if (area.city) return place.city ? normalise(area.city) === normalise(place.city) : false;
  return null;
}

// ── Suggestions ────────────────────────────────────────────────────────────────────────────────

const unavailable = () => new ApiError(503, 'places_unavailable', "Place suggestions aren't available right now. You can type the place instead.");

/** The parts of a Photon answer we use; anything else in it is ignored. */
const PhotonAnswer = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }).optional(),
      properties: z.record(z.string(), z.unknown())
    })
  )
});

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, 100) : undefined);
const areaTypes = new Set(['district', 'locality', 'suburb', 'neighbourhood']);
const cityTypes = new Set(['city', 'town', 'village']);

/** One Photon result as a place: its parts, and a label people recognise. */
export function toPlace(feature: z.infer<typeof PhotonAnswer>['features'][number]): Place {
  const p = feature.properties;
  const type = text(p.type);
  const name = text(p.name);
  const street = text(p.street);
  const houseNumber = text(p.housenumber);
  const neighbourhood = text(p.district) ?? text(p.locality) ?? (type && areaTypes.has(type) ? name : undefined);
  const city = text(p.city) ?? (type && cityTypes.has(type) ? name : undefined);
  const streetLine = street ? [houseNumber, street].filter(Boolean).join(' ') : undefined;
  const parts = [name !== street && name !== neighbourhood && name !== city ? name : undefined, streetLine, neighbourhood, city];
  const label = [...new Set(parts.filter((part): part is string => Boolean(part)))].join(', ').slice(0, 200) || 'Unnamed place';
  const [lon, lat] = feature.geometry?.coordinates ?? [];
  return Object.fromEntries(
    Object.entries({ label, source: 'suggestion', name, street, houseNumber, postcode: text(p.postcode), neighbourhood, city, lat, lon }).filter(([, v]) => v !== undefined)
  ) as Place;
}

// Recent answers, so typing the same letters again doesn't ask Photon again (10 minutes, 500 at most).
const cache = new Map<string, { at: number; places: Place[] }>();
const CACHE_MS = 10 * 60_000;
const CACHE_SIZE = 500;

export async function searchPlaces(q: string): Promise<Place[]> {
  if (!config.PLACES_URL) throw unavailable();
  const key = normalise(q);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.places;

  const url = new URL('/api', config.PLACES_URL);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '8');
  url.searchParams.set('lang', 'en');
  if (config.PLACES_BIAS) {
    const [lat, lon] = config.PLACES_BIAS.split(',');
    url.searchParams.set('lat', lat!);
    url.searchParams.set('lon', lon!);
  }
  if (config.PLACES_BBOX) url.searchParams.set('bbox', config.PLACES_BBOX);

  let places: Place[];
  try {
    const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'wunan' }, signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw unavailable();
    const parsed = PhotonAnswer.safeParse(await response.json());
    if (!parsed.success) throw unavailable();
    places = parsed.data.features.slice(0, 8).map(toPlace);
  } catch {
    throw unavailable();
  }
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), places });
  return places;
}

/** For tests: forget cached answers. */
export const clearPlaceCache = () => cache.clear();
