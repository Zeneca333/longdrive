// Ball flight, bounce and roll. Pure logic, no three.js, so it runs in tests too.
// Units are yards and seconds. +X is right, +Y is up, -Z is downrange (distance = -z).

export const G = 10.73; // 9.81 m/s² in yards
const KD = 0.0034; // quadratic drag
const KL = 0.0024; // lift per unit of backspin
const KS = 0.0021; // curve per unit of sidespin
const SPIN_DECAY = 0.07;
export const BALL_R = 0.15;
export const STEP = 1 / 240;

// e = bounce restitution, imp = speed lost on each bounce, mu = rolling friction
export const SURFACES = {
  fairway: { e: 0.3, imp: 0.3, mu: 0.42 },
  rough: { e: 0.2, imp: 0.42, mu: 0.8 },
  dirt: { e: 0.3, imp: 0.3, mu: 0.5 },
  dust: { e: 0.36, imp: 0.25, mu: 0.45 },
  bunker: { e: 0.04, imp: 0.85, mu: 5 },
  trampoline: { e: 0.3, imp: 0.2, mu: 0.3 },
};
const LOST = new Set(['water', 'lava']);

export function createBall(launch, opts = {}) {
  const lr = (launch.launchDeg * Math.PI) / 180;
  const hr = (launch.headingDeg * Math.PI) / 180;
  return {
    p: { x: 0, y: 0.08, z: 0 },
    v: {
      x: launch.speed * Math.cos(lr) * Math.sin(hr),
      y: launch.speed * Math.sin(lr),
      z: -launch.speed * Math.cos(lr) * Math.cos(hr),
    },
    back: launch.back,
    side: launch.side,
    mode: 'air',
    t: 0,
    carry: null,
    apex: 0,
    gMult: opts.gMult ?? 1,
    dragMult: opts.dragMult ?? 1,
    liftMult: opts.liftMult ?? 1,
    rollMult: (opts.rollMult ?? 1) * (launch.roll ?? 1),
    bouncy: !!opts.bouncy,
    calm: !!opts.calm,
    rocket: opts.rocket ? { fuel: 0.6, firing: false } : null,
    featherT: 0,
    tornadoT: 0,
    captor: null,
    capT: 0,
    used: new Set(),
    lostReason: null,
    events: [],
  };
}

export function windAt(env, y) {
  const f = Math.min(1.7, 0.2 + Math.max(0, y) / 16);
  return { x: env.wind.x * f, z: env.wind.z * f };
}

export function surfaceAt(env, x, z) {
  for (const r of env.regions) {
    if (r.shape === 'circle') {
      const dx = x - r.x, dz = z - r.z;
      if (dx * dx + dz * dz < r.r * r.r) return r.type;
    } else if (Math.abs(x - r.x) < r.hw && Math.abs(z - r.z) < r.hd) {
      return r.type;
    }
  }
  return Math.abs(x) <= env.gridHalf && z < 6 ? 'fairway' : env.rough || 'rough';
}

function emit(b, type, extra) {
  b.events.push({ type, x: b.p.x, y: b.p.y, z: b.p.z, ...extra });
}

export function fireRocket(b) {
  if (!b.rocket || b.rocket.firing || b.rocket.fuel <= 0 || b.mode !== 'air') return false;
  b.rocket.firing = true;
  emit(b, 'rocket');
  return true;
}

export function stepBall(b, env, dt = STEP) {
  if (b.mode === 'rest' || b.mode === 'lost') return;
  b.t += dt;
  if (b.mode === 'captured') return stepCaptured(b, env, dt);

  const p = b.p, v = b.v;
  const prevZ = p.z;
  const grav = G * env.gravity * b.gMult * (b.featherT > 0 ? 0.4 : 1);
  if (b.featherT > 0) b.featherT -= dt;
  let ax = 0, ay = -grav, az = 0;

  if (b.mode === 'air') {
    const w = b.calm ? { x: 0, z: 0 } : windAt(env, p.y);
    const rx = v.x - w.x, ry = v.y, rz = v.z - w.z;
    const sp = Math.hypot(rx, ry, rz);
    const hs = Math.hypot(rx, rz) || 1;
    const Rx = -rz / hs, Rz = rx / hs; // unit "right" of the direction of travel
    const kd = KD * env.drag * b.dragMult * sp;
    ax -= kd * rx; ay -= kd * ry; az -= kd * rz;
    const kl = KL * b.back * b.liftMult * env.drag * sp; // lift = right × velocity
    ax += kl * -Rz * ry; ay += kl * (Rz * rx - Rx * rz); az += kl * Rx * ry;
    const ks = KS * b.side * env.drag * sp; // curve = velocity × up
    ax += ks * -rz; az += ks * rx;
    const decay = 1 - SPIN_DECAY * dt;
    b.back *= decay; b.side *= decay;

    if (b.rocket?.firing && b.rocket.fuel > 0) {
      const s = Math.hypot(v.x, v.y, v.z) || 1;
      ax += (v.x / s) * 30; ay += (v.y / s) * 30 + 6; az += (v.z / s) * 30;
      b.rocket.fuel -= dt;
    }
  }

  applyFields(b, env, dt, (fx, fy, fz) => { ax += fx; ay += fy; az += fz; });
  if (b.mode === 'captured') return;

  if (b.mode === 'air') {
    v.x += ax * dt; v.y += ay * dt; v.z += az * dt;
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
    if (p.y > b.apex) b.apex = p.y;
    if (p.y <= 0 && v.y < 0) hitGround(b, env);
  } else if (b.mode === 'roll') {
    roll(b, env, dt);
  }

  collide(b, env);
  triggers(b, env, prevZ);

  if (b.mode !== 'lost' && (p.z < -2400 || Math.abs(p.x) > 900 || b.t > 40)) {
    v.x = v.y = v.z = 0;
    b.mode = 'rest';
    emit(b, 'rest');
  }
}

function hitGround(b, env) {
  const p = b.p, v = b.v;
  p.y = 0;
  const type = surfaceAt(env, p.x, p.z);
  if (LOST.has(type)) {
    b.mode = 'lost';
    b.lostReason = type;
    emit(b, 'lost', { reason: type });
    return;
  }
  const impact = -v.y;
  if (!b.carry) {
    b.carry = { x: p.x, z: p.z };
    emit(b, 'land', { surface: type, speed: impact });
  } else if (impact > 3) {
    emit(b, 'bounce', { surface: type, speed: impact });
  }
  if (type === 'trampoline') {
    v.y = Math.max(impact * 1.05, 22);
    v.x *= 1.1; v.z *= 1.1;
    emit(b, 'boing');
    return;
  }
  const s = SURFACES[type] || SURFACES.rough;
  let e = s.e, imp = s.imp;
  if (b.bouncy) { e = Math.min(0.78, e * 2.3); imp *= 0.45; }
  v.y = impact * e;
  const keep = (1 - imp) * (1 - 0.3 * Math.max(0, b.back - 0.55));
  v.x *= keep; v.z *= keep;
  b.back *= 0.5; b.side *= 0.25;
  if (v.y < 2.2) { v.y = 0; b.mode = 'roll'; }
}

function roll(b, env, dt) {
  const p = b.p, v = b.v;
  p.y = 0; v.y = 0;
  const type = surfaceAt(env, p.x, p.z);
  if (LOST.has(type)) {
    b.mode = 'lost';
    b.lostReason = type;
    emit(b, 'lost', { reason: type });
    return;
  }
  if (type === 'trampoline') {
    v.y = 9; b.mode = 'air';
    emit(b, 'boing');
    return;
  }
  const s = SURFACES[type] || SURFACES.rough;
  const sp = Math.hypot(v.x, v.z);
  const mu = (s.mu * (b.bouncy ? 0.6 : 1)) / b.rollMult;
  const dec = mu * G * env.gravity * dt;
  if (sp <= dec || sp < 0.25) {
    v.x = v.z = 0;
    b.mode = 'rest';
    emit(b, 'rest', { surface: type });
    return;
  }
  v.x -= (v.x / sp) * dec; v.z -= (v.z / sp) * dec;
  p.x += v.x * dt; p.z += v.z * dt;
}

function applyFields(b, env, dt, add) {
  const p = b.p, v = b.v;
  for (const f of env.fields) {
    if (f.kind === 'tornado') {
      const dx = p.x - f.x, dz = p.z - f.z;
      const d = Math.hypot(dx, dz) || 0.01;
      if (d < f.r && p.y < f.h) {
        if (!b.used.has(f.id)) { b.used.add(f.id); emit(b, 'tornado'); }
        if (b.mode === 'roll') { b.mode = 'air'; v.y = 12; }
        b.tornadoT += dt;
        const spin = b.tornadoT > 1.6 ? 0 : 60;
        add((-dz / d) * spin - (dx / d) * 10, 20, (dx / d) * spin - (dz / d) * 10);
      }
    } else if (f.kind === 'geyser') {
      const cycle = Math.floor((env.t + f.phase) / f.period);
      const on = (env.t + f.phase) % f.period < f.on;
      if (!on || p.y > 40 || Math.hypot(p.x - f.x, p.z - f.z) > f.r) continue;
      const key = `${f.id}:${cycle}`;
      if (!b.used.has(key)) { b.used.add(key); emit(b, 'geyser'); }
      if (b.mode === 'roll') { b.mode = 'air'; v.y = 26; v.z -= 8; }
      else add(0, 85, -6);
    } else if (f.kind === 'ufo') {
      if (b.used.has(f.id) || b.mode !== 'air') continue;
      if (p.y < f.y - 1 && Math.hypot(p.x - f.x, p.z - f.z) < f.r) {
        b.mode = 'captured';
        b.captor = f;
        b.capT = 0;
        b.used.add(f.id);
        emit(b, 'ufo');
        return;
      }
    }
  }
}

function stepCaptured(b, env, dt) {
  const u = b.captor, p = b.p, v = b.v;
  b.capT += dt;
  const k = 1 - Math.exp(-dt * 5);
  p.x += (u.x - p.x) * k; p.y += (u.y - 1.6 - p.y) * k; p.z += (u.z - p.z) * k;
  v.x = v.y = v.z = 0;
  if (b.capT < 1.6) return;
  const good = env.rng() < 0.35;
  if (good) { v.x = 0; v.y = 10; v.z = -75; }
  else { v.x = env.rng() * 30 - 15; v.y = 6; v.z = 32; }
  b.mode = 'air';
  b.captor = null;
  emit(b, 'ufoEject', { good });
}

function collide(b, env) {
  const p = b.p, v = b.v;
  for (const c of env.colliders) {
    const abx = c.b.x - c.a.x, aby = c.b.y - c.a.y, abz = c.b.z - c.a.z;
    const ab2 = abx * abx + aby * aby + abz * abz;
    let t = ab2 > 0 ? ((p.x - c.a.x) * abx + (p.y - c.a.y) * aby + (p.z - c.a.z) * abz) / ab2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = c.a.x + abx * t, cy = c.a.y + aby * t, cz = c.a.z + abz * t;
    let dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
    const R = c.r + BALL_R;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= R * R) continue;
    const d = Math.sqrt(d2) || 0.001;
    const nx = dx / d, ny = dy / d, nz = dz / d;
    const cv = c.v || { x: 0, y: 0, z: 0 };
    let rx = v.x - cv.x, ry = v.y - cv.y, rz = v.z - cv.z;
    const vn = rx * nx + ry * ny + rz * nz;
    if (vn < 0) {
      const j = (1 + c.e) * vn;
      rx -= j * nx; ry -= j * ny; rz -= j * nz;
      const vn2 = rx * nx + ry * ny + rz * nz;
      rx = (rx - vn2 * nx) * c.damp + vn2 * nx;
      ry = (ry - vn2 * ny) * c.damp + vn2 * ny;
      rz = (rz - vn2 * nz) * c.damp + vn2 * nz;
      v.x = rx + cv.x; v.y = ry + cv.y; v.z = rz + cv.z;
      if (c.lastBall !== b || b.t - c.lastHit > 0.3) emit(b, 'hit', { kind: c.kind, speed: -vn });
      c.lastHit = b.t;
      c.lastBall = b;
      if (b.mode === 'roll' && v.y > 1.5) b.mode = 'air';
    }
    p.x = cx + nx * (R + 0.01); p.y = cy + ny * (R + 0.01); p.z = cz + nz * (R + 0.01);
    if (p.y < 0) p.y = 0;
  }
}

const CRATE_EFFECTS = [
  ['boost', 30], ['feather', 20], ['coins', 25], ['item', 15], ['anvil', 10],
];

function pickCrate(rng) {
  let r = rng() * 100;
  for (const [name, w] of CRATE_EFFECTS) if ((r -= w) < 0) return name;
  return 'coins';
}

function triggers(b, env, prevZ) {
  const p = b.p, v = b.v;
  for (const tr of env.triggers) {
    if (tr.taken) continue;
    if (tr.kind === 'ring') {
      if (b.used.has(tr.id) || !(prevZ > tr.z && p.z <= tr.z)) continue;
      if (Math.hypot(p.x - tr.x, p.y - tr.y) > tr.r) continue;
      b.used.add(tr.id);
      const s = Math.hypot(v.x, v.y, v.z);
      const nx = v.x / s, ny = v.y / s, nz = v.z / s - 0.7;
      const n = Math.hypot(nx, ny, nz);
      const s2 = s * 1.3 + 6;
      v.x = (nx / n) * s2; v.y = (ny / n) * s2 + 2; v.z = (nz / n) * s2;
      emit(b, 'ring', { id: tr.id });
      continue;
    }
    const dx = p.x - tr.x, dy = p.y - tr.y, dz = p.z - tr.z;
    if (dx * dx + dy * dy + dz * dz > tr.r * tr.r) continue;
    tr.taken = true;
    if (tr.kind === 'coin') {
      emit(b, 'coin', { id: tr.id, value: tr.value });
    } else if (tr.kind === 'crate') {
      const effect = pickCrate(env.rng);
      if (effect === 'boost') { v.x *= 1.35; v.y = Math.max(v.y, 4) * 1.2; v.z *= 1.35; }
      if (effect === 'feather') b.featherT = 3;
      if (effect === 'anvil') { v.x *= 0.3; v.z *= 0.3; v.y = Math.min(v.y, -6); }
      emit(b, 'crate', { id: tr.id, effect });
    }
  }
}

// Run a ball to rest. Used for tests, tuning and the Laser Scope preview.
export function simulate(b, env, { maxT = 40, every = 6 } = {}) {
  const path = [];
  let i = 0;
  while (b.mode !== 'rest' && b.mode !== 'lost' && b.t < maxT) {
    stepBall(b, env, STEP);
    if (i++ % every === 0) path.push({ x: b.p.x, y: b.p.y, z: b.p.z, mode: b.mode });
  }
  path.push({ x: b.p.x, y: b.p.y, z: b.p.z, mode: b.mode });
  return path;
}

// The scored distance of a ball at rest: zero if it's lost or outside the grid.
export function scoreBall(b, env) {
  if (b.mode === 'lost') return { yards: 0, reason: b.lostReason };
  if (Math.abs(b.p.x) > env.gridHalf) return { yards: 0, reason: 'oob' };
  return { yards: Math.max(0, -b.p.z), reason: null };
}

export function makeEnv(over = {}) {
  return {
    gravity: 1,
    drag: 1,
    wind: { x: 0, z: 0 },
    gridHalf: 30,
    rough: 'rough',
    regions: [],
    colliders: [],
    fields: [],
    triggers: [],
    t: 0,
    rng: Math.random,
    ...over,
  };
}
