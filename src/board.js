// Shared longest-drive leaderboard. It only lights up when the game runs as a published
// claude.ai artifact (window.claude); anywhere else every call quietly returns null.
// One document per player at drives/<their id>, with l<level> = best yards and g<level> = golfer.

let db = null;
let user = null;
let me = null;
let mine = {};
let exists = false;
let ready = Promise.resolve(false);
let chain = Promise.resolve();

export function initBoard() {
  if (!window.claude?.use) return ready;
  ready = (async () => {
    try {
      [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return false;
      me = await user.id();
      if (!me) return false;
      const snap = await db.doc(`drives/${me}`).get();
      exists = snap.exists;
      mine = snap.exists ? { ...snap.data() } : {};
      return true;
    } catch {
      return false;
    }
  })();
  return ready;
}

// Record a drive if it beats this player's best on the level. Writes run one at a time.
export async function submitDrive(levelId, yards, golfer) {
  if (!(await ready) || !(yards > 0)) return;
  const key = `l${levelId}`;
  if ((mine[key] || 0) >= yards) return;
  mine[key] = yards;
  mine[`g${levelId}`] = golfer;
  const body = { [key]: yards, [`g${levelId}`]: golfer };
  chain = chain.then(async () => {
    try {
      const ref = db.doc(`drives/${me}`);
      if (exists) await ref.update(body);
      else { await ref.set({ ...mine }); exists = true; }
    } catch {
      // View-only visitors can read the board but not post to it.
    }
  });
  return chain;
}

// Top drives on a level, best first, with names resolved for this viewer. null = no board here.
export async function topDrives(levelId, n = 5) {
  if (!(await ready)) return null;
  await chain;
  try {
    const key = `l${levelId}`;
    const snap = await db.collection('drives').orderBy(key, 'desc').limit(n).get();
    const rows = snap.docs
      .map((d) => ({ id: d.id, yards: d.data()[key], golfer: d.data()[`g${levelId}`] }))
      .filter((r) => typeof r.yards === 'number');
    const people = rows.length ? await user.profiles(rows.map((r) => r.id)) : {};
    return rows.map((r) => ({ ...r, name: people[r.id]?.name || 'Someone', isMe: r.id === me }));
  } catch {
    return null;
  }
}
