// Progress lives in this browser only. Every access is guarded, since storage can be blocked.
const KEY = 'long-drive-insanity-v1';

export function freshSave() {
  return {
    coins: 0,
    golfer: 'chip',
    nick: '',
    level: 1,
    unlocked: 1,
    stars: {},
    best: {},
    bestX: {},
    daily: null,
    gear: { driver: 0, ball: 0, grip: 0 },
    items: { rocket: 0, scope: 0, butter: 0, calm: 0, bouncy: 0, moon: 0, mulligan: 0 },
    muted: false,
    beaten: false,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const s = JSON.parse(raw);
    const base = freshSave();
    return { ...base, ...s, gear: { ...base.gear, ...s.gear }, items: { ...base.items, ...s.items } };
  } catch {
    return freshSave();
  }
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: play on without saving */ }
}

export function wipeSave() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to wipe */ }
  return freshSave();
}
