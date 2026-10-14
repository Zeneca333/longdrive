import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SwingMeter, judge, makeLaunch, SHAPES, METER_MIN } from '../src/swing.js';

test('three clicks: start, lock power, then accuracy', () => {
  const m = new SwingMeter({ tempo: 1 });
  assert.equal(m.press(), 'power');
  for (let i = 0; i < 60; i++) m.update(1 / 60);
  assert.equal(m.press(), 'return');
  assert.ok(m.power > 0.9 && m.power < 1, `power ${m.power}`);
  while (m.pos > 0.01) m.update(1 / 240);
  assert.equal(m.press(), 'done');
  assert.equal(m.result.kind, 'pure');
});

test('never locking power auto-locks at max overswing and shrinks the sweet spot', () => {
  const m = new SwingMeter({ maxPower: 1.15 });
  m.press();
  for (let i = 0; i < 200 && m.state === 'power'; i++) m.update(1 / 60);
  assert.equal(m.state, 'return');
  assert.equal(m.power, 1.15);
  assert.ok(m.sweet < m.sweetBase);
});

test('never clicking accuracy is a shank', () => {
  const m = new SwingMeter();
  m.press(); m.press();
  for (let i = 0; i < 400 && m.state === 'return'; i++) m.update(1 / 60);
  assert.equal(m.state, 'done');
  assert.equal(m.result.kind, 'shank');
  assert.equal(m.result.error, METER_MIN);
});

test('early click hooks left, late click slices right', () => {
  assert.ok(judge(0.1, 0.04).side < 0);
  assert.ok(judge(-0.1, 0.04).side > 0);
  assert.equal(judge(0.01, 0.04).kind, 'pure');
  assert.equal(judge(0.05, 0.04).kind, 'draw');
  assert.match(judge(0.3, 0.04).label, /DUCK HOOK/);
});

test('launch speed scales with golfer, gear and power', () => {
  const res = { power: 1, ...judge(0, 0.04) };
  const base = makeLaunch({ result: res, golfer: { power: 1 }, gear: { speed: 1 }, shape: SHAPES[1] });
  const big = makeLaunch({ result: res, golfer: { power: 1.25 }, gear: { speed: 1.27 }, shape: SHAPES[1] });
  assert.ok(big.speed > base.speed * 1.5);
  assert.equal(base.headingDeg, 0);
});
