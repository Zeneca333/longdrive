import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Board from '../src/board-public.js';

// A stand-in for Pantry: GET a basket, PUT deep-merges into it, POST creates or replaces it.
function fakePantry() {
  const store = {};
  const merge = (into, patch) => {
    for (const [k, v] of Object.entries(patch)) {
      if (v && typeof v === 'object' && into[k] && typeof into[k] === 'object') merge(into[k], v);
      else into[k] = v;
    }
  };
  const res = (status, body) => ({ status, ok: status < 300, json: async () => JSON.parse(JSON.stringify(body)) });
  const fetch = async (url, opts = {}) => {
    const name = url.split('/basket/')[1];
    const method = opts.method || 'GET';
    if (method === 'GET') return name in store ? res(200, store[name]) : res(400, { error: 'no basket' });
    const body = JSON.parse(opts.body);
    if (method === 'PUT') { if (!(name in store)) return res(400, {}); merge(store[name], body); return res(200, {}); }
    store[name] = body;
    return res(200, {});
  };
  return { store, fetch };
}

const as = async (p, playerId) => { await Board.initBoard({ id: 'pantry-1', fetch: p.fetch, playerId }); };

test('with no store configured the board stays off', async () => {
  assert.equal(await Board.initBoard({ id: '' }), false);
  assert.equal(await Board.levelTop(1), null);
});

test('players post bests, see the record holder and only beat their own best', async () => {
  const p = fakePantry();
  await as(p, 'p_ann');
  await Board.setNick('Ann');
  assert.deepEqual(await Board.recordLevelDrive(2, 270.4, 3, 'chip'), { best: true, record: true });
  assert.deepEqual(await Board.recordLevelDrive(2, 250, 0, 'chip'), { best: false, record: false });
  await as(p, 'p_bob');
  await Board.setNick('Bob');
  assert.deepEqual(await Board.recordLevelDrive(2, 260.0, -2, 'tony'), { best: true, record: false });
  assert.deepEqual(await Board.recordLevelDrive(2, 290.5, -2, 'tony'), { best: true, record: true });
  const top = await Board.levelTop(2);
  assert.deepEqual(top.map((r) => [r.name, r.yards, r.isMe]), [['Bob', 290.5, true], ['Ann', 270.4, false]]);
  assert.equal(p.store.levels.l2.p_ann.y, 270.4, 'Bob writing never touched Ann');
});

test('renaming updates every score you own', async () => {
  const p = fakePantry();
  await as(p, 'p_cat');
  await Board.setNick('Cat');
  await Board.recordLevelDrive(1, 240, 0, 'granny');
  await Board.recordDaily('2026-10-14', 300, 1, 'granny');
  await Board.setNick('Catherine');
  await Board.boardReady();
  assert.equal(p.store.levels.l1.p_cat.n, 'Catherine');
  assert.equal(p.store.daily['2026-10-14'].p_cat.n, 'Catherine');
  assert.equal(p.store.tour.p_cat.n, 'Catherine');
});

test('tour standings rank by stars, then longest drive', async () => {
  const p = fakePantry();
  await as(p, 'p_a'); await Board.setNick('A'); await Board.recordStars(5); await Board.recordLevelDrive(3, 300, 0, 'chip');
  await as(p, 'p_b'); await Board.setNick('B'); await Board.recordStars(5); await Board.recordLevelDrive(3, 320, 0, 'chip');
  await as(p, 'p_c'); await Board.setNick('C'); await Board.recordStars(7);
  const t = await Board.tourTop();
  assert.deepEqual(t.map((r) => r.name), ['C', 'B', 'A']);
  assert.equal(t[1].longest, 320);
});

test('junk in the store is cleaned or dropped, and mishits stay out of recent bombs', async () => {
  const p = fakePantry();
  p.store.levels = { l1: {
    p_x: { n: '<script>alert(1)</script>', y: 250, g: 'hacker', x: 99999, t: 5 },
    p_y: { n: 'Spam', y: 'lots', t: 6 },
    p_z: { n: 'Huge', y: 1e9, t: 7 },
    p_w: { n: 'Shank', y: 12, t: 8 },
  } };
  p.store.tour = {};
  await as(p, 'p_me');
  const top = await Board.levelTop(1);
  assert.deepEqual(top.map((r) => [r.name, r.golfer, r.x]), [['scriptalert1sc', 'chip', 200], ['Shank', 'chip', 0]]);
  const recent = await Board.recentBombs();
  assert.deepEqual(recent.map((r) => r.name), ['scriptalert1sc']);
});
