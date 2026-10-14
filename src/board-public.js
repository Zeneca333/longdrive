// The public high-score table for the standalone version (anyone with the link, no sign-in).
// Scores live in a free Pantry store (getpantry.cloud): three JSON "baskets", each keyed by a
// random per-browser player id. Pantry's PUT deep-merges, so each player only ever writes their
// own entries and two players posting at once can't overwrite each other.
//
//   levels: { l3: { <pid>: { n, y, g, x, t } } }      best drive per level
//   daily:  { 2026-10-14: { <pid>: { n, y, g, x, t } } }  Daily Drive bests (old days pruned)
//   tour:   { <pid>: { n, s, l, t } }                  stars and longest drive
//
// It works like an arcade machine: there are no accounts, so anyone determined could post a fake
// score. Everything read back is cleaned and range-checked before it's drawn.
import { cleanNick } from './nick.js';
import { LEVELS, GOLFERS, PUBLIC_SCORES } from './config.js';
import { dailyLevel } from './daily.js';

export const live = false; // no presence or live shout-outs without the claude.ai room

const BASE = 'https://getpantry.cloud/apiv1/pantry';
const CACHE_MS = 8000;
const GOLFER_IDS = new Set(GOLFERS.map((g) => g.id));

let pantry = '';
let fetchFn = (...a) => fetch(...a);
let pid = '';
let nick = '';
let ready = Promise.resolve(false);
const cache = new Map(); // basket -> { at, data }
let chain = Promise.resolve();

// Tests pass a fake fetch and a pantry id; the game passes nothing and uses config.
export function initBoard({ id = PUBLIC_SCORES.pantry, fetch: f, playerId } = {}) {
  pantry = id || '';
  if (f) fetchFn = f;
  cache.clear();
  if (!pantry) return (ready = Promise.resolve(false));
  pid = playerId || loadPlayerId();
  ready = (async () => {
    try {
      const tour = await read('tour', true);
      nick = cleanNick(tour?.[pid]?.n);
      return tour !== null;
    } catch {
      return false;
    }
  })();
  return ready;
}

export function boardReady() { return ready; }

function loadPlayerId() {
  const KEY = 'long-drive-insanity-player';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) { id = `p_${Math.random().toString(36).slice(2, 12)}`; localStorage.setItem(KEY, id); }
    return id;
  } catch {
    return `p_${Math.random().toString(36).slice(2, 12)}`;
  }
}

// ---------- transport ----------

async function read(basket, fresh = false) {
  if (fresh) await chain; // a fresh read always sees this player's own pending writes
  const hit = cache.get(basket);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const r = await fetchFn(`${BASE}/${pantry}/basket/${basket}`);
  if (r.status === 400) { cache.set(basket, { at: Date.now(), data: {} }); return {}; } // not created yet
  if (!r.ok) return null;
  const data = await r.json();
  const clean = data && typeof data === 'object' ? data : {};
  cache.set(basket, { at: Date.now(), data: clean });
  return clean;
}

// Merge `patch` into a basket, creating the basket on first use. Writes go one at a time.
function merge(basket, patch) {
  const local = cache.get(basket)?.data;
  if (local) deepMerge(local, patch);
  chain = chain.then(async () => {
    try {
      const url = `${BASE}/${pantry}/basket/${basket}`;
      const opts = (method) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const r = await fetchFn(url, opts('PUT'));
      if (r.status === 400) await fetchFn(url, opts('POST'));
    } catch {
      // Offline or the store is down: the round still counts locally.
    }
  });
  return chain;
}

function deepMerge(into, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && into[k] && typeof into[k] === 'object') deepMerge(into[k], v);
    else into[k] = v;
  }
}

// ---------- cleaning untrusted rows ----------

function entry(id, v) {
  if (!v || typeof v !== 'object' || typeof id !== 'string' || id.length > 40) return null;
  const y = Number(v.y);
  if (!(y > 0 && y < 3000)) return null;
  return {
    id,
    nick: cleanNick(v.n),
    yards: Math.round(y * 10) / 10,
    golfer: GOLFER_IDS.has(v.g) ? v.g : 'chip',
    x: Math.max(-200, Math.min(200, Number(v.x) || 0)),
    at: Number(v.t) || 0,
  };
}

function rows(map) {
  return Object.entries(map || {}).map(([id, v]) => entry(id, v)).filter(Boolean).sort((a, b) => b.yards - a.yards);
}

function named(list) {
  return list.map((r) => ({ ...r, name: r.nick || 'Golfer', avatar: '', isMe: r.id === pid, online: false }));
}

// ---------- reads ----------

export async function levelTop(lv, n = 10) {
  if (!(await ready)) return null;
  await chain;
  const levels = await read('levels');
  return levels ? named(rows(levels[`l${lv}`]).slice(0, n)) : null;
}

export async function dailyTop(date) {
  if (!(await ready)) return null;
  await chain;
  const daily = await read('daily');
  return daily ? named(rows(daily[date])) : null;
}

export async function tourTop(n = 20) {
  if (!(await ready)) return null;
  await chain;
  const tour = await read('tour');
  if (!tour) return null;
  const list = Object.entries(tour).map(([id, v]) => {
    if (!v || typeof v !== 'object') return null;
    const s = Math.max(0, Math.min(27, Math.round(Number(v.s) || 0)));
    const l = Number(v.l) > 0 && Number(v.l) < 3000 ? Math.round(Number(v.l) * 10) / 10 : 0;
    return s || l ? { id, nick: cleanNick(v.n), stars: s, longest: l } : null;
  }).filter(Boolean).sort((a, b) => b.stars - a.stars || b.longest - a.longest);
  return named(list.slice(0, n));
}

// The most recent drives worth bragging about (75% of that course's target or better).
export async function recentBombs(n = 6) {
  if (!(await ready)) return null;
  await chain;
  const [levels, daily] = await Promise.all([read('levels'), read('daily')]);
  if (!levels) return null;
  const out = [];
  for (const [key, map] of Object.entries(levels)) {
    const lv = Number(key.slice(1));
    const min = (LEVELS[lv - 1]?.stars[0] || 9999) * 0.75;
    for (const r of rows(map)) if (r.yards >= min) out.push({ ...r, lv });
  }
  for (const [date, map] of Object.entries(daily || {})) {
    const min = dailyLevel(date).stars[0] * 0.75;
    for (const r of rows(map)) if (r.yards >= min) out.push({ ...r, lv: 0 });
  }
  return named(out.filter((r) => r.at > 0).sort((a, b) => b.at - a.at).slice(0, n));
}

// ---------- writes ----------

function mineIn(map) { return entry(pid, map?.[pid]); }

export async function recordLevelDrive(lv, yards, x, golfer) {
  if (!(await ready) || !(yards > 0)) return null;
  const levels = (await read('levels', true)) || {};
  const key = `l${lv}`;
  const mine = mineIn(levels[key]);
  if (mine && mine.yards >= yards) return { best: false, record: false };
  const top = rows(levels[key])[0];
  const record = !top || yards > top.yards;
  merge('levels', { [key]: { [pid]: { n: nick, y: yards, g: golfer, x: Math.round(x * 10) / 10, t: Date.now() } } });
  // Keep the tour row's longest drive current.
  const tour = (await read('tour')) || {};
  if (yards > (Number(tour[pid]?.l) || 0)) merge('tour', { [pid]: { n: nick, l: yards, t: Date.now() } });
  return { best: true, record };
}

export async function recordDaily(date, yards, x, golfer) {
  if (!(await ready) || !(yards > 0)) return null;
  const daily = (await read('daily', true)) || {};
  const mine = mineIn(daily[date]);
  if (mine && mine.yards >= yards) return { best: false };
  merge('daily', { [date]: { [pid]: { n: nick, y: yards, g: golfer, x: Math.round(x * 10) / 10, t: Date.now() } } });
  return { best: true };
}

export async function recordStars(total) {
  if (!(await ready)) return;
  const tour = (await read('tour')) || {};
  if ((Number(tour[pid]?.s) || 0) === total) return;
  merge('tour', { [pid]: { n: nick, s: total, t: Date.now() } });
}

// Renaming updates every entry this player owns, so old scores show the new name too.
export async function setNick(name) {
  const clean = cleanNick(name);
  if (!(await ready) || !clean || clean === nick) return;
  nick = clean;
  const [levels, daily] = await Promise.all([read('levels', true), read('daily', true)]);
  const lvPatch = {};
  for (const [key, map] of Object.entries(levels || {})) if (map?.[pid]) lvPatch[key] = { [pid]: { n: clean } };
  const dPatch = {};
  for (const [date, map] of Object.entries(daily || {})) if (map?.[pid]) dPatch[date] = { [pid]: { n: clean } };
  merge('tour', { [pid]: { n: clean } });
  if (Object.keys(lvPatch).length) merge('levels', lvPatch);
  if (Object.keys(dPatch).length) merge('daily', dPatch);
  await chain;
}

export function myBoardNick() { return nick; }
export async function suggestedNick() { return ''; }
export async function tidyFeed() {}

// ---------- live features: not available without the claude.ai room ----------

export function onSocial() { return () => {}; }
export function setPresence() {}
export function sendKudos() {}
export async function onlineNow() { return []; }
export function onlineCount() { return 0; }
export async function names() { return {}; }
