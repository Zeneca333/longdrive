// The Daily Drive: one course a day, the same for everyone. Pure logic so it can be tested.
// Today's course, its wind for each ball and its coin layout all come from the UTC date,
// so two players on opposite sides of the world get the identical challenge.
import { LEVELS } from './config.js';
import { rollWind } from './course.js';
import { makeRng } from './rng.js';

export function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function dateSeed(key) {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// Any course but the practice range. Starter gear, so the board measures swings, not wallets.
export function dailyLevel(key = todayKey()) {
  const seed = dateSeed(key);
  const base = LEVELS[1 + (seed % (LEVELS.length - 1))];
  return { ...base, daily: true, date: key, seed, name: `Daily Drive: ${base.name}` };
}

export function dailyWind(level, ballIndex) {
  return rollWind(level, makeRng(level.seed + 101 * (ballIndex + 1)));
}

export function prettyDate(key) {
  const d = new Date(`${key}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
