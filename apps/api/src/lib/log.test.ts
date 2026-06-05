// Logs never contain personal data (constitution III).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from './log.ts';

afterEach(() => vi.restoreAllMocks());

describe('logs', () => {
  it('drop personal fields and blank out email addresses inside messages', () => {
    const lines: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((line: string) => void lines.push(line));
    log.error('email_failed', { email: 'sam@example.org', reason: '550 5.1.1 <sam.home@example.org>: Recipient address rejected', status: 550 });
    const entry = JSON.parse(lines[0]!);
    expect(entry).toMatchObject({ event: 'email_failed', status: 550, reason: '550 5.1.1 <[email]>: Recipient address rejected' });
    expect(entry.email).toBeUndefined();
    expect(lines[0]).not.toContain('example.org');
  });
});
