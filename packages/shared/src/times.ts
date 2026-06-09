// Clock times in words, shared so the web app and the API's messages say them the same way:
// always with am/pm ("6 pm", "9:30 am"), never as 24-hour times.

/** "18:00" or "18:00:00" → "6 pm"; "09:30" → "9:30 am". */
export function clock(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}

const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** "Monday–Friday, 6 pm–9 pm; Saturday, 10 am–12 pm": consecutive days with the same hours grouped. */
export function timesText(times: { weekday: number; startTime: string; endTime: string }[]): string {
  const byHours = new Map<string, number[]>();
  for (const t of times) {
    const hours = `${clock(t.startTime)}–${clock(t.endTime)}`;
    byHours.set(hours, [...(byHours.get(hours) ?? []), t.weekday]);
  }
  const parts: string[] = [];
  for (const [hours, days] of byHours) {
    const sorted = [...new Set(days)].sort((a, b) => a - b);
    const runs: string[] = [];
    let start = sorted[0]!;
    for (let i = 1; i <= sorted.length; i += 1) {
      if (sorted[i] !== sorted[i - 1]! + 1) {
        const end = sorted[i - 1]!;
        runs.push(start === end ? dayNames[start]! : `${dayNames[start]}–${dayNames[end]}`);
        start = sorted[i]!;
      }
    }
    parts.push(`${runs.join(', ')}, ${hours}`);
  }
  return parts.join('; ');
}
