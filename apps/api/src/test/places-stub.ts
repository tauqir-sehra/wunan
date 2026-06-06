// A stand-in for a Photon place-search server, used by the API and browser tests so they never
// reach the internet. It answers `/api?q=…` with a few fixed places around "Riverside, Springfield".
// Modes for testing failures: a query containing "slow" waits 3 s; one containing "broken" fails.
// Run on its own with: node src/test/places-stub.ts 3999
import { createServer, type IncomingMessage, type Server } from 'node:http';

type Feature = { geometry: { coordinates: [number, number] }; properties: Record<string, string> };

const feature = (lon: number, lat: number, properties: Record<string, string>): Feature => ({
  geometry: { coordinates: [lon, lat] },
  properties: { country: 'United Kingdom', ...properties }
});

export const stubPlaces: Feature[] = [
  feature(-1.5, 52.4, { name: 'Riverside', type: 'district', osm_value: 'suburb', city: 'Springfield' }),
  feature(-1.51, 52.41, { housenumber: '1', street: 'Mill Street', postcode: 'SP1 2AB', district: 'Riverside', city: 'Springfield', type: 'house' }),
  feature(-1.52, 52.4, { name: 'Riverside Library', osm_value: 'library', street: 'Mill Street', district: 'Riverside', city: 'Springfield', type: 'house' }),
  feature(-1.4, 52.5, { name: 'Old Town', type: 'district', city: 'Springfield' }),
  feature(-1.45, 52.45, { name: 'Springfield', type: 'city' })
];

/** The query strings the stub has received, so tests can check what was sent. */
export const receivedQueries: URLSearchParams[] = [];

function answer(request: IncomingMessage) {
  const url = new URL(request.url ?? '/', 'http://stub');
  receivedQueries.push(url.searchParams);
  const q = (url.searchParams.get('q') ?? '').toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const label = (f: Feature) => Object.values(f.properties).join(' ').toLowerCase();
  return stubPlaces.filter((f) => words.every((word) => label(f).includes(word)));
}

export function startPlacesStub(port = 0): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    const q = new URL(request.url ?? '/', 'http://stub').searchParams.get('q') ?? '';
    if (q.includes('broken')) {
      response.writeHead(500).end();
      return;
    }
    const send = () => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ type: 'FeatureCollection', features: answer(request) }));
    };
    if (q.includes('slow')) setTimeout(send, 3000);
    else send();
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      resolve({ server, url: `http://127.0.0.1:${actualPort}` });
    });
  });
}

if (import.meta.main) {
  const { url } = await startPlacesStub(Number(process.argv[2] ?? 3999));
  console.log(`Place-search stub listening on ${url}`);
}
