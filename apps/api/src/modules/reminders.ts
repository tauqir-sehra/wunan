// One gentle reminder for loans past their end (001 FR-025; research §11). Each loan is
// claimed with a single conditional UPDATE, so however often (or however many copies of) the job
// runs, each member gets exactly one reminder per loan.
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { agreement, listing } from '../db/schema/index.ts';
import { describeWhen } from '../lib/time.ts';
import { notify } from '../notify/index.ts';
import { overdueLoansCondition } from './agreements.ts';

export async function runReminders() {
  const due = await db.select({ id: agreement.id }).from(agreement).where(overdueLoansCondition());
  let sent = 0;
  for (const { id } of due) {
    // Claim it: only one run can set reminder_sent_at, and only that run sends.
    const [claimed] = await db
      .update(agreement)
      .set({ reminderSentAt: new Date() })
      .where(and(eq(agreement.id, id), isNull(agreement.reminderSentAt)))
      .returning();
    if (!claimed) continue;
    const [item] = await db.select({ title: listing.title }).from(listing).where(eq(listing.id, claimed.listingId));
    const notice = {
      title: `A reminder about the ${item?.title ?? 'loan'}`,
      body: `It was due back on ${describeWhen(claimed.loanEndsAt!, false)}. When it's back, the owner can mark it returned in wunan. If something went wrong, either of you can ask for help from the agreement page.`,
      url: `/agreements/${claimed.id}`
    };
    await notify(claimed.ownerId, 'reminder', notice);
    await notify(claimed.otherMemberId, 'reminder', notice);
    sent += 1;
  }
  return { sent };
}
