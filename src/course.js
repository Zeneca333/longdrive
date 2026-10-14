// Turns a level spec into live course logic: the physics env plus moving hazard entities.
// No rendering here; scene.js reads entity state each frame and draws it.
import { makeEnv, createBall, simulate } from './physics.js';
import { makeRng } from './rng.js';
import { MPH } from './config.js';

const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });

export function buildCourse(level, { seed = level.id * 977 } = {}) {
  const rng = makeRng(seed);
  const gridHalf = level.grid / 2;
  const env = makeEnv({
    gravity: level.gravity ?? 1,
    drag: level.drag ?? 1,
    gridHalf,
    rough: level.rough || 'rough',
    rng: makeRng(seed + 1),
  });
  const entities = [];
  let nextId = 1;
  const add = (e) => { e.id = nextId++; entities.push(e); return e; };
  const collider = (kind, e = 0.4, damp = 0.6, r = 1) => {
    const c = { kind, a: v3(), b: v3(), r, e, damp, v: v3() };
    env.colliders.push(c);
    return c;
  };

  for (const h of level.hazards) {
    switch (h.type) {
      case 'sheep':
        for (let i = 0; i < h.count; i++) {
          const d = rng.range(h.from, h.to);
          const ent = add({
            kind: h.skin || 'sheep', x: rng.range(-gridHalf + 4, gridHalf - 4), z: -d,
            heading: rng.range(0, Math.PI * 2), speed: rng.range(0.6, 1.6), turnT: rng.range(1, 4),
            zMin: -h.to, zMax: -h.from, y: 0,
          });
          ent.col = collider(ent.kind, 0.45, 0.55, h.skin === 'cow' ? 1.5 : 1.15);
          ent.update = (t, dt) => {
            ent.turnT -= dt;
            if (ent.turnT < 0) { ent.heading += rng.range(-2, 2); ent.turnT = rng.range(1.5, 5); ent.speed = rng.range(0, 1.8); }
            ent.x += Math.cos(ent.heading) * ent.speed * dt;
            ent.z += Math.sin(ent.heading) * ent.speed * dt;
            if (Math.abs(ent.x) > gridHalf - 3) { ent.x = Math.sign(ent.x) * (gridHalf - 3); ent.heading = Math.PI - ent.heading; }
            if (ent.z < ent.zMin || ent.z > ent.zMax) { ent.z = Math.min(ent.zMax, Math.max(ent.zMin, ent.z)); ent.heading = -ent.heading; }
            const cy = h.skin === 'cow' ? 1.3 : 0.9;
            ent.col.a = ent.col.b = v3(ent.x, cy, ent.z);
          };
        }
        break;
      case 'cart': {
        const ent = add({ kind: 'cart', x: h.from, z: -h.d, y: 0, dir: Math.sign(h.to - h.from), heading: 0 });
        ent.col = collider('cart', 0.6, 0.7, 1.6);
        ent.update = (t) => {
          const span = Math.abs(h.to - h.from);
          const u = ((t * h.speed) % (span * 2)) / span;
          const k = u < 1 ? u : 2 - u;
          ent.x = h.from + (h.to - h.from) * k;
          ent.dir = (u < 1 ? 1 : -1) * Math.sign(h.to - h.from);
          ent.heading = ent.dir > 0 ? 0 : Math.PI;
          ent.col.a = ent.col.b = v3(ent.x, 1, ent.z);
          ent.col.v = v3(ent.dir * h.speed, 0, 0);
        };
        break;
      }
      case 'bunker':
        env.regions.push({ shape: 'circle', type: 'bunker', x: h.x, z: -h.d, r: h.r, skin: h.skin || 'sand' });
        break;
      case 'trampoline':
        env.regions.push({ shape: 'circle', type: 'trampoline', x: h.x, z: -h.d, r: h.r, skin: h.skin || 'tramp' });
        break;
      case 'water':
      case 'lava':
        env.regions.push({
          shape: 'rect', type: h.type, x: 0, z: -(h.from + h.to) / 2,
          hw: gridHalf + 40, hd: (h.to - h.from) / 2,
        });
        break;
      case 'geese': {
        const span = gridHalf + 70;
        for (let i = 0; i < h.n; i++) {
          // V formation: the leader in front, the rest trailing behind on alternating sides.
          const dir = Math.sign(h.speed);
          const ent = add({
            kind: 'goose', x: 0, y: h.y, z: -h.d, flap: rng.range(0, 6), dir,
            ox: -Math.ceil(i / 2) * 3.4 * dir,
            oz: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 2.4,
            oy: rng.range(-1.5, 1.5),
          });
          ent.col = collider('goose', 0.15, 0.35, 1.5);
          ent.update = (t) => {
            const raw = h.speed * t - span;
            const lead = ((raw % (span * 2)) + span * 2) % (span * 2) - span;
            ent.x = lead + ent.ox;
            ent.y = h.y + ent.oy + Math.sin(t * 1.3 + i) * 1.2;
            ent.z = -h.d + ent.oz;
            ent.col.a = ent.col.b = v3(ent.x, ent.y, ent.z);
            ent.col.v = v3(h.speed, 0, 0);
          };
        }
        break;
      }
      case 'windmill': {
        const ent = add({ kind: 'windmill', x: h.x, z: -h.d, hub: h.hub, blade: h.blade, angle: 0, spin: h.spin });
        const tower = collider('windmill', 0.4, 0.6, 3.2);
        tower.a = v3(h.x, 0, -h.d - 3); tower.b = v3(h.x, h.hub - 2, -h.d - 3);
        ent.blades = [0, 1, 2, 3].map(() => collider('windmill', 0.55, 0.7, 1.4));
        ent.update = (t) => {
          ent.angle = t * h.spin;
          ent.blades.forEach((c, i) => {
            const a = ent.angle + (i * Math.PI) / 2;
            const ca = Math.cos(a), sa = Math.sin(a);
            c.a = v3(h.x + ca * 1.5, h.hub + sa * 1.5, -h.d);
            c.b = v3(h.x + ca * h.blade, h.hub + sa * h.blade, -h.d);
            c.v = v3(-sa * h.spin * h.blade * 0.6, ca * h.spin * h.blade * 0.6, 0);
          });
        };
        break;
      }
      case 'wreck': {
        const ent = add({ kind: 'wreck', x: h.x, z: -h.d, pivot: h.pivot, len: h.len, theta: 0, ballX: 0, ballY: 0 });
        ent.col = collider('wreck', 0.85, 0.8, 3.6);
        ent.update = (t) => {
          ent.theta = h.amp * Math.sin(t * h.speed + h.d);
          const w = h.amp * h.speed * Math.cos(t * h.speed + h.d);
          ent.ballX = h.x + Math.sin(ent.theta) * h.len;
          ent.ballY = h.pivot - Math.cos(ent.theta) * h.len;
          ent.col.a = ent.col.b = v3(ent.ballX, ent.ballY, ent.z);
          ent.col.v = v3(Math.cos(ent.theta) * w * h.len, Math.sin(ent.theta) * w * h.len, 0);
        };
        break;
      }
      case 'geyser': {
        const f = { kind: 'geyser', x: h.x, z: -h.d, r: 3.4, period: h.period, on: h.on, phase: h.phase || 0, id: `g${nextId}` };
        env.fields.push(f);
        add({ kind: 'geyser', x: h.x, z: -h.d, field: f, update() {} });
        break;
      }
      case 'bombs':
        for (let i = 0; i < h.count; i++) {
          const d = h.from + ((h.to - h.from) * (i + 0.5)) / h.count;
          const period = rng.range(4, 6.5), phase = rng.range(0, period), side = i % 2 ? 1 : -1;
          const span = gridHalf + 30;
          const ent = add({ kind: 'bomb', x: 0, y: 0, z: -d, spin: 0 });
          ent.col = collider('bomb', 0.5, 0.6, 1.8);
          ent.update = (t) => {
            const u = ((t + phase) % period) / period;
            ent.x = side * (-span + 2 * span * u);
            ent.y = 4 + 120 * u * (1 - u);
            ent.spin = t * 3;
            ent.col.a = ent.col.b = v3(ent.x, ent.y, ent.z);
            ent.col.v = v3((side * 2 * span) / period, (120 * (1 - 2 * u)) / period, 0);
          };
        }
        break;
      case 'tornado': {
        const f = { kind: 'tornado', x: 0, z: -h.d, r: 15, h: 110, id: `t${nextId}` };
        env.fields.push(f);
        const ent = add({ kind: 'tornado', x: 0, z: -h.d, field: f, cows: [] });
        for (let i = 0; i < 4; i++) {
          const cow = { col: collider('cow', 0.6, 0.6, 1.6), a: (i / 4) * Math.PI * 2, rad: 9 + (i % 2) * 4, y: 14 + i * 9, x: 0, z: 0 };
          ent.cows.push(cow);
        }
        ent.update = (t) => {
          ent.x = Math.sin(((t + (h.phase || 0)) / h.period) * Math.PI * 2) * h.range;
          f.x = ent.x;
          for (const c of ent.cows) {
            const a = c.a + t * 1.7;
            c.x = ent.x + Math.cos(a) * c.rad; c.z = ent.z + Math.sin(a) * c.rad;
            c.col.a = c.col.b = v3(c.x, c.y + Math.sin(t + c.a) * 3, c.z);
            c.col.v = v3(-Math.sin(a) * c.rad * 1.7, 0, Math.cos(a) * c.rad * 1.7);
          }
        };
        break;
      }
      case 'ufo': {
        const f = { kind: 'ufo', x: 0, y: h.y, z: -h.d, r: h.r, id: `u${nextId}` };
        env.fields.push(f);
        const ent = add({ kind: 'ufo', x: 0, y: h.y, z: -h.d, field: f, r: h.r });
        ent.update = (t) => {
          ent.x = Math.sin(((t + (h.phase || 0)) / h.period) * Math.PI * 2) * h.range;
          ent.y = h.y + Math.sin(t * 1.7) * 1.5;
          f.x = ent.x; f.y = ent.y;
        };
        break;
      }
      case 'asteroids':
        for (let i = 0; i < h.count; i++) {
          const d = rng.range(h.from, h.to);
          const ent = add({
            kind: 'asteroid', x: rng.range(-gridHalf, gridHalf), y: rng.range(18, 110), z: -d,
            size: rng.range(2.2, 4.8), drift: rng.range(-3, 3), spin: rng.range(-1, 1), seed: rng.int(1, 9999),
          });
          ent.x0 = ent.x;
          ent.col = collider('asteroid', 0.7, 0.8, ent.size);
          ent.update = (t) => {
            ent.x = ent.x0 + Math.sin(t * 0.2 + i) * 10 + ent.drift * Math.sin(t * 0.07);
            ent.col.a = ent.col.b = v3(ent.x, ent.y, ent.z);
          };
        }
        break;
      case 'ring':
        env.triggers.push({ kind: 'ring', id: `r${nextId}`, x: h.x, y: h.y, z: -h.d, r: h.r });
        add({ kind: 'ring', x: h.x, y: h.y, z: -h.d, r: h.r, update() {} });
        break;
    }
  }

  // Coins and crates follow a few reference flights so they're actually reachable.
  const paths = referencePaths(level, env);
  for (let i = 0; i < level.coins; i++) {
    const path = paths[i % paths.length];
    const pt = path[Math.floor(rng.range(0.12, 0.85) * path.length)];
    env.triggers.push({
      kind: 'coin', id: `c${i}`, value: 5, r: 2.6,
      x: Math.max(-gridHalf, Math.min(gridHalf, pt.x + rng.range(-7, 7))),
      y: Math.max(2, pt.y + rng.range(-4, 5)),
      z: pt.z + rng.range(-6, 6),
    });
  }
  for (let i = 0; i < level.crates; i++) {
    const path = paths[(i + 1) % paths.length];
    const pt = path[Math.floor(rng.range(0.2, 0.7) * path.length)];
    env.triggers.push({
      kind: 'crate', id: `k${i}`, r: 3,
      x: pt.x + rng.range(-9, 9), y: Math.max(4, pt.y + rng.range(-2, 6)), z: pt.z,
    });
  }

  const course = {
    level, env, entities, gridHalf,
    length: Math.max(level.stars[2] + 220, 520),
    update(t, dt) {
      env.t = t;
      for (const e of entities) e.update?.(t, dt);
    },
    reset() {
      for (const tr of env.triggers) tr.taken = false;
    },
  };
  course.update(0, 0);
  return course;
}

// Flights a decent player would hit on this level, used to place coins and crates.
function referencePaths(level, env) {
  const out = [];
  const speedByLevel = 72 * (1 + (level.id - 1) * 0.055);
  const clean = { ...env, colliders: [], fields: [], triggers: [], regions: [], wind: { x: 0, z: 0 }, gridHalf: 999 };
  for (const [launchDeg, back, mult] of [[12.5, 0.85, 1], [16, 1.05, 0.95], [9.5, 0.62, 1.05], [14, 0.9, 1.12]]) {
    const b = createBall({ speed: speedByLevel * mult, launchDeg, headingDeg: 0, back, side: 0 });
    const path = simulate(b, clean, { every: 8 }).filter((p) => p.mode === 'air' && p.y > 1.5);
    if (path.length > 4) out.push(path);
  }
  return out;
}

// Random wind for one ball. Direction is measured from straight downrange (a tailwind).
export function rollWind(level, rng = Math.random) {
  const [lo, hi] = level.wind;
  const mph = Math.round(lo + (hi - lo) * rng());
  const [d0, d1] = level.windDir || [-180, 180];
  const deg = d0 + (d1 - d0) * rng();
  const r = (deg * Math.PI) / 180;
  return { mph, deg, x: Math.sin(r) * mph * MPH, z: -Math.cos(r) * mph * MPH };
}
