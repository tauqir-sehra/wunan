// Sends any due return reminders now, instead of waiting for the hourly job.
//   npm run reminders:once -w apps/api
const { runReminders } = await import('../src/modules/reminders.ts');
const { sql } = await import('../src/db/index.ts');
const { sent } = await runReminders();
console.log(sent === 1 ? 'Sent 1 reminder.' : `Sent ${sent} reminders.`);
await sql.end();
