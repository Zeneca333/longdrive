import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayKey, dailyLevel, dailyWind } from '../src/daily.js';
import { buildCourse } from '../src/course.js';

test('the same date always gives the same course, wind and coins', () => {
  const a = dailyLevel('2026-10-14'), b = dailyLevel('2026-10-14');
  assert.equal(a.id, b.id);
  assert.deepEqual(dailyWind(a, 0), dailyWind(b, 0));
  assert.deepEqual(dailyWind(a, 2), dailyWind(b, 2));
  const ca = buildCourse(a, { seed: a.seed }), cb = buildCourse(b, { seed: b.seed });
  assert.deepEqual(ca.env.triggers.map((t) => [t.x, t.y, t.z]), cb.env.triggers.map((t) => [t.x, t.y, t.z]));
});

test('the daily course changes from day to day and never uses the practice range', () => {
  const ids = new Set();
  for (let d = 1; d <= 28; d++) {
    const lv = dailyLevel(`2026-11-${String(d).padStart(2, '0')}`);
    assert.notEqual(lv.id, 1);
    assert.ok(lv.daily);
    ids.add(lv.id);
  }
  assert.ok(ids.size >= 5, `only ${ids.size} different courses in a month`);
});

test('today key is a UTC date', () => {
  assert.equal(todayKey(new Date('2026-10-14T23:30:00Z')), '2026-10-14');
  assert.match(todayKey(), /^\d{4}-\d{2}-\d{2}$/);
});
