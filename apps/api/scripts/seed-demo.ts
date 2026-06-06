// Fills a database with a believable demo community, for trying wunan out, usability sessions,
// and checking search speed (SC-006: a filtered search over 5,000 members and 20,000 listings
// answers in under 2 seconds). Development only.
//
//   npm run seed:demo -w apps/api                            (5,000 members, 20,000 listings)
//   npm run seed:demo -w apps/api -- --members 200 --listings 600
//
// It adds to the database in DATABASE_URL. To keep your own development data separate, point it
// at another database, e.g. DATABASE_URL=postgres://wunan:wunan@localhost:5432/wunan_demo
// (the database must exist; the script sets up its tables).
import { parseArgs } from 'node:util';

if (process.env.NODE_ENV === 'production') {
  console.error('seed-demo adds made-up members and listings, so it never runs in production.');
  process.exit(1);
}

const { values } = parseArgs({
  options: { members: { type: 'string', default: '5000' }, listings: { type: 'string', default: '20000' } }
});
const MEMBERS = Number(values.members);
const LISTINGS = Number(values.listings);

const { runMigrations } = await import('../src/db/migrate.ts');
const { db, sql } = await import('../src/db/index.ts');
const { account, listing, member, tradeAccept } = await import('../src/db/schema/index.ts');
const { auth } = await import('../src/auth.ts');
const { searchListings } = await import('../src/modules/search.ts');
const { eq } = await import('drizzle-orm');

await runMigrations();
const [existing] = await db.select({ id: member.id }).from(member).where(eq(member.email, 'demo.founder@example.org'));
if (existing) {
  console.error('This database already has the demo community. Use a fresh database to seed again.');
  await sql.end();
  process.exit(1);
}

// A repeatable random sequence, so every seeded database looks the same.
let seed = 42;
const random = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
const DAY = 86_400_000;
const daysAgo = (max: number) => new Date(Date.now() - Math.floor(random() * max * DAY));

const firstNames = ['Alex', 'Sam', 'Robin', 'Kim', 'Jo', 'Ana', 'Ben', 'Fay', 'Gus', 'Olu', 'Priya', 'Mei', 'Tomás', 'Amara', 'Lena', 'Yusuf', 'Ines', 'Noah', 'Rosa', 'Kofi', 'Hana', 'Ivan', 'Zara', 'Leo', 'Maya', 'Omar', 'Sofia', 'Ravi', 'Elif', 'Theo'];
const lastInitials = 'ABCDEFGHJKLMNOPRSTW'.split('');
const areas = ['Riverside', 'Old Town', 'Northfield', 'Park Lane', 'Station Road', 'Hillcrest', 'Market Square', 'Eastgate', 'Mill Street', 'Greenway'];
const bios = [null, null, 'I like fixing bikes and growing tomatoes.', 'Happy to lend tools. Ask any time.', 'Parent of two, always have spare kids’ clothes.', 'I bake on Sundays.', null];

const things = {
  lend: ['Drill', 'Ladder', 'Lawn mower', 'Tent', 'Pressure washer', 'Sewing machine', 'Projector', 'Hedge trimmer', 'Camping stove', 'Car roof box', 'Bread maker', 'Wheelbarrow', 'Board games', 'Paddling pool', 'Jigsaw'],
  gift: ['Rice', 'Apples', 'Baby clothes', 'Bookshelf', 'Plant cuttings', 'Jam jars', 'Children’s books', 'Firewood', 'Courgettes', 'Winter coat', 'Flour', 'Moving boxes', 'Lentils', 'Bread', 'Seeds'],
  trade: ['Sourdough starter', 'Honey', 'Eggs', 'Leather boots', 'Knitted scarf', 'Homemade jam', 'Tomato plants', 'Bike lights', 'Vinyl records', 'Running shoes'],
  service: ['Bike repair', 'Bodywork session', 'Guitar lesson', 'Help with forms', 'Haircut', 'Dog walking', 'Maths tutoring', 'Phone help for beginners', 'Sewing repairs', 'Garden help']
} as const;
const describeAs = ['Good condition.', 'Pick up any evening this week.', 'I can drop it off nearby.', 'Works well, a bit worn.', 'From my garden.', 'Spare after a big shop.', null];
const wantedThings = ['Eggs', 'Help in the garden', 'A bike pump', 'Some honey', 'Jam', 'Books', 'Baking'];

/** A demo area as if picked from a suggestion: neighbourhood and city. */
const areaPlace = (neighbourhood: string) => ({ label: `${neighbourhood}, Springfield`, source: 'suggestion' as const, neighbourhood, city: 'Springfield' });

function listingRow(ownerId: string, index: number): typeof listing.$inferInsert {
  const type = pick(['lend', 'gift', 'gift', 'trade', 'service'] as const);
  const title = `${pick(things[type])}${index % 7 === 0 ? ' (spare)' : ''}`;
  const createdAt = daysAgo(300);
  const area = random() < 0.8 ? areaPlace(pick(areas)) : null;
  // How the handover happens: picked up from the owner (when they gave an area), or online now and then.
  const handovers = area && random() < 0.6 ? (['at_lister'] as const) : random() < 0.1 ? (['online'] as const) : ([] as const);
  const base = { ownerId, type, title, description: pick(describeAs), area, handovers: [...handovers], createdAt, updatedAt: createdAt };
  // Most listings are available; some are paused or finished, as in a real community.
  const roll = random();
  const status = roll < 0.8 ? 'available' : roll < 0.9 ? 'paused' : 'closed';
  const closed = status === 'closed' ? { closedReason: 'used_up' as const } : {};
  switch (type) {
    case 'lend':
      return { ...base, status, ...(status === 'closed' ? { closedReason: 'removed' as const } : {}), amount: '1', unit: 'item', loanLength: pick([1, 2, 3, 7]), loanLengthUnit: pick(['days', 'weeks'] as const) };
    case 'gift': {
      const amount = String(pick([1, 2, 5, 10]));
      return { ...base, status, ...closed, amount, unit: pick(['kg', 'item', 'bag', 'box'] as const), remaining: status === 'closed' ? '0' : amount };
    }
    case 'trade':
      return { ...base, status, ...closed };
    case 'service':
      return { ...base, status, ...closed, sessionLength: pick([30, 60, 90]), sessionLengthUnit: 'minutes' };
  }
}

async function insertInBatches<T>(rows: T[], insert: (batch: T[]) => Promise<unknown>) {
  for (let start = 0; start < rows.length; start += 1000) await insert(rows.slice(start, start + 1000));
}

console.log(`Seeding ${MEMBERS} members and ${LISTINGS} listings…`);
const started = Date.now();
const ctx = await auth.$context;
const DEMO_PASSWORD = 'demo password 123';
// One hash for everyone keeps seeding quick; every demo account has the same password.
const passwordHash = await ctx.password.hash(DEMO_PASSWORD);

// Founders first, then each member invited by someone who joined before them.
const members: (typeof member.$inferInsert & { id: string })[] = [];
for (let i = 0; i < MEMBERS; i += 1) {
  const named = i === 0 ? { email: 'demo.founder@example.org', displayName: 'Fay (founder)' }
    : i === 1 ? { email: 'demo.member@example.org', displayName: 'Sam' }
    : { email: `member-${i}@demo.invalid`, displayName: `${pick(firstNames)} ${pick(lastInitials)}.` };
  const isFounder = i < 3;
  members.push({
    id: crypto.randomUUID(),
    ...named,
    emailVerified: true,
    isFounder,
    invitedById: isFounder ? null : members[Math.floor(random() * i)]!.id,
    bio: pick(bios),
    createdAt: new Date(Date.now() - (MEMBERS - i) * (365 * DAY / MEMBERS))
  });
}
await insertInBatches(members, (batch) => db.insert(member).values(batch));
await insertInBatches(
  members.map((m) => ({ userId: m.id, accountId: m.id, providerId: 'credential', password: passwordHash })),
  (batch) => db.insert(account).values(batch)
);

const listings = Array.from({ length: LISTINGS }, (_, i) => listingRow(pick(members).id, i));
await insertInBatches(listings, (batch) => db.insert(listing).values(batch));
// What a trade accepts in return: about half list something, the rest are open to offers.
const trades = (await db.select({ id: listing.id }).from(listing).where(eq(listing.type, 'trade'))).filter(() => random() < 0.5);
await insertInBatches(
  trades.map((t) => ({ listingId: t.id, position: 0, description: pick(wantedThings) })),
  (batch) => db.insert(tradeAccept).values(batch)
);
// Search words, as modules/listings.ts sets them on every save.
await sql`update listing l set search_vector =
  setweight(to_tsvector('english', l.title), 'A') ||
  setweight(to_tsvector('english', coalesce(l.description, '') || ' ' ||
    coalesce((select string_agg(description, ' ') from trade_accept t where t.listing_id = l.id), '')), 'B')`;
await sql`analyze`;

// A few proposals for the demo member, so the Proposals page has something to show.
const { createProposal } = await import('../src/modules/proposals.ts');
const demoMember = members[1]!;
const open = await db.select({ id: listing.id, ownerId: listing.ownerId }).from(listing).where(eq(listing.status, 'available')).limit(40);
let proposed = 0;
for (const item of open) {
  if (proposed >= 5 || item.ownerId === demoMember.id) continue;
  await createProposal(item.id, demoMember.id, { message: 'Hello! Would this work for you?' });
  proposed += 1;
}
console.log(`Seeded in ${((Date.now() - started) / 1000).toFixed(1)} s.`);

// SC-006: filtered searches answer in under 2 seconds.
const queries = [
  { q: 'drill', type: ['lend' as const] },
  { q: 'rice', type: ['gift' as const], area: 'Riverside' },
  { q: 'bike repair' },
  { type: ['service' as const, 'trade' as const], area: 'Old Town' },
  { q: 'apples', includeLent: true },
  {}
];
let slowest = 0;
for (const query of queries) {
  const begin = performance.now();
  const result = await searchListings({ limit: 20, includeLent: false, ...query }, members[0]!.id);
  const ms = performance.now() - begin;
  slowest = Math.max(slowest, ms);
  console.log(`  search ${JSON.stringify(query).padEnd(52)} ${String(result.items.length).padStart(2)} results  ${ms.toFixed(0)} ms`);
}
console.log(slowest < 2000 ? `Search speed: OK (slowest ${slowest.toFixed(0)} ms, limit 2000 ms).` : `Search speed: TOO SLOW (slowest ${slowest.toFixed(0)} ms).`);
console.log(`\nSign in as demo.founder@example.org or demo.member@example.org, password "${DEMO_PASSWORD}".`);
if (slowest >= 2000) process.exitCode = 1;
await sql.end();
