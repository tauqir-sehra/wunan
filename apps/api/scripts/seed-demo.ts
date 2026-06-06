// Fills a database with a believable demo community, for trying wunan out, usability sessions,
// and checking search speed (001 SC-006: a filtered search over 5,000 members and 20,000 offerings
// answers in under 2 seconds; 003: browsing 20,000 requests and suggestions while asking do too).
// Development only.
//
//   npm run seed:demo -w apps/api                 (5,000 members, 20,000 offerings, 20,000 requests)
//   npm run seed:demo -w apps/api -- --members 200 --offerings 600 --requests 300
//
// It adds to the database in DATABASE_URL. To keep your own development data separate, point it
// at another database, e.g. DATABASE_URL=postgres://wunan:wunan@localhost:5432/wunan_demo
// (the database must exist; the script sets up its tables).
import { parseArgs } from 'node:util';

if (process.env.NODE_ENV === 'production') {
  console.error('seed-demo adds made-up members and offerings, so it never runs in production.');
  process.exit(1);
}

const { values } = parseArgs({
  options: { members: { type: 'string', default: '5000' }, offerings: { type: 'string', default: '20000' }, requests: { type: 'string', default: '20000' } }
});
const MEMBERS = Number(values.members);
const OFFERINGS = Number(values.offerings);
const REQUESTS = Number(values.requests);

const { runMigrations } = await import('../src/db/migrate.ts');
const { db, sql } = await import('../src/db/index.ts');
const { account, offering, member, publicMessage, request, requestGiveBack, requestLink, tradeAccept } = await import('../src/db/schema/index.ts');
const { listRequests, suggestOfferings } = await import('../src/modules/requests.ts');
const { auth } = await import('../src/auth.ts');
const { searchOfferings } = await import('../src/modules/search.ts');
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

function offeringRow(ownerId: string, index: number): typeof offering.$inferInsert {
  const type = pick(['lend', 'gift', 'gift', 'trade', 'service'] as const);
  const title = `${pick(things[type])}${index % 7 === 0 ? ' (spare)' : ''}`;
  const createdAt = daysAgo(300);
  const area = random() < 0.8 ? areaPlace(pick(areas)) : null;
  // How the handover happens: picked up from the owner (when they gave an area), or online now and then.
  const handovers = area && random() < 0.6 ? (['at_lister'] as const) : random() < 0.1 ? (['online'] as const) : ([] as const);
  const base = { ownerId, type, title, description: pick(describeAs), area, handovers: [...handovers], createdAt, updatedAt: createdAt };
  // Most offerings are available; some are paused or finished, as in a real community.
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

console.log(`Seeding ${MEMBERS} members and ${OFFERINGS} offerings…`);
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

const offerings = Array.from({ length: OFFERINGS }, (_, i) => offeringRow(pick(members).id, i));
await insertInBatches(offerings, (batch) => db.insert(offering).values(batch));
// What a trade accepts in return: about half list something, the rest are open to offers.
const trades = (await db.select({ id: offering.id }).from(offering).where(eq(offering.type, 'trade'))).filter(() => random() < 0.5);
await insertInBatches(
  trades.map((t) => ({ offeringId: t.id, position: 0, description: pick(wantedThings) })),
  (batch) => db.insert(tradeAccept).values(batch)
);
// Search words, as modules/offerings.ts sets them on every save.
await sql`update offering l set search_vector =
  setweight(to_tsvector('english', l.title), 'A') ||
  setweight(to_tsvector('english', coalesce(l.description, '') || ' ' ||
    coalesce((select string_agg(description, ' ') from trade_accept t where t.offering_id = l.id), '')), 'B')`;
await sql`analyze`;

// A few proposals for the demo member, so the Proposals page has something to show.
const { createProposal } = await import('../src/modules/proposals.ts');
const demoMember = members[1]!;
const open = await db.select({ id: offering.id, ownerId: offering.ownerId }).from(offering).where(eq(offering.status, 'available')).limit(40);
let proposed = 0;
for (const item of open) {
  if (proposed >= 5 || item.ownerId === demoMember.id) continue;
  await createProposal(item.id, demoMember.id, { message: 'Hello! Would this work for you?' });
  proposed += 1;
}
// Requests (003): what members ask for, a few with things they could give back.
const asked = {
  borrow: ['Drill for shelves', 'Ladder for the gutters', 'Tent for a weekend', 'Sewing machine', 'Pressure washer'],
  receive: ['Rice', 'Baby clothes', 'Moving boxes', 'Plant pots', 'Children’s books'],
  trade: ['Bike pump', 'Sourdough starter', 'Garden shears', 'Running shoes'],
  service: ['Help moving a sofa', 'Bike tune-up', 'Help with a letter', 'Haircut', 'Someone to walk my dog']
} as const;
const requestRows = Array.from({ length: REQUESTS }, () => {
  const kind = pick(['borrow', 'receive', 'trade', 'service'] as const);
  const createdAt = daysAgo(200);
  const roll = random();
  return {
    askerId: pick(members).id,
    kind,
    title: pick(asked[kind]),
    description: pick([null, 'Any condition is fine.', 'Just for a few days.', 'Happy to pick it up.']),
    area: random() < 0.7 ? areaPlace(pick(areas)) : null,
    ...(kind === 'borrow' ? { loanLength: pick([1, 2, 7]), loanLengthUnit: 'days' as const } : {}),
    status: roll < 0.8 ? ('open' as const) : ('closed' as const),
    closedReason: roll < 0.8 ? null : ('by_asker' as const),
    createdAt,
    updatedAt: createdAt
  };
});
await insertInBatches(requestRows, (batch) => db.insert(request).values(batch));
const tradeRequests = (await db.select({ id: request.id }).from(request).where(eq(request.kind, 'trade'))).filter(() => random() < 0.5);
await insertInBatches(
  tradeRequests.map((r) => ({ requestId: r.id, position: 0, description: pick(wantedThings) })),
  (batch) => db.insert(requestGiveBack).values(batch)
);
await sql`update request r set search_vector =
  setweight(to_tsvector('english', r.title), 'A') ||
  setweight(to_tsvector('english', coalesce(r.description, '') || ' ' ||
    coalesce((select string_agg(description, ' ') from request_give_back g where g.request_id = r.id), '')), 'B')`;

// The demo member asks for a drill; someone answers with an offering and a public message.
if (REQUESTS > 0) {
  const helper = members[0]!;
  const [drillRequest] = await db
    .insert(request)
    .values({ askerId: demoMember.id, kind: 'borrow', title: 'Drill for putting up shelves', area: areaPlace('Riverside'), loanLength: 1, loanLengthUnit: 'days' })
    .returning({ id: request.id });
  const [answer] = await db
    .insert(offering)
    .values({ ownerId: helper.id, type: 'lend', title: 'Cordless drill', amount: '1', unit: 'item', loanLength: 2, loanLengthUnit: 'days', area: areaPlace('Riverside') })
    .returning({ id: offering.id });
  await sql`update offering set search_vector = setweight(to_tsvector('english', title), 'A') where id = ${answer!.id}`;
  await db.insert(requestLink).values({ requestId: drillRequest!.id, offeringId: answer!.id, linkedById: helper.id });
  await db.insert(publicMessage).values([
    { requestId: drillRequest!.id, authorId: helper.id, body: 'Is it for brick or plaster walls?' },
    { requestId: drillRequest!.id, authorId: demoMember.id, body: 'Plaster. Thank you!' },
    { offeringId: answer!.id, authorId: members[2]!.id, body: 'Does it come with a charger?' }
  ]);
}
await sql`analyze`;
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
  const result = await searchOfferings({ limit: 20, includeLent: false, ...query }, members[0]!.id);
  const ms = performance.now() - begin;
  slowest = Math.max(slowest, ms);
  console.log(`  search ${JSON.stringify(query).padEnd(52)} ${String(result.items.length).padStart(2)} results  ${ms.toFixed(0)} ms`);
}
// 003: browsing requests and suggestions while asking answer in under 2 seconds too (SC-004).
const requestQueries = [{ q: 'drill' }, { kind: ['service' as const], area: 'Old Town' }, { q: 'rice', kind: ['receive' as const] }, {}];
for (const query of requestQueries) {
  const begin = performance.now();
  const result = await listRequests({ limit: 20, mine: false, kind: undefined, ...query }, members[0]!.id);
  const ms = performance.now() - begin;
  slowest = Math.max(slowest, ms);
  console.log(`  requests ${JSON.stringify(query).padEnd(50)} ${String(result.items.length).padStart(2)} results  ${ms.toFixed(0)} ms`);
}
for (const query of [{ kind: 'borrow' as const, q: 'drill', area: 'Riverside' }, { kind: 'receive' as const, q: 'apples' }]) {
  const begin = performance.now();
  const result = await suggestOfferings(query, members[0]!.id);
  const ms = performance.now() - begin;
  slowest = Math.max(slowest, ms);
  console.log(`  suggestions ${JSON.stringify(query).padEnd(47)} ${String(result.items.length).padStart(2)} results  ${ms.toFixed(0)} ms`);
}
console.log(slowest < 2000 ? `Search speed: OK (slowest ${slowest.toFixed(0)} ms, limit 2000 ms).` : `Search speed: TOO SLOW (slowest ${slowest.toFixed(0)} ms).`);
console.log(`\nSign in as demo.founder@example.org or demo.member@example.org, password "${DEMO_PASSWORD}".`);
if (slowest >= 2000) process.exitCode = 1;
await sql.end();
