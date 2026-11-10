// Place display, privacy, and area matching (002 research §2).
import type { Place } from '@wunan/shared';
import { describe, expect, it } from 'vitest';
import { displayOf, sameArea, viewPlace } from './places.ts';

const house: Place = { label: '1 Mill Street, Riverside, Springfield', source: 'suggestion', houseNumber: '1', street: 'Mill Street', neighbourhood: 'Riverside', city: 'Springfield' };
const riverside: Place = { label: 'Riverside, Springfield', source: 'suggestion', neighbourhood: 'Riverside', city: 'Springfield' };
const oldTown: Place = { label: 'Old Town, Springfield', source: 'suggestion', neighbourhood: 'Old Town', city: 'Springfield' };
const springfield: Place = { label: 'Springfield', source: 'suggestion', city: 'Springfield' };
const typed: Place = { label: 'near the park', source: 'typed' };

describe('places', () => {
  it('shows only neighbourhood and city to others', () => {
    expect(viewPlace(house, { full: false })).toEqual({ display: 'Riverside, Springfield' });
    expect(viewPlace(house, { full: true })).toMatchObject({ street: 'Mill Street', display: 'Riverside, Springfield' });
    expect(viewPlace(null, { full: false })).toBeNull();
  });

  it('shows typed places as typed', () => {
    expect(displayOf(typed)).toBe('near the park');
    expect(displayOf(springfield)).toBe('Springfield');
  });

  it('never shows a bare street address', () => {
    expect(displayOf({ label: '1 Mill Street', source: 'suggestion', street: 'Mill Street', houseNumber: '1' })).toBe('Area not given');
  });

  it('matches areas by neighbourhood, or city for a whole-city area', () => {
    expect(sameArea(riverside, house)).toBe(true);
    expect(sameArea(riverside, oldTown)).toBe(false);
    expect(sameArea(springfield, oldTown)).toBe(true);
    expect(sameArea({ ...riverside, neighbourhood: 'RIVERSIDÉ' }, house)).toBe(true);
    expect(sameArea(riverside, typed)).toBeNull();
    // The same name in another region or country is another place.
    expect(sameArea({ ...springfield, region: 'Illinois', country: 'United States' }, { ...oldTown, region: 'England', country: 'United Kingdom' })).toBe(false);
    expect(sameArea({ ...springfield, region: 'Oregon', country: 'United States' }, { ...oldTown, region: 'Illinois', country: 'United States' })).toBe(false);
    expect(sameArea({ ...springfield, country: 'United Kingdom' }, oldTown)).toBe(true);
  });
});
