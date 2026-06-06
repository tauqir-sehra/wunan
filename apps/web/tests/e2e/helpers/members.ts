// Test helpers that create members the same way real people do: founders with the setup script,
// everyone else through invitations and the emailed confirmation link (read from Mailpit).
import { execFileSync } from 'node:child_process';
import { API_URL, WEB_URL } from '../../../playwright.config.ts';

// Like the web server, test calls to the API say which site they come from (Better Auth's CSRF check).
const origin = { origin: WEB_URL };

export type TestMember = { email: string; password: string; displayName: string };

let counter = 0;
function uniqueEmail(name: string) {
  counter += 1;
  return `${name.toLowerCase().replace(/\W+/g, '')}.${Date.now()}.${counter}@example.org`;
}

/** Creates a founding member with the same script operators use. */
export function createFounder(displayName = 'Founder'): TestMember {
  const member = { email: uniqueEmail(displayName), password: 'correct horse battery', displayName };
  execFileSync(
    'npm',
    ['run', 'create-founder', '-w', 'apps/api', '--', '--email', member.email, '--name', displayName, '--password', member.password],
    { cwd: '../..', env: { ...process.env, DATABASE_URL: testDatabaseUrl() }, stdio: 'pipe' }
  );
  return member;
}

/** Signs in through the API and returns the bearer token. */
export async function signIn(member: TestMember): Promise<string> {
  const response = await fetch(`${API_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...origin },
    body: JSON.stringify({ email: member.email, password: member.password })
  });
  const token = response.headers.get('set-auth-token');
  if (!response.ok || !token) throw new Error(`Sign-in failed for ${member.email}: ${response.status}`);
  return token;
}

/** Creates an invitation as `inviter` and returns its link. */
export async function createInvitation(inviter: TestMember): Promise<string> {
  const token = await signIn(inviter);
  const response = await fetch(`${API_URL}/api/v1/invitations`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, ...origin }
  });
  if (!response.ok) throw new Error(`Could not create invitation: ${response.status}`);
  const { link } = (await response.json()) as { link: string };
  return link;
}

/** Invites, signs up, and confirms a new member, all through the API and Mailpit. */
export async function createInvitedMember(inviter: TestMember, displayName = 'Alex'): Promise<TestMember> {
  const link = await createInvitation(inviter);
  const inviteToken = link.split('/join/')[1];
  const member = { email: uniqueEmail(displayName), password: 'correct horse battery', displayName };
  const accept = await fetch(`${API_URL}/api/v1/invitations/${inviteToken}/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...origin },
    body: JSON.stringify({ ...member, emailNotifications: false })
  });
  if (accept.status !== 202) throw new Error(`Could not accept invitation: ${accept.status}`);
  const confirmToken = await confirmationTokenFor(member.email);
  const confirm = await fetch(`${API_URL}/api/v1/invitations/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...origin },
    body: JSON.stringify({ token: confirmToken })
  });
  if (!confirm.ok) throw new Error(`Could not confirm ${member.email}: ${confirm.status}`);
  return member;
}

/** Waits for the confirmation email in Mailpit and returns the token from its link. */
export async function confirmationTokenFor(email: string): Promise<string> {
  const link = await waitForEmailLink(email, /\/join\/confirm\/([^\s"<>]+)/);
  return link;
}

/** Polls Mailpit until an email to `to` contains a link matching `pattern`; returns group 1. */
export async function waitForEmailLink(to: string, pattern: RegExp): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const search = await fetch(
      `http://localhost:8025/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`
    );
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    for (const message of messages) {
      const body = await fetch(`http://localhost:8025/api/v1/message/${message.ID}`);
      const { Text } = (await body.json()) as { Text: string };
      const match = Text.match(pattern);
      if (match?.[1]) return match[1];
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`No matching email arrived for ${to}`);
}

function testDatabaseUrl() {
  return process.env.TEST_DATABASE_URL ?? 'postgres://wunan:wunan@localhost:5432/wunan_test';
}

/** Creates a listing through the API (quicker than the form when a test only needs it to exist). */
export async function createListingFor(member: TestMember, body: Record<string, unknown>): Promise<{ id: string }> {
  const token = await signIn(member);
  const response = await fetch(`${API_URL}/api/v1/listings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...origin },
    body: JSON.stringify(body)
  });
  if (response.status !== 201) throw new Error(`Could not create listing: ${response.status} ${await response.text()}`);
  return (await response.json()) as { id: string };
}

/** The member's id, looked up through the API. */
export async function memberIdOf(member: TestMember): Promise<string> {
  const token = await signIn(member);
  const response = await fetch(`${API_URL}/api/v1/me`, { headers: { authorization: `Bearer ${token}`, ...origin } });
  return ((await response.json()) as { id: string }).id;
}

/** `member` makes a proposal on a listing (with a first message), as people do before agreeing. */
export async function proposeOn(member: TestMember, listingId: string, details: Record<string, unknown> = {}) {
  const token = await signIn(member);
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...origin };
  const response = await fetch(`${API_URL}/api/v1/listings/${listingId}/proposals`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: 'Is this still available?', ...details })
  });
  if (response.status !== 201) throw new Error(`Could not propose: ${response.status} ${await response.text()}`);
  return (await response.json()) as { id: string; conversationId: string };
}

/** A date some days ahead, as YYYY-MM-DD. */
export function daysAhead(days: number) {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Complete details for a listing type, so the proposal can be accepted straight away. */
export function completeDetails(type: 'lend' | 'gift' | 'trade' | 'service', extra: Record<string, unknown> = {}) {
  const byType: Record<string, Record<string, unknown>> = {
    lend: { loanLength: 2, loanLengthUnit: 'days' },
    gift: {},
    trade: { ownOffer: 'A jar of jam' },
    service: { sessionLength: 1, sessionLengthUnit: 'hours', sessions: 1 }
  };
  return { date: daysAhead(3), time: '10:00', handover: 'online', ...byType[type], ...extra };
}

/** `owner` accepts a proposal on their listing; returns the agreement id. */
export async function acceptProposal(owner: TestMember, proposalId: string) {
  const token = await signIn(owner);
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...origin };
  const shown = (await (await fetch(`${API_URL}/api/v1/proposals/${proposalId}`, { headers })).json()) as { version: number };
  const response = await fetch(`${API_URL}/api/v1/proposals/${proposalId}/accept`, { method: 'POST', headers, body: JSON.stringify({ version: shown.version }) });
  if (response.status !== 200) throw new Error(`Could not accept: ${response.status} ${await response.text()}`);
  return ((await response.json()) as { agreementId: string }).agreementId;
}
