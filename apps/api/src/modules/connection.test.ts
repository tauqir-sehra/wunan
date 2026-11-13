// How two invite lines connect (005): every kind, worked out without a database.
import { describe, expect, it } from 'vitest';
import { connectionOf } from './connection.ts';

describe('connectionOf', () => {
  it('finds the common ancestor of two branches of different lengths', () => {
    expect(connectionOf(['fay', 'ben', 'you'], ['fay', 'chloe', 'faraz', 'rosa'])).toEqual({
      kind: 'shared',
      topId: 'fay',
      toYouIds: ['ben', 'you'],
      toThemIds: ['chloe', 'faraz', 'rosa']
    });
  });

  it('takes the nearest shared person, not the founder', () => {
    expect(connectionOf(['fay', 'ben', 'ann', 'you'], ['fay', 'ben', 'rosa'])).toMatchObject({
      kind: 'shared',
      topId: 'ben',
      toYouIds: ['ann', 'you'],
      toThemIds: ['rosa']
    });
  });

  it('handles a common ancestor who invited both directly', () => {
    expect(connectionOf(['fay', 'you'], ['fay', 'rosa'])).toMatchObject({
      kind: 'shared',
      toYouIds: ['you'],
      toThemIds: ['rosa']
    });
  });

  it('draws one line when the member is above you', () => {
    expect(connectionOf(['fay', 'ben', 'you'], ['fay', 'ben'])).toEqual({
      kind: 'theyAreAbove',
      topId: 'ben',
      toYouIds: ['you'],
      toThemIds: []
    });
    expect(connectionOf(['fay', 'ben', 'you'], ['fay'])).toEqual({
      kind: 'theyAreAbove',
      topId: 'fay',
      toYouIds: ['ben', 'you'],
      toThemIds: []
    });
  });

  it('draws one line when you are above the member', () => {
    expect(connectionOf(['fay', 'you'], ['fay', 'you', 'sam', 'lee'])).toEqual({
      kind: 'youAreAbove',
      topId: 'you',
      toYouIds: [],
      toThemIds: ['sam', 'lee']
    });
  });

  it('shows your own line from your founding member', () => {
    expect(connectionOf(['fay', 'ben', 'you'], ['fay', 'ben', 'you'])).toEqual({
      kind: 'self',
      topId: 'fay',
      toYouIds: ['ben', 'you'],
      toThemIds: []
    });
    expect(connectionOf(['fay'], ['fay'])).toEqual({
      kind: 'self',
      topId: 'fay',
      toYouIds: [],
      toThemIds: []
    });
  });

  it('keeps both full lines when they go back to different founders', () => {
    expect(connectionOf(['fay', 'you'], ['omar', 'pia'])).toEqual({
      kind: 'separate',
      topId: null,
      toYouIds: ['fay', 'you'],
      toThemIds: ['omar', 'pia']
    });
  });
});
