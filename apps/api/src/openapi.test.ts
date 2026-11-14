// Every endpoint promised in contracts/api.md must be described in the generated OpenAPI
// document, so other clients (e.g. a future Android app) can rely on it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { api } from './test/setup.ts';

// 003 adds to 002's contract, 004 replaces its proposal and agreement endpoints, 005 changes the
// member profile, and 007 adds Home, so all five are read.
const contract = [
  '002-listing-proposals',
  '003-member-requests',
  '004-arrangements',
  '005-shared-invite-path',
  '007-home-needs-you'
]
  .map((feature) =>
    readFileSync(new URL(`../../../specs/${feature}/contracts/api.md`, import.meta.url), 'utf8')
  )
  .join('\n');

/**
 * Reads the endpoint column of the contract's tables. One cell can list several endpoints:
 * "`GET /me`, `PATCH /me`", or shorthand siblings: "`POST /offerings/{id}/pause`, `/resume`".
 */
function contractEndpoints() {
  const endpoints: string[] = [];
  for (const line of contract.split('\n')) {
    const cell = line.match(/^\|\s*(`[^|]+`)\s*\|/)?.[1];
    if (!cell) continue;
    let method = '';
    let parent = '';
    for (const [, entry] of cell.matchAll(/`([^`]+)`/g)) {
      const full = entry!.match(/^(GET|POST|PUT|PATCH|DELETE) (\/\S*)$/);
      if (full) {
        method = full[1]!;
        parent = full[2]!.replace(/\/[^/]+$/, '');
        endpoints.push(`${method} ${full[2]}`);
      } else if (entry!.startsWith('/') && method) {
        endpoints.push(`${method} ${parent}${entry}`);
      }
    }
  }
  return endpoints;
}

describe('OpenAPI document', () => {
  it('describes every endpoint in the API contract', async () => {
    const { status, body } = await api('GET', '/api/v1/openapi.json');
    expect(status).toBe(200);
    const documented = new Set<string>();
    for (const [path, operations] of Object.entries(body.paths as Record<string, object>)) {
      for (const method of Object.keys(operations)) documented.add(`${method.toUpperCase()} ${path}`);
    }

    const endpoints = contractEndpoints();
    expect(endpoints.length).toBeGreaterThan(50); // The table was read.
    const missing = endpoints
      // Sign-in and sessions belong to Better Auth, documented in the contract itself; the
      // document can't describe itself.
      .filter((endpoint) => !endpoint.includes(' /api/auth/') && endpoint !== 'GET /openapi.json')
      .filter((endpoint) => {
        const [method, path] = endpoint.split(' ');
        return !documented.has(`${method} /api/v1${path}`);
      });
    expect(missing).toEqual([]);
  });
});
