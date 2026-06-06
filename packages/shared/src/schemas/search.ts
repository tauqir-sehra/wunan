// Searching offerings (FR-015 to FR-017). Query-string parameters, so everything arrives as text.
import { z } from 'zod';
import { OfferingType } from './offerings.ts';

const flag = z
  .enum(['true', 'false', '1', '0', 'on', ''])
  .optional()
  .transform((value) => value === 'true' || value === '1' || value === 'on');

const blankToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

export const SearchOfferingsQuery = z.object({
  q: z.preprocess(blankToUndefined, z.string().trim().max(200, 'Please use fewer words.').optional()),
  /** One kind, or several separated by commas ("lend,gift"); none means every kind. */
  type: z.preprocess(
    (value) => {
      const list = (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
        .map((v) => String(v).trim())
        .filter(Boolean);
      return list.length ? [...new Set(list)] : undefined;
    },
    z.array(OfferingType).optional()
  ),
  area: z.preprocess(blankToUndefined, z.string().trim().max(60).optional()),
  includeLent: flag,
  cursor: z.preprocess(blankToUndefined, z.string().max(200).optional()),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});
export type SearchOfferingsQuery = z.infer<typeof SearchOfferingsQuery>;
