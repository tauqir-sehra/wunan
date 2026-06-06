// Thread endpoints (002 contracts/api.md, "Threads"): the messages of a proposal or a problem
// report. There is no inbox and no way to start a thread here. Includes the live
// stream: Server-Sent Events carrying each new message as `event: message`, plus a heartbeat
// comment every 25 seconds so proxies keep the connection open.
import { createRoute, z } from '@hono/zod-openapi';
import { Message, MessagesPage, ProposeCall, SendMessage, ShareContact } from '@wunan/shared';
import { streamSSE } from 'hono/streaming';
import { createRouter } from '../app-router.ts';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { member } from '../db/schema/index.ts';
import { requireMember } from '../lib/require-member.ts';
import { subscribe } from '../modules/live.ts';
import * as messaging from '../modules/messaging.ts';
import { eq } from 'drizzle-orm';

export const conversationRoutes = createRouter();
conversationRoutes.use('/conversations/*', requireMember);

const security = [{ bearer: [] }];
const Id = z.object({ id: z.uuid({ message: 'That conversation could not be found.' }) });
const body = <T extends z.ZodType>(schema: T) => ({ content: { 'application/json': { schema } } });
const reply = <T extends z.ZodType>(schema: T, description: string) => ({ description, content: { 'application/json': { schema } } });
// Every 25 seconds; much faster under test so heartbeats can be checked quickly.
const HEARTBEAT_MS = config.NODE_ENV === 'test' ? 300 : 25_000;

conversationRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/conversations/{id}/messages',
    summary: 'Messages in a conversation, newest first',
    security,
    request: { params: Id, query: z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(50).default(50) }) },
    responses: { 200: reply(MessagesPage, 'Messages') }
  }),
  async (c) => {
    const { cursor, limit } = c.req.valid('query');
    return c.json(await messaging.listMessages(c.req.valid('param').id, c.get('member').id, cursor, limit), 200);
  }
);

conversationRoutes.openapi(
  createRoute({ method: 'post', path: '/conversations/{id}/messages', summary: 'Send a message', security, request: { params: Id, body: body(SendMessage) }, responses: { 201: reply(Message, 'The message') } }),
  async (c) => c.json(await messaging.sendMessage(c.req.valid('param').id, c.get('member').id, c.req.valid('json').body), 201)
);

conversationRoutes.openapi(
  createRoute({ method: 'post', path: '/conversations/{id}/read', summary: 'Mark a conversation as read', security, request: { params: Id }, responses: { 204: { description: 'Marked read' } } }),
  async (c) => {
    await messaging.markRead(c.req.valid('param').id, c.get('member').id);
    return c.body(null, 204);
  }
);

conversationRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/conversations/{id}/contact-share',
    summary: 'Share exactly the chosen saved contact details in this conversation',
    security,
    request: { params: Id, body: body(ShareContact) },
    responses: { 201: reply(Message, 'The contact_shared message') }
  }),
  async (c) => c.json(await messaging.shareContact(c.req.valid('param').id, c.get('member').id, c.req.valid('json')), 201)
);

conversationRoutes.openapi(
  createRoute({ method: 'post', path: '/conversations/{id}/calls', summary: 'Suggest a time to call', security, request: { params: Id, body: body(ProposeCall) }, responses: { 201: reply(Message, 'The call_proposed message') } }),
  async (c) => c.json(await messaging.proposeCall(c.req.valid('param').id, c.get('member').id, new Date(c.req.valid('json').proposedTime)), 201)
);

conversationRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/conversations/{id}/calls/{messageId}/accept',
    summary: 'Accept a suggested call time (the other participant only)',
    security,
    request: { params: Id.extend({ messageId: z.uuid() }) },
    responses: { 201: reply(Message, 'The call_accepted message') }
  }),
  async (c) => {
    const { id, messageId } = c.req.valid('param');
    return c.json(await messaging.acceptCall(id, c.get('member').id, messageId), 201);
  }
);

conversationRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/conversations/{id}/live',
    summary: 'Live stream of new messages (Server-Sent Events, event "message")',
    security,
    request: { params: Id },
    responses: { 200: { description: 'text/event-stream', content: { 'text/event-stream': { schema: z.string() } } } }
  }),
  async (c) => {
    const conversationId = c.req.valid('param').id;
    const memberId = c.get('member').id;
    // 404 for anyone else; mediators may follow a thread shared with them.
    await messaging.requireAccess(conversationId, memberId, { write: false });

    return streamSSE(c, async (stream) => {
      const unsubscribe = subscribe(conversationId, memberId, (messageId) => {
        void messaging.getMessage(messageId).then((json) => {
          if (json) void stream.writeSSE({ event: 'message', id: json.id, data: JSON.stringify(json) });
        });
      });
      stream.onAbort(() => void unsubscribe());
      await stream.write(': connected\n\n');
      while (!stream.aborted && !stream.closed) {
        await stream.sleep(HEARTBEAT_MS);
        // Close the stream if the member has left wunan since it opened.
        const [row] = await db.select({ deletedAt: member.deletedAt }).from(member).where(eq(member.id, memberId));
        if (!row || row.deletedAt) break;
        await stream.write(': heartbeat\n\n');
      }
      await unsubscribe();
    });
  }
);

