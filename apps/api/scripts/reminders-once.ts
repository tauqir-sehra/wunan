// Sends any due return reminders and closes quiet proposals now, instead of waiting for the hourly job.
//   npm run reminders:once -w apps/api
const { runReminders } = await import('../src/modules/reminders.ts');
const { closeQuietProposals } = await import('../src/modules/proposals.ts');
const { sql } = await import('../src/db/index.ts');
const { sent } = await runReminders();
console.log(sent === 1 ? 'Sent 1 reminder.' : `Sent ${sent} reminders.`);
const { closed } = await closeQuietProposals();
console.log(closed === 1 ? 'Closed 1 quiet proposal.' : `Closed ${closed} quiet proposals.`);
await sql.end();
