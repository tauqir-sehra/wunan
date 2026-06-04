// Plain-language text for listings, used everywhere a listing is shown (constitution II).
import type { Listing, ListingType, Unit } from '@wunan/shared';

export const typeLabels: Record<ListingType, string> = { lend: 'Lend', gift: 'Gift', trade: 'Trade', service: 'Service' };
export const typeHints: Record<ListingType, string> = {
  lend: 'Something you lend out and get back, like a drill or a tent.',
  gift: 'Something you give away, like leftover food or clothes.',
  trade: 'Something you swap for something else, or for money you agree on.',
  service: 'Time and skills you offer, like a haircut or help moving.'
};

const unitNames: Record<Unit, [string, string]> = {
  item: ['item', 'items'],
  kg: ['kg', 'kg'],
  g: ['g', 'g'],
  litre: ['litre', 'litres'],
  hour: ['hour', 'hours'],
  portion: ['portion', 'portions'],
  bag: ['bag', 'bags'],
  box: ['box', 'boxes'],
  other: ['', '']
};
export const unitOptions = Object.keys(unitNames) as Unit[];
export const unitLabel = (unit: Unit) => (unit === 'other' ? 'other (say in the description)' : unitNames[unit][1]);

/** "5 kg", "1 item", "3 bags", "2.5 litres". */
export function quantity(amount: string | number, unit: Unit | null): string {
  const value = String(amount);
  if (!unit || unit === 'other') return value;
  const [one, many] = unitNames[unit];
  return `${value} ${Number(value) === 1 ? one : many}`;
}

const durations: Record<string, [string, string]> = {
  minutes: ['minute', 'minutes'],
  hours: ['hour', 'hours'],
  days: ['day', 'days'],
  weeks: ['week', 'weeks']
};
export const duration = (length: number, unit: string) => `${length} ${durations[unit]?.[length === 1 ? 0 : 1] ?? unit}`;

/** The main line under a listing's title: how much, how long, how many sessions. */
export function amountLine(listing: Listing): string | null {
  switch (listing.type) {
    case 'gift':
    case 'trade':
      if (!listing.amount) return null;
      return listing.remaining !== null && listing.remaining !== listing.amount
        ? `${quantity(listing.remaining, listing.unit)} left`
        : `${quantity(listing.amount, listing.unit)} available`;
    case 'lend':
      return listing.loanLength && listing.loanLengthUnit
        ? `Lend for up to ${duration(listing.loanLength, listing.loanLengthUnit)}`
        : 'Loan length to be agreed';
    case 'service': {
      const parts = [];
      if (listing.sessionLength && listing.sessionLengthUnit) parts.push(duration(listing.sessionLength, listing.sessionLengthUnit));
      if (listing.sessionsRemaining !== null) {
        parts.push(`${listing.sessionsRemaining} ${listing.sessionsRemaining === 1 ? 'session' : 'sessions'} available`);
      }
      return parts.length ? parts.join(' · ') : null;
    }
  }
}

/** For trades: what the owner would like in return. */
export function wantedLine(listing: Listing): string | null {
  if (listing.type !== 'trade') return null;
  const parts = [];
  if (listing.wanted) {
    parts.push(
      listing.wantedAmount
        ? `Would like: ${quantity(listing.wantedAmount, listing.wantedUnit)} of ${listing.wanted}`
        : `Would like: ${listing.wanted}`
    );
  }
  if (listing.openToOffers) parts.push('Open to offers');
  return parts.join(' · ') || null;
}

export const statusText: Record<Listing['status'], string> = {
  available: 'Available',
  lent_out: 'Lent out',
  paused: 'Paused',
  closed: 'Closed'
};
