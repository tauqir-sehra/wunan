// Public thread endpoints (003 contracts/api.md, "Public threads"): reading and posting on a request
// or an offering, live updates (Server-Sent Events, `event: message` with the message, plus a
// heartbeat), authors removing their own messages, and raising an issue about one.
import { createRoute, z } from '@hono/zod-openapi';
import { CreateFlag, PostPublicMessage, PublicThread, ThreadQuery } from '@wunan/shared';
import { eq } from 'drizzle-orm';
import { streamSSE } from 'hono/streaming';
import { createRouter } from '../app-router.ts';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { member } from '../db/schema/index.ts';
import { requireMember } from '../lib/require-member.ts';
import { subscribe } from '../modules/live.ts';
import * as threads from '../modules/public-messages.ts';

export const publicMessageRoutes = createRouter();
for (const path of ['/requests/*', '/offerings/*', '/public-messages/*']) publicMessageRoutes.use(path, requireMember);

const security = [{ bearer: [] }];
const Id = z.object({ id: z.uuid({ message: 'That page could not be found.' }) });
const body = <T extends z.ZodType>(schema: T) => ({ content: { 'application/json': { schema } } });
const reply = <T extends z.ZodType>(schema: T, description: string) => ({ description, content: { 'application/json': { schema } } });
const HEARTBEAT_MS = config.NODE_ENV === 'test' ? 300 : 25_000;

for (const kind of ['requests', 'offerings'] as const) {
  const subjectOf = (id: string): threads.Subject => (kind === 'requests' ? { requestId: id } : { offeringId: id });
  const what = kind === 'requests' ? 'request' : 'offering';

  publicMessageRoutes.openapi(
    createRoute({
      method: 'get',
      path: `/${kind}/{id}/messages`,
      summary: `Public messages on a ${what}: the newest 20, oldest first (before=<id> for earlier ones)`,
      security,
      request: { params: Id, query: ThreadQuery },
      responses: { 200: reply(PublicThread, 'The thread') }
    }),
    async (c) => c.json(await threads.listThread(subjectOf(c.req.valid('param').id), c.get('member').id, c.req.valid('query').before), 200)
  );

  publicMessageRoutes.openapi(
    createRoute({
      method: 'post',
      path: `/${kind}/{id}/messages`,
      summary: `Post a public message (1–240 characters) on a ${what}; anyone in wunan can read it`,
      security,
      request: { params: Id, body: body(PostPublicMessage) },
      responses: { 201: reply(z.object({ id: z.string() }), 'Posted') }
    }),
    async (c) => c.json(await threads.postMessage(subjectOf(c.req.valid('param').id), c.get('member').id, c.req.valid('json').body), 201)
  );

  publicMessageRoutes.openapi(
    createRoute({
      method: 'get',
      path: `/${kind}/{id}/messages/live`,
      summary: `Live stream of new and removed public messages on a ${what} (Server-Sent Events, event "message")`,
      security,
      request: { params: Id },
      responses: { 200: { description: 'text/event-stream', content: { 'text/event-stream': { schema: z.string() } } } }
    }),
    async (c) => {
      const id = c.req.valid('param').id;
      const memberId = c.get('member').id;
      await threads.requireThread(subjectOf(id));
      return streamSSE(c, async (stream) => {
        const unsubscribe = subscribe(
          id,
          memberId,
          (messageId) => {
            void threads.getPublicMessage(messageId, memberId).then((json) => {
              if (json) void stream.writeSSE({ event: 'message', id: json.id, data: JSON.stringify(json) });
            });
          },
          'public'
        );
        stream.onAbort(() => void unsubscribe());
        await stream.write(': connected\n\n');
        while (!stream.aborted && !stream.closed) {
          await stream.sleep(HEARTBEAT_MS);
          const [row] = await db.select({ deletedAt: member.deletedAt }).from(member).where(eq(member.id, memberId));
          if (!row || row.deletedAt) break;
          await stream.write(': heartbeat\n\n');
        }
        await unsubscribe();
      });
    }
  );
}

publicMessageRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/public-messages/{id}',
    summary: 'Remove your own public message (it then shows as "Message removed")',
    security,
    request: { params: Id },
    responses: { 204: { description: 'Removed' } }
  }),
  async (c) => {
    await threads.removeMessage(c.req.valid('param').id, c.get('member').id);
    return c.body(null, 204);
  }
);

publicMessageRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/public-messages/{id}/flags',
    summary: "Send a message's author a written request about it (doesn't change it)",
    security,
    request: { params: Id, body: body(CreateFlag) },
    responses: { 204: { description: 'Sent to the author' } }
  }),
  async (c) => {
    await threads.flagMessage(c.req.valid('param').id, c.get('member').id, c.req.valid('json').request);
    return c.body(null, 204);
  }
);

