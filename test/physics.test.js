import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBall, simulate, makeEnv, scoreBall, stepBall, fireRocket } from '../src/physics.js';
import { makeLaunch, SHAPES, judge } from '../src/swing.js';
import { MPH } from '../src/config.js';

const pure = { power: 1, ...judge(0, 0.04) };
const drive = (over = {}, shape = SHAPES[1], ballOpts = {}) => {
  const b = createBall(makeLaunch({ result: pure, golfer: { power: 1 }, gear: { speed: 1 }, shape }), ballOpts);
  const env = makeEnv({ gridHalf: 40, rng: () => 0.5, ...over });
  simulate(b, env);
  return { b, env, ...scoreBall(b, env) };
};

test('a pure stock drive with starter gear goes 250-300 yards and finishes in the grid', () => {
  const { yards, b } = drive();
  assert.ok(yards > 250 && yards < 300, `yards ${yards}`);
  assert.ok(b.apex > 15 && b.apex < 40, `apex ${b.apex}`);
  assert.ok(Math.abs(b.p.x) < 1);
});

test('tailwind helps, headwind hurts, stinger beats a headwind', () => {
  const calm = drive().yards;
  const tail = drive({ wind: { x: 0, z: -15 * MPH } }).yards;
  const head = drive({ wind: { x: 0, z: 15 * MPH } }).yards;
  const stingerHead = drive({ wind: { x: 0, z: 20 * MPH } }, SHAPES[0]).yards;
  const skyHead = drive({ wind: { x: 0, z: 20 * MPH } }, SHAPES[2]).yards;
  assert.ok(tail > calm && calm > head);
  assert.ok(stingerHead > skyHead);
});

test('sidespin curves the ball: slices go right', () => {
  const b = createBall({ speed: 72, launchDeg: 12, headingDeg: 0, back: 0.9, side: 0.8 });
  const env = makeEnv({ gridHalf: 999 });
  simulate(b, env);
  assert.ok(b.p.x > 10, `x ${b.p.x}`);
});

test('a ball that stops outside the grid scores zero', () => {
  const b = createBall({ speed: 72, launchDeg: 12, headingDeg: 25, back: 0.9, side: 0 });
  const env = makeEnv({ gridHalf: 20 });
  simulate(b, env);
  assert.deepEqual(scoreBall(b, env), { yards: 0, reason: 'oob' });
});

test('water across the fairway swallows a ball that lands in it', () => {
  const regions = [{ shape: 'rect', type: 'water', x: 0, z: -230, hw: 100, hd: 30 }];
  const { b, yards, reason } = drive({ regions });
  assert.equal(b.mode, 'lost');
  assert.equal(yards, 0);
  assert.equal(reason, 'water');
});

test('a sphere collider knocks the ball back', () => {
  const colliders = [{ kind: 'goose', a: { x: 0, y: 8, z: -60 }, b: { x: 0, y: 8, z: -60 }, r: 6, e: 0.3, damp: 0.5 }];
  const { b, yards } = drive({ colliders });
  assert.ok(b.events.some((e) => e.type === 'hit' && e.kind === 'goose'));
  assert.ok(yards < 150, `yards ${yards}`);
});

test('boost rings and rockets add distance', () => {
  const calm = drive().yards;
  const triggers = [{ kind: 'ring', id: 'r', x: 0, y: 10, z: -60, r: 12 }];
  const ringed = drive({ triggers });
  assert.ok(ringed.b.events.some((e) => e.type === 'ring'));
  assert.ok(ringed.yards > calm + 20, `${ringed.yards} vs ${calm}`);

  const b = createBall(makeLaunch({ result: pure, golfer: { power: 1 }, gear: { speed: 1 }, shape: SHAPES[1] }), { rocket: true });
  const env = makeEnv({ gridHalf: 40 });
  for (let i = 0; i < 240; i++) stepBall(b, env);
  assert.ok(fireRocket(b));
  assert.ok(!fireRocket(b), 'rocket only fires once');
  simulate(b, env);
  assert.ok(scoreBall(b, env).yards > calm + 30);
});

test('trampolines bounce, bunkers stop the ball dead', () => {
  const tramp = drive({ regions: [{ shape: 'circle', type: 'trampoline', x: 0, z: -228, r: 30 }] });
  assert.ok(tramp.b.events.some((e) => e.type === 'boing'));
  const bunker = drive({ regions: [{ shape: 'circle', type: 'bunker', x: 0, z: -235, r: 40 }] });
  assert.ok(bunker.yards < drive().yards - 20);
});

test('low gravity on the moon goes much further', () => {
  assert.ok(drive({ gravity: 0.42, drag: 0.4 }).yards > drive().yards * 2);
});
