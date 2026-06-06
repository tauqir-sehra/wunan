// Finding offerings (001 FR-015 to FR-017; research §5): PostgreSQL full-text search with English word
// forms ("rices" finds "Rice"), filters for type and area, available offerings that aren't lent out
// unless asked for lent-out ones too. Newest first, a page at a time. The area filter looks only at
// what others can see of an area (neighbourhood, city, or typed text), never a street address.
import type { SearchOfferingsQuery } from '@wunan/shared';
import { and, desc, eq, inArray, lt, not, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { offering } from '../db/schema/index.ts';
import { describe, lentOutNow } from './offerings.ts';

/** Where the next page starts: the last offering's time and id, encoded so clients treat it as opaque. */
type Cursor = { createdAt: string; id: string };
const encodeCursor = (cursor: Cursor) => Buffer.from(JSON.stringify(cursor)).toString('base64url');
function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as Cursor;
    return typeof parsed.createdAt === 'string' && typeof parsed.id === 'string' ? parsed : null;
  } catch {
    return null; // A broken cursor just starts from the beginning.
  }
}

/** Escapes % and _ so an area like "100%" is matched literally. */
const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function searchOfferings(query: SearchOfferingsQuery, viewerId: string) {
  const conditions: SQL[] = [eq(offering.status, 'available')];
  if (!query.includeLent) conditions.push(not(lentOutNow));
  if (query.q) conditions.push(sql`${offering.searchVector} @@ websearch_to_tsquery('english', ${query.q})`);
  // Every kind chosen is the same as no filter.
  if (query.type && query.type.length < 4) conditions.push(inArray(offering.type, query.type));
  if (query.area) {
    const pattern = likePattern(query.area);
    conditions.push(sql`(${offering.areaNeighbourhood} ilike ${pattern} or ${offering.areaCity} ilike ${pattern}
      or (${offering.area}->>'source' = 'typed' and ${offering.area}->>'label' ilike ${pattern}))`);
  }

  const cursor = decodeCursor(query.cursor);
  if (cursor) {
    const after = new Date(cursor.createdAt);
    conditions.push(or(lt(offering.createdAt, after), and(eq(offering.createdAt, after), lt(offering.id, cursor.id)))!);
  }

  // Newest first; among offerings from the same moment, the better match first.
  const order = [desc(offering.createdAt)];
  if (query.q) order.push(desc(sql`ts_rank(${offering.searchVector}, websearch_to_tsquery('english', ${query.q}))`));
  order.push(desc(offering.id));
  // One extra row tells us whether there is a next page.
  const rows = await db
    .select()
    .from(offering)
    .where(and(...conditions))
    .orderBy(...order)
    .limit(query.limit + 1);

  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: await describe(page, viewerId),
    nextCursor: rows.length > query.limit && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null
  };
}
