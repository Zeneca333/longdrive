import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCourse, rollWind } from '../src/course.js';
import { LEVELS, GOLFERS, GEAR } from '../src/config.js';
import { createBall, simulate, scoreBall } from '../src/physics.js';
import { makeLaunch, SHAPES, judge } from '../src/swing.js';

test('every level builds, places coins and moves its hazards', () => {
  for (const level of LEVELS) {
    const c = buildCourse(level);
    const coins = c.env.triggers.filter((t) => t.kind === 'coin');
    assert.equal(coins.length, level.coins, level.name);
    assert.ok(coins.every((t) => Number.isFinite(t.x + t.y + t.z)), level.name);
    c.update(3.3, 1 / 60);
    for (const col of c.env.colliders) assert.ok(Number.isFinite(col.a.x + col.a.y + col.a.z), `${level.name} ${col.kind}`);
  }
});

test('wind stays inside the level range', () => {
  for (const level of LEVELS) {
    for (let i = 0; i < 20; i++) {
      const w = rollWind(level);
      assert.ok(w.mph >= level.wind[0] && w.mph <= level.wind[1]);
    }
  }
});

// A good player with fair gear for that point in the tour, calm wind, no hazards in the way.
test('every target is reachable with reasonable gear and a pure overswing', () => {
  const gearAt = [[0, 0, 0], [1, 0, 0], [1, 0, 1], [2, 1, 1], [2, 1, 1], [3, 2, 2], [3, 2, 2], [4, 3, 2], [4, 3, 3]];
  for (const level of LEVELS) {
    const [d, bl] = gearAt[level.id - 1];
    const golfer = level.id >= 8 ? GOLFERS[3] : GOLFERS[0];
    const result = { power: golfer.maxPower, ...judge(0, 1) };
    let best = 0;
    for (const shape of SHAPES) {
      const L = makeLaunch({ result, golfer, gear: { speed: GEAR.driver.levels[d].speed }, shape });
      const b = createBall(L, { dragMult: GEAR.ball.levels[bl].drag, liftMult: GEAR.ball.levels[bl].lift, rollMult: golfer.roll });
      const c = buildCourse(level);
      const env = { ...c.env, colliders: [], fields: [], triggers: [], regions: c.env.regions.filter((r) => r.type !== 'bunker') };
      simulate(b, env);
      best = Math.max(best, scoreBall(b, env).yards);
    }
    assert.ok(best >= level.stars[0] * 0.97, `${level.name}: best ${best.toFixed(1)} vs target ${level.stars[0]}`);
    console.log(`  ${level.name.padEnd(30)} target ${level.stars[0]}  sim best ${best.toFixed(1)}`);
  }
});
