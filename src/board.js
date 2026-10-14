// The social layer: leaderboards, the Daily Drive board, who's online and live shout-outs.
// It only lights up when the game runs as a published claude.ai artifact (window.claude).
// Anywhere else every read returns null and every write is a no-op, and the game hides it all.
//
// Storage: one document per player at drives/<their id>. Everyone can read every document;
// each player can only write their own (see the db rules declared at publish).
//   l<n>, g<n>, x<n>   best yards on level n, the golfer who hit it, where it stopped (x)
//   stars              total tour stars
//   longest, longestLv longest drive anywhere
//   lastYds, lastLv, lastAt   most recent personal best (feeds "recent bombs")
//   dDate, dBest, dX, dGolfer today's Daily Drive
//   nick               the name the player typed for the boards (falls back to their claude.ai name)

let db = null;
let user = null;
let room = null;
let me = null;
let mine = {};
let exists = false;
let ready = Promise.resolve(false);
let chain = Promise.resolve();
const listeners = new Set();

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
      // Rows written by older versions may lack (or understate) the longest drive: repair from the level bests.
      const top = bestLevel();
      if (top.yards > (mine.longest || 0)) patch({ longest: top.yards, longestLv: top.lv });
      initRoom();
      return true;
    } catch {
      return false;
    }
  })();
  return ready;
}

export function boardReady() { return ready; }

// ---------- live room ----------

async function initRoom() {
  try {
    room = await window.claude.use('room');
    if (!room) return;
    room.onPeers(() => emitLocal({ type: 'peers' }), () => { room = null; });
    for (const topic of ['drive', 'kudos']) room.on(topic, (msg) => onMessage(msg), () => {});
  } catch {
    room = null;
  }
}

function onMessage(msg) {
  if (msg.isMe || !msg.by) return; // your own drives, from any tab, are already on your screen
  const d = msg.data && typeof msg.data === 'object' ? msg.data : {};
  if (msg.topic === 'drive') {
    const yds = Number(d.yds);
    const lv = Number(d.lv);
    if (!Number.isFinite(yds) || yds <= 0 || yds > 5000 || !(lv >= 0 && lv <= 9)) return;
    emitLocal({ type: 'drive', by: msg.by, nick: cleanNick(d.nick), yds, lv, daily: !!d.daily, record: !!d.record, tookMine: d.prev === me });
  } else if (msg.topic === 'kudos' && d.to === me) {
    emitLocal({ type: 'kudos', by: msg.by, nick: cleanNick(d.nick) });
  }
}

function emitLocal(ev) { for (const fn of listeners) fn(ev); }

// Hear live social events: {type: 'drive' | 'kudos' | 'peers', ...}
export function onSocial(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function setPresence(patch) { room?.presence(patch).catch(() => {}); }

export function sendKudos(to) { room?.emit('kudos', { to, nick: mine.nick || '' }).catch(() => {}); }

// Other people on the course right now, one entry per person.
export async function onlineNow() {
  if (!room || !user) return [];
  const seen = new Map();
  for (const p of room.peers()) {
    if (p.kind !== 'viewer' || p.isMe || !p.by || seen.has(p.by)) continue;
    seen.set(p.by, { id: p.by, lv: Number(p.presence?.lv) || 0, daily: !!p.presence?.daily, nick: cleanNick(p.presence?.nick) });
  }
  const rows = [...seen.values()];
  const people = rows.length ? await user.profiles(rows.map((r) => r.id)) : {};
  return rows.map((r) => ({ ...r, name: r.nick || people[r.id]?.name || 'Golfer', avatar: people[r.id]?.avatarUrl || '' }));
}

export function onlineCount() {
  if (!room) return 0;
  return new Set(room.peers().filter((p) => p.kind === 'viewer' && !p.isMe && p.by).map((p) => p.by)).size;
}

export async function names(ids) {
  if (!user || !ids.length) return {};
  return user.profiles(ids);
}

// ---------- writes (one at a time, only when something improved) ----------

function patch(fields) {
  Object.assign(mine, fields);
  chain = chain.then(async () => {
    try {
      const ref = db.doc(`drives/${me}`);
      if (exists) await ref.update(fields);
      else { await ref.set({ ...mine }); exists = true; }
    } catch {
      // View-only visitors can read the boards but not post to them.
    }
  });
  return chain;
}

function bestLevel() {
  let best = { yards: 0, lv: 0 };
  for (const [k, v] of Object.entries(mine)) {
    const m = /^l(\d+)$/.exec(k);
    if (m && typeof v === 'number' && v > best.yards) best = { yards: v, lv: Number(m[1]) };
  }
  return best;
}

// Record a drive on a tour level. Only a `feed`-worthy drive (a real bomb, not a first-ball
// shank) goes to the recent-bombs feed and the live ticker. Resolves {best, record} or null.
export async function recordLevelDrive(lv, yards, x, golfer, { feed = true } = {}) {
  if (!(await ready) || !(yards > 0)) return null;
  const key = `l${lv}`;
  if ((mine[key] || 0) >= yards) return { best: false, record: false };
  const top = await levelTop(lv, 1);
  const holder = top?.[0];
  const record = !holder || yards > holder.yards;
  const longest = Math.max(mine.longest || 0, bestLevel().yards);
  const fields = { [key]: yards, [`g${lv}`]: golfer, [`x${lv}`]: round1(x) };
  if (feed || record) Object.assign(fields, { lastYds: yards, lastLv: lv, lastAt: Date.now() });
  if (yards > longest) Object.assign(fields, { longest: yards, longestLv: lv });
  patch(fields);
  if (feed || record) room?.emit('drive', { lv, yds: yards, record, prev: record && holder && !holder.isMe ? holder.id : null, nick: mine.nick || '' }).catch(() => {});
  return { best: true, record };
}

// The name shown on the boards. Typed by the player, so it's cleaned here and escaped wherever it's drawn.
export async function setNick(name) {
  const nick = cleanNick(name);
  if (!(await ready) || !nick || mine.nick === nick) return;
  patch({ nick });
}

export function myBoardNick() { return mine.nick || ''; }

// Older versions fed first-ball mishits into "recent bombs". Drop yours from the feed if it was one.
export async function tidyFeed(minYardsForLevel) {
  if (!(await ready) || !mine.lastAt || !(mine.lastLv > 0)) return;
  if (mine.lastYds < minYardsForLevel(mine.lastLv)) patch({ lastAt: 0 });
}

// A starting suggestion for the name box: the first word of the viewer's claude.ai name, if any.
export async function suggestedNick() {
  if (!(await ready)) return '';
  try { return cleanNick(((await user.me()).name || '').split(' ')[0]); } catch { return ''; }
}

export async function recordStars(total) {
  if (!(await ready) || (mine.stars || 0) === total) return;
  patch({ stars: total });
}

export async function recordDaily(date, yards, x, golfer, { feed = true } = {}) {
  if (!(await ready) || !(yards > 0)) return null;
  if (mine.dDate === date && (mine.dBest || 0) >= yards) return { best: false };
  const fields = { dDate: date, dBest: yards, dX: round1(x), dGolfer: golfer };
  if (feed) Object.assign(fields, { lastYds: yards, lastLv: 0, lastAt: Date.now() });
  patch(fields);
  if (feed) room?.emit('drive', { lv: 0, yds: yards, daily: true, nick: mine.nick || '' }).catch(() => {});
  return { best: true };
}

// ---------- reads ----------

async function withNames(rows) {
  const people = rows.length ? await user.profiles(rows.map((r) => r.id)) : {};
  const online = new Set(room ? room.peers().filter((p) => p.kind === 'viewer' && p.by).map((p) => p.by) : []);
  return rows.map((r) => ({
    ...r,
    name: r.nick || people[r.id]?.name || 'Golfer',
    avatar: people[r.id]?.avatarUrl || '',
    isMe: r.id === me,
    online: online.has(r.id) && r.id !== me,
  }));
}

export async function levelTop(lv, n = 10) {
  if (!(await ready)) return null;
  await chain;
  try {
    const key = `l${lv}`;
    const snap = await db.collection('drives').orderBy(key, 'desc').limit(n).get();
    const rows = snap.docs
      .map((d) => { const v = d.data(); return { id: d.id, nick: cleanNick(v.nick), yards: v[key], golfer: v[`g${lv}`], x: v[`x${lv}`] ?? 0 }; })
      .filter((r) => typeof r.yards === 'number');
    return withNames(rows);
  } catch {
    return null;
  }
}

export async function dailyTop(date) {
  if (!(await ready)) return null;
  await chain;
  try {
    const snap = await db.collection('drives').where('dDate', '==', date).limit(500).get();
    const rows = snap.docs
      .map((d) => { const v = d.data(); return { id: d.id, nick: cleanNick(v.nick), yards: v.dBest, golfer: v.dGolfer, x: v.dX ?? 0 }; })
      .filter((r) => typeof r.yards === 'number')
      .sort((a, b) => b.yards - a.yards);
    return withNames(rows);
  } catch {
    return null;
  }
}

export async function tourTop(n = 20) {
  if (!(await ready)) return null;
  await chain;
  try {
    const snap = await db.collection('drives').orderBy('stars', 'desc').limit(100).get();
    const rows = snap.docs
      .map((d) => { const v = d.data(); return { id: d.id, nick: cleanNick(v.nick), stars: v.stars || 0, longest: v.longest || 0, longestLv: v.longestLv }; })
      .filter((r) => r.stars > 0 || r.longest > 0)
      .sort((a, b) => b.stars - a.stars || b.longest - a.longest)
      .slice(0, n);
    return withNames(rows);
  } catch {
    return null;
  }
}

export async function recentBombs(n = 6) {
  if (!(await ready)) return null;
  await chain;
  try {
    const snap = await db.collection('drives').orderBy('lastAt', 'desc').limit(n).get();
    const rows = snap.docs
      .map((d) => { const v = d.data(); return { id: d.id, nick: cleanNick(v.nick), yards: v.lastYds, lv: v.lastLv, at: v.lastAt }; })
      .filter((r) => typeof r.yards === 'number' && r.at > 0);
    return withNames(rows);
  } catch {
    return null;
  }
}

// Kept for the level banner: the single best drive on a level.
export function topDrives(lv, n) { return levelTop(lv, n); }

function round1(v) { return Math.round((Number(v) || 0) * 10) / 10; }

// Letters (any alphabet), digits, spaces and a little punctuation; 14 characters max.
export function cleanNick(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/[^\p{L}\p{N} ._'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14);
}
