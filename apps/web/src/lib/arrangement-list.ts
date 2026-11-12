// Reading the Arrangements page's address: which side is chosen, and a later page of "Finished".
// Shared by the page and its "Show more" endpoint.

export function arrangementSide(url: URL): 'asked' | 'offered' | null {
  const side = url.searchParams.get('side');
  return side === 'asked' || side === 'offered' ? side : null;
}

/** The API query for this address. */
export function listQuery(url: URL) {
  const query = new URLSearchParams();
  const side = arrangementSide(url);
  if (side) query.set('side', side);
  const cursor = url.searchParams.get('cursor');
  if (url.searchParams.get('group') === 'finished' && cursor) {
    query.set('group', 'finished');
    query.set('cursor', cursor);
  }
  return query.size ? `?${query}` : '';
}
