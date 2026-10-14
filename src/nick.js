// Player-typed leaderboard names: letters (any alphabet), digits, spaces and a little
// punctuation, 14 characters max. Cleaned on the way in and on the way out.
export function cleanNick(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/[^\p{L}\p{N} ._'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14);
}
