// Times in the community's time zone (002 research §5). One community per installation, so one time
// zone: the server's `TZ` (set in compose.yaml). A date without a time means midnight there.

/** The community's time zone name, e.g. "Europe/London". */
export const communityTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "2026-06-08" and optional "10:00" (local) → the moment it happens. */
export function localToInstant(date: string, time?: string | null) {
  // Without "Z", JavaScript reads the text as local time, which is the community's time zone.
  return new Date(`${date}T${time ?? '00:00'}:00`);
}

const two = (n: number) => String(n).padStart(2, '0');

/** The moment → local "YYYY-MM-DD" and "HH:MM". */
export function instantToLocal(instant: Date) {
  return {
    date: `${instant.getFullYear()}-${two(instant.getMonth() + 1)}-${two(instant.getDate())}`,
    time: `${two(instant.getHours())}:${two(instant.getMinutes())}`
  };
}

/** ISO weekday (1 = Monday … 7 = Sunday) in the community's time zone. */
export const localWeekday = (instant: Date) => ((instant.getDay() + 6) % 7) + 1;

const unitMs = { minutes: 60_000, hours: 3_600_000 } as const;

/** Adds a length in minutes, hours, days, or weeks; days and weeks follow the local calendar. */
export function addLength(start: Date, length: number, unit: 'minutes' | 'hours' | 'days' | 'weeks') {
  if (unit === 'minutes' || unit === 'hours') return new Date(start.getTime() + length * unitMs[unit]);
  const end = new Date(start);
  end.setDate(end.getDate() + length * (unit === 'weeks' ? 7 : 1));
  return end;
}

/** A length in minutes, for comparing lengths given in different units (a day counts as 24 hours). */
export function lengthInMinutes(length: number, unit: 'minutes' | 'hours' | 'days' | 'weeks') {
  return length * { minutes: 1, hours: 60, days: 1440, weeks: 10080 }[unit];
}

/** "Saturday 6 June, 10:00" (or without the time), for messages and notifications. */
export function describeWhen(instant: Date, hasTime: boolean) {
  const day = instant.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return hasTime ? `${day}, ${instantToLocal(instant).time}` : day;
}
