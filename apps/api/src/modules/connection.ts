// How a viewer and a member are connected through invitations (005). Each invite line runs from a
// founding member down to the member, so the person both lines trace back to (the common ancestor) is
// simply the last id the two lines share from the start. Pure, so every case is unit-tested.

export type ConnectionKind = 'self' | 'shared' | 'theyAreAbove' | 'youAreAbove' | 'separate';

export type ConnectionIds = {
  kind: ConnectionKind;
  /** The person at the top of the drawing; null when the lines share no one. */
  topId: string | null;
  /** From just below the top down to the viewer. */
  toYouIds: string[];
  /** From just below the top down to the profile's member. */
  toThemIds: string[];
};

export function connectionOf(viewerLine: string[], memberLine: string[]): ConnectionIds {
  let shared = 0;
  while (
    shared < viewerLine.length &&
    shared < memberLine.length &&
    viewerLine[shared] === memberLine[shared]
  )
    shared += 1;

  if (shared === 0)
    return { kind: 'separate', topId: null, toYouIds: viewerLine, toThemIds: memberLine };

  // On your own profile there's no second person: show your line from your founding member.
  if (shared === viewerLine.length && shared === memberLine.length) {
    return { kind: 'self', topId: viewerLine[0]!, toYouIds: viewerLine.slice(1), toThemIds: [] };
  }
  const kind: ConnectionKind =
    shared === memberLine.length
      ? 'theyAreAbove'
      : shared === viewerLine.length
        ? 'youAreAbove'
        : 'shared';
  return {
    kind,
    topId: viewerLine[shared - 1]!,
    toYouIds: viewerLine.slice(shared),
    toThemIds: memberLine.slice(shared)
  };
}
