// Places (002 FR-027 to FR-030): areas, meeting places, and where a handover happens. A place is
// either picked from a suggestion (with its parts, used for "neighbourhood, city" and area checks)
// or typed as plain text. Other members see an offering's place only as `{ display }` until a
// proposal on it is accepted; the API decides that (apps/api/src/modules/places.ts).
import { z } from 'zod';

const part = z.string().trim().max(100).optional();

const PlaceObject = z
  .strictObject({
    label: z
      .string({ message: 'Please enter a place.' })
      .trim()
      .min(1, 'Please enter a place.')
      .max(200, 'Please keep the place to 200 characters or fewer.'),
    source: z.enum(['suggestion', 'typed']).default('typed'),
    name: part,
    street: part,
    houseNumber: part,
    postcode: part,
    neighbourhood: part,
    city: part,
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional()
  })
  .transform((place) =>
    // A typed place never carries parts, whatever a client sends.
    place.source === 'typed' ? { label: place.label, source: 'typed' as const } : place
  );

/**
 * A place as clients send it. Plain text is accepted too, as a typed place, so simple clients
 * don't need to build the object; an empty text means "no place".
 */
export const Place = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const label = value.trim();
  return label ? { label, source: 'typed' } : null;
}, PlaceObject.nullable());
export type Place = NonNullable<z.infer<typeof PlaceObject>>;

/** What other members see of an offering's place: only its neighbourhood and city. */
export const PlaceDisplay = z.object({ display: z.string() });

/** A place as returned by the API: in full, or reduced to its display text. */
export const PlaceView = z.union([
  z.object({
    label: z.string(),
    source: z.enum(['suggestion', 'typed']),
    name: z.string().optional(),
    street: z.string().optional(),
    houseNumber: z.string().optional(),
    postcode: z.string().optional(),
    neighbourhood: z.string().optional(),
    city: z.string().optional(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    display: z.string()
  }),
  PlaceDisplay
]);
export type PlaceView = z.infer<typeof PlaceView>;

export const PlacesQuery = z.object({
  q: z
    .string({ message: 'Please type at least 3 characters.' })
    .trim()
    .min(3, 'Please type at least 3 characters.')
    .max(100, 'Please type at most 100 characters.')
});

export const PlaceSuggestions = z.object({ items: z.array(PlaceView) });
