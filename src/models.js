// Every voxel model in the game. Models face +X unless noted. Sizes are in yards.
import * as THREE from './three.js';
import { Vox, MAT, voxSphere, voxRing } from './vox.js';
import { makeRng } from './rng.js';

// ---------- golfers ----------
// Built in 0.1-yard voxels. The golfer stands at x = -1.15 from the ball and faces it (+X).
// `rig` holds the arms and club and swings around the X axis.

const BALL_X = 11.5; // ball position in golfer voxel units

const GOLFER_LOOKS = {
  chip: { skin: '#f2c29a', shirt: '#2f8cff', shirt2: '#1f6fd6', pants: '#2b2f4a', shoes: '#ffffff', hair: '#6b3e1e', hat: '#ffffff', glove: '#ffffff' },
  tony: { skin: '#d99a6c', shirt: '#ffffff', shirt2: '#ff4f6d', pants: '#6b7280', shoes: '#111827', hair: '#1b1b1b', hat: '#ff4f6d', glove: '#ffffff' },
  granny: { skin: '#f5cfb2', shirt: '#8e5bd9', shirt2: '#ffffff', pants: '#c7b3f0', shoes: '#ffffff', hair: '#d9dbe3', hat: '#d9dbe3', glove: '#ffffff' },
  rex: { skin: '#4fb04a', shirt: '#3e8f3a', shirt2: '#c9e88a', pants: '#3e8f3a', shoes: '#2d6b2a', hair: '#2d6b2a', hat: '#ffd23d', glove: '#c9e88a' },
};

export function makeGolfer(id) {
  const L = GOLFER_LOOKS[id] || GOLFER_LOOKS.chip;
  const root = new THREE.Group();
  const S = 0.1;
  let shoulder, armLen = 6.5, armW = 1.1;

  if (id === 'rex') {
    const v = new Vox(S);
    for (const z of [-2.4, 2.4]) {
      v.box(0, 3.5, z, 3, 7, 2.6, L.skin);
      v.box(1.2, 0.6, z, 4.6, 1.2, 3, L.shoes);
      v.box(3.6, 0.6, z - 0.8, 0.8, 0.8, 0.6, '#ffffff');
      v.box(3.6, 0.6, z + 0.8, 0.8, 0.8, 0.6, '#ffffff');
    }
    v.box(-0.5, 10, 0, 8, 7, 7, L.skin);
    v.box(2.6, 9.5, 0, 2, 5.5, 5.4, L.shirt2); // belly
    v.box(-5.5, 9, 0, 4, 4.6, 5, L.skin);
    v.box(-9, 7.6, 0, 4, 3.4, 3.8, L.skin);
    v.box(-12.4, 6.4, 0, 3.6, 2.4, 2.6, L.skin);
    v.box(-14.8, 5.6, 0, 2.4, 1.6, 1.6, L.skin);
    for (let i = 0; i < 5; i++) v.box(-3 - i * 2.6, 13.4 - i * 1.1, 0, 1.4, 1, 1, L.shoes); // back spikes
    v.box(1.8, 14.5, 0, 4, 4, 4.6, L.skin); // neck
    v.box(4.2, 17.5, 0, 8, 4.6, 5.6, L.skin); // head
    v.box(4.6, 14.9, 0, 6.6, 1.6, 4.8, L.shirt2); // jaw
    for (let i = 0; i < 5; i++) v.box(2.6 + i * 1.3, 15.9, 2.0, 0.6, 0.8, 0.5, '#ffffff').box(2.6 + i * 1.3, 15.9, -2.0, 0.6, 0.8, 0.5, '#ffffff');
    for (const z of [-2.85, 2.85]) {
      v.box(3.4, 18.6, z, 1.6, 1.6, 0.2, '#ffffff');
      v.box(3.7, 18.5, z * 1.02, 0.8, 0.9, 0.2, '#111111');
    }
    v.box(8.1, 18.8, 1, 0.3, 0.5, 0.6, '#1d4d1b').box(8.1, 18.8, -1, 0.3, 0.5, 0.6, '#1d4d1b');
    v.box(3.6, 20.2, 0, 6, 0.8, 6, L.hat); // tiny golf cap
    v.box(7.4, 20, 0, 2.4, 0.4, 5, L.hat);
    root.add(v.mesh());
    shoulder = new THREE.Vector3(4.4, 12.2, 0);
    armLen = 2.2;
    armW = 1.2;
  } else {
    const big = id === 'tony';
    const granny = id === 'granny';
    const legH = granny ? 5.5 : 7;
    const v = new Vox(S);
    for (const z of [-2.2, 2.2]) {
      v.box(0.5, 0.5, z, 3.2, 1, 1.9, L.shoes);
      v.box(0, 1 + legH / 2, z, big ? 2.3 : 1.8, legH, big ? 2.3 : 1.8, granny ? L.skin : L.pants);
    }
    const hip = 1 + legH;
    if (granny) v.box(0, hip - 1.2, 0, 3.4, 5.6, 6.8, L.pants); // skirt
    v.box(0, hip + 0.5, 0, big ? 3.2 : 2.4, 1, big ? 7.6 : 6.2, granny ? L.pants : '#222222');
    root.add(v.mesh());

    const upper = new THREE.Group();
    upper.position.set(0, (hip + 1) * S, 0);
    upper.rotation.z = -0.35;
    const u = new Vox(S);
    const tw = big ? 8.4 : granny ? 5.6 : 6.2;
    const td = big ? 3.6 : 2.7;
    u.box(0.2, 2.8, 0, td, 5.6, tw, L.shirt);
    if (big) u.box(0.2 + td / 2, 2.8, 0, 0.2, 5.6, 1.6, L.shirt2);
    else if (granny) { u.box(0.2 + td / 2, 3.2, 0, 0.2, 4.8, 1.2, L.shirt2); u.box(0.9, 5.7, 0, 1.6, 0.6, 3.6, '#ffffff'); }
    else u.box(0.2, 5.4, 0, td + 0.2, 0.6, 3.4, L.shirt2);
    const hy = 8.3;
    u.box(0.4, hy, 0, 4.4, 4.4, 4.4, L.skin);
    u.box(2.65, hy + 0.3, 1, 0.2, 0.8, 0.6, '#1b2340').box(2.65, hy + 0.3, -1, 0.2, 0.8, 0.6, '#1b2340');
    u.box(2.85, hy - 0.4, 0, 0.6, 0.9, 0.7, L.skin);
    u.box(2.65, hy - 1.3, 0, 0.2, 0.4, 1.6, '#9b3b3b');
    if (big) {
      u.box(2.75, hy - 0.9, 0, 0.3, 0.6, 2.6, '#1b1b1b'); // mustache
      u.box(0.4, hy + 2.6, 0, 4.4, 1.2, 4.4, L.hair); // flat top
      u.box(0.4, hy + 1.5, 0, 4.6, 0.7, 4.6, L.hat); // headband
    } else if (granny) {
      u.box(0.2, hy + 2.5, 0, 4.6, 0.9, 4.6, L.hair);
      u.box(-1.9, hy + 0.8, 0, 0.8, 3.6, 4.6, L.hair);
      u.box(-0.8, hy + 3.6, 0, 2, 1.8, 2, L.hair); // bun
      u.box(2.75, hy + 0.3, 1, 0.15, 1.2, 1.2, '#1b2340').box(2.75, hy + 0.3, -1, 0.15, 1.2, 1.2, '#1b2340');
      for (let i = -2; i <= 2; i++) u.box(1.8, 5.9, i * 0.8, 0.5, 0.5, 0.5, '#fff8ec'); // pearls
    } else {
      u.box(0.0, hy + 2.5, 0, 4.6, 0.8, 4.6, L.hair);
      u.box(-1.9, hy + 0.8, 0, 0.8, 3, 4.6, L.hair);
      u.box(0.4, hy + 1.7, 0, 4.7, 0.7, 4.7, L.hat); // visor band
      u.box(3.3, hy + 1.5, 0, 1.8, 0.3, 4.2, L.hat); // brim
    }
    upper.add(u.mesh());
    root.add(upper);
    upper.updateMatrix();
    shoulder = new THREE.Vector3(0.4, 5.6, 0).multiplyScalar(S).applyMatrix4(upper.matrix).multiplyScalar(1 / S);
    if (big) { armW = 1.6; }
  }

  // Swing rig: chain from shoulders to clubhead, aimed so the head sits at the ball.
  const dx = BALL_X - shoulder.x, dy = 0.6 - shoulder.y;
  const reach = Math.hypot(dx, dy);
  const rig = new THREE.Group();
  rig.position.copy(shoulder).multiplyScalar(S);
  const tilt = new THREE.Group();
  tilt.rotation.z = Math.atan2(dx, -dy);
  const a = new Vox(S);
  for (const z of [-0.7, 0.7]) {
    a.box(0, -1, z, armW, 2, armW, id === 'rex' ? L.skin : L.shirt);
    a.box(0, -1 - armLen / 2 - 0.5, z, armW * 0.9, armLen - 1, armW * 0.9, L.skin);
  }
  const hy = -armLen - 0.6;
  a.box(0, hy, 0, 1.3, 1.2, 2.2, L.glove);
  a.box(0, hy - 1.6, 0, 0.6, 2, 0.6, '#1b1b1b');
  const shaftEnd = -reach + 0.8;
  a.box(0, (hy - 2.6 + shaftEnd) / 2, 0, 0.35, -(shaftEnd - (hy - 2.6)), 0.35, '#c9ced6');
  a.box(0.7, -reach + 0.4, 0, 2.2, 1.2, 1.4, '#1b2340'); // driver head
  a.box(0.7, -reach + 0.4, -0.72, 2.0, 1.0, 0.1, '#c9ced6'); // face
  tilt.add(a.mesh());
  rig.add(tilt);
  root.add(rig);

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  if (id === 'rex') root.scale.setScalar(1.08);
  root.position.set(-BALL_X * S * (id === 'rex' ? 1.08 : 1), 0, 0);
  return {
    root,
    rig,
    setSwing(angle) { rig.rotation.x = angle; },
  };
}

// ---------- the ball, tee and markers ----------

export function makeBall() {
  const m = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.17, 1),
    new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.25, flatShading: true }),
  );
  m.castShadow = true;
  return m;
}

export function makeTeeBox(theme) {
  const v = new Vox(1);
  const turf = theme === 'moon' ? '#3cb04a' : '#54c44a';
  v.box(0, 0.06, 1, 10, 0.12, 9, turf);
  v.box(0, 0.07, 0, 0.12, 0.14, 0.12, '#e0b070'); // tee peg
  for (const x of [-3.4, 3.4]) {
    v.box(x, 0.22, -1.2, 0.44, 0.44, 0.44, '#ff4f6d');
    v.box(x, 0.5, -1.2, 0.3, 0.12, 0.3, '#ffffff');
  }
  return v.mesh(MAT.vox, { cast: false, receive: true });
}

export function makeFlag(color = '#ffc83d', height = 9) {
  const g = new THREE.Group();
  const v = new Vox(1);
  v.box(0, height / 2, 0, 0.22, height, 0.22, '#ffffff');
  v.box(0, height + 0.2, 0, 0.4, 0.4, 0.4, color);
  g.add(v.mesh());
  const f = new Vox(1);
  f.box(1.3, 0, 0, 2.6, 1.6, 0.1, color);
  const flag = f.mesh();
  flag.position.set(0, height - 1, 0);
  g.add(flag);
  g.userData.cloth = flag;
  return g;
}

// ---------- animals and movers ----------

export function makeSheep() {
  const v = new Vox(0.1);
  const r = makeRng(7);
  v.box(0, 9, 0, 16, 10, 11, '#f7f5ef');
  for (let i = 0; i < 9; i++) v.box(r.range(-6, 6), 14, r.range(-4, 4), r.range(3, 5), 2.6, r.range(3, 5), i % 2 ? '#ffffff' : '#ecebe4');
  v.box(10, 10, 0, 5, 6, 5, '#26262b');
  v.box(10, 12.3, 3, 2, 1, 2, '#26262b').box(10, 12.3, -3, 2, 1, 2, '#26262b');
  v.box(12.6, 11, 1.2, 0.2, 1, 1, '#ffffff').box(12.6, 11, -1.2, 0.2, 1, 1, '#ffffff');
  for (const x of [-5, 5]) for (const z of [-3.5, 3.5]) v.box(x, 2.5, z, 2, 5, 2, '#26262b');
  return v.mesh();
}

export function makeCow() {
  const v = new Vox(0.12);
  v.box(0, 10, 0, 18, 9, 10, '#ffffff');
  v.box(-3, 12, 5.05, 6, 5, 0.2, '#1b1b1b').box(5, 9, -5.05, 5, 4, 0.2, '#1b1b1b').box(-6, 14.6, 0, 4, 0.2, 6, '#1b1b1b');
  v.box(11, 12, 0, 5, 6, 6, '#ffffff');
  v.box(13.8, 10.6, 0, 1.4, 3, 5, '#ffb3c1');
  v.box(11, 15.6, 2.6, 1, 1.6, 1, '#f3e3b5').box(11, 15.6, -2.6, 1, 1.6, 1, '#f3e3b5');
  v.box(13.6, 13.4, 1.6, 0.2, 1, 1, '#1b1b1b').box(13.6, 13.4, -1.6, 0.2, 1, 1, '#1b1b1b');
  for (const x of [-6, 6]) for (const z of [-3.5, 3.5]) v.box(x, 3, z, 2.4, 6, 2.4, '#ffffff');
  v.box(-9.6, 11, 0, 1, 6, 1, '#1b1b1b');
  return v.mesh();
}

export function makeCart() {
  const g = new THREE.Group();
  const v = new Vox(1);
  v.box(0, 0.9, 0, 2.6, 1, 1.8, '#ffc83d');
  v.box(-0.6, 1.9, 0, 1.2, 1.2, 1.6, '#ffc83d');
  v.box(-0.6, 2.7, 0, 1.4, 0.15, 1.8, '#1b2340');
  v.box(-0.2, 2.1, 0, 0.1, 1.0, 1.4, '#9fd8ff');
  for (const x of [-0.8, 0.9]) for (const z of [-0.95, 0.95]) v.box(x, 0.4, z, 0.8, 0.8, 0.25, '#1b1b1b');
  for (let i = 0; i < 5; i++) v.box(1.7, 0.8, -0.8 + i * 0.4, 0.8, 1.2, 0.08, '#9aa3b5');
  v.box(1.7, 1.45, 0, 0.8, 0.1, 1.8, '#9aa3b5');
  v.box(-0.2, 2.0, 0.55, 0.5, 0.8, 0.5, '#2f8cff'); // a tiny driver in a tiny helmet
  v.box(-0.2, 2.55, 0.55, 0.55, 0.4, 0.55, '#ff4f6d');
  g.add(v.mesh());
  return g;
}

export function makeGoose() {
  const g = new THREE.Group();
  const v = new Vox(0.25);
  v.box(0, 0, 0, 6, 3.2, 3.4, '#8a7a66');
  v.box(-1, -1.2, 0, 4.4, 1, 3, '#d9cdb8');
  v.box(-3.6, 0.4, 0, 1.6, 1.6, 2.4, '#1f1f1f');
  v.box(3.8, 2.2, 0, 1.4, 4, 1.4, '#1f1f1f');
  v.box(4.8, 4.4, 0, 2.6, 1.8, 1.5, '#1f1f1f');
  v.box(4.6, 4.0, 0.78, 1.2, 1, 0.1, '#ffffff').box(4.6, 4.0, -0.78, 1.2, 1, 0.1, '#ffffff');
  v.box(6.5, 4.3, 0, 1.2, 0.7, 0.9, '#2b2b2b');
  v.box(5.4, 4.9, 0.78, 0.4, 0.4, 0.1, '#ff4f6d').box(5.4, 4.9, -0.78, 0.4, 0.4, 0.1, '#ff4f6d'); // angry eyes
  v.box(0, -2.2, 0.8, 0.6, 1.2, 0.6, '#ff9a3d').box(0, -2.2, -0.8, 0.6, 1.2, 0.6, '#ff9a3d');
  g.add(v.mesh());
  const wings = [];
  for (const side of [1, -1]) {
    const w = new Vox(0.25);
    w.box(0, 0, side * 3.4, 4.2, 0.6, 6, '#6e604f');
    w.box(-0.6, 0, side * 6.6, 3, 0.5, 1.6, '#4a4035');
    const m = w.mesh();
    m.position.set(0, 0.6 * 0.25, side * 0.4);
    g.add(m);
    wings.push({ m, side });
  }
  g.userData.wings = wings;
  return g;
}

// ---------- big hazards ----------

export function makeWindmill(hub, blade) {
  const g = new THREE.Group();
  const v = new Vox(1);
  const layers = Math.ceil(hub - 1);
  for (let i = 0; i < layers; i++) {
    const w = 7 - (i / layers) * 2.6;
    v.box(0, i + 0.5, -3, w, 1, w, i % 3 === 0 ? '#8c3b2a' : '#a24a33');
  }
  for (let i = 2; i < layers - 2; i += 4) v.box(0, i, -3 + 3.1 - (i / layers) * 1.3, 1.2, 1.8, 0.3, '#ffe7a8');
  v.box(0, layers + 0.8, -3, 5, 1.6, 5, '#2b2f4a');
  v.box(0, layers + 2, -3, 3.4, 1.2, 3.4, '#2b2f4a');
  v.box(0, hub, -1.4, 1.4, 1.4, 3.2, '#5a3a22');
  g.add(v.mesh());
  const sails = new THREE.Group();
  sails.position.set(0, hub, 0);
  for (let i = 0; i < 4; i++) {
    const s = new Vox(1);
    s.box(blade / 2, 0, 0, blade, 0.7, 0.6, '#5a3a22');
    for (let k = 3; k < blade; k += 2) s.box(k, 1.3, 0.1, 1.7, 2.2, 0.2, (k + i) % 4 < 2 ? '#fff8ec' : '#ffe2c7');
    const m = s.mesh();
    m.rotation.z = (i * Math.PI) / 2;
    sails.add(m);
  }
  sails.add(new Vox(1).box(0, 0, 0.3, 1.8, 1.8, 0.8, '#ff4f6d').mesh());
  g.add(sails);
  g.userData.sails = sails;
  return g;
}

export function makeCrane(pivotX, pivotY, len) {
  // Crane tower sits off the fairway; the jib reaches over to the pivot.
  const g = new THREE.Group();
  const towerX = pivotX + (pivotX >= 0 ? 34 : -34);
  const v = new Vox(1);
  for (let y = 0; y < pivotY + 2; y += 2) {
    v.box(towerX, y + 1, -1, 0.4, 2, 0.4, '#ffb000').box(towerX + 2, y + 1, -1, 0.4, 2, 0.4, '#ffb000');
    v.box(towerX, y + 1, 1, 0.4, 2, 0.4, '#ffb000').box(towerX + 2, y + 1, 1, 0.4, 2, 0.4, '#ffb000');
    v.box(towerX + 1, y, 0, 2.4, 0.3, 2.4, '#e09000');
  }
  const jibLen = Math.abs(towerX - pivotX) + 6;
  const jx = (towerX + 1 + pivotX) / 2;
  v.box(jx, pivotY + 1.2, 0, jibLen, 1.2, 1.4, '#ffb000');
  v.box(towerX + 1, pivotY + 3.5, 0, 3, 2.5, 2.6, '#2b2f4a');
  v.box(towerX + 1 + Math.sign(towerX - pivotX) * 6, pivotY + 1.2, 0, 4, 3, 2.4, '#6b7280'); // counterweight
  v.box(pivotX, pivotY + 0.3, 0, 1.6, 0.8, 1.6, '#2b2f4a');
  g.add(v.mesh());
  const swing = new THREE.Group();
  swing.position.set(pivotX, pivotY, 0);
  const c = new Vox(1);
  c.box(0, -len / 2, 0, 0.2, len, 0.2, '#1b1b1b');
  voxSphere(c, 0, -len, 0, 3.6, (x, y) => (y > 2 ? '#4a4f5c' : '#2b2f38'), { step: 0.9 });
  swing.add(c.mesh());
  g.add(swing);
  g.userData.swing = swing;
  return g;
}

export function makeTrampoline(r, skin) {
  const v = new Vox(1);
  if (skin === 'hay') {
    v.box(0, 0.7, 0, r * 1.6, 1.4, r * 1.6, '#e8c15a');
    for (let i = -2; i <= 2; i++) v.box(i * r * 0.3, 1.42, 0, 0.2, 0.05, r * 1.6, '#c99a2e');
    v.box(0, 1.5, 0, r * 0.9, 0.1, 0.4, '#ff4f6d');
    return v.mesh(MAT.vox, { receive: true });
  }
  for (let x = -r; x <= r; x += 1) for (let z = -r; z <= r; z += 1) {
    if (Math.hypot(x, z) < r - 0.6) v.box(x, 0.9, z, 1, 0.1, 1, '#1b2340');
  }
  voxRing(v, r - 0.2, 0.7, 28, (i) => (i % 2 ? '#2f8cff' : '#ff4f6d'), 'y', 0.95);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    v.box(Math.cos(a) * (r - 0.4), 0.45, Math.sin(a) * (r - 0.4), 0.3, 0.9, 0.3, '#9aa3b5');
  }
  return v.mesh(MAT.vox, { receive: true });
}

export function makeTornado() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.62, depthWrite: false });
  const layers = [];
  for (let i = 0; i < 22; i++) {
    const y = i * 5;
    const rad = 1.5 + Math.pow(i / 21, 1.4) * 15;
    const v = new Vox(1);
    const n = 10 + i;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const s = 2 + i * 0.18;
      v.box(Math.cos(a) * rad, 0, Math.sin(a) * rad, s, 3.6, s, k % 3 ? '#8a8f96' : '#6d727a');
    }
    const m = v.mesh(mat, { cast: false });
    m.position.y = y + 1;
    g.add(m);
    layers.push(m);
  }
  g.userData.layers = layers;
  return g;
}

export function makeUfo(beamR, height) {
  const g = new THREE.Group();
  const v = new Vox(1);
  voxSphere(v, 0, 0, 0, 7, (x, y, z) => (Math.abs(y) < 0.6 ? '#9aa3b5' : '#c9ced6'), { step: 1 });
  const body = v.mesh();
  body.scale.set(1, 0.28, 1);
  g.add(body);
  const d = new Vox(1);
  voxSphere(d, 0, 0, 0, 3, () => '#7fe3ff', { step: 1 });
  const dome = d.mesh(MAT.glass, { cast: false });
  dome.position.y = 1.6;
  g.add(dome);
  const l = new Vox(1);
  voxRing(l, 6.6, 0.8, 14, (i) => ['#ff4f6d', '#ffc83d', '#4cff8a'][i % 3], 'y', 0);
  const lights = l.mesh(MAT.glow, { cast: false });
  g.add(lights);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(beamR, height, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: '#7dff9a', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  );
  beam.position.y = -height / 2;
  g.add(beam);
  g.userData.lights = lights;
  g.userData.beam = beam;
  return g;
}

export function makeAsteroid(size, seed) {
  const v = new Vox(1);
  const rng = makeRng(seed);
  const cols = ['#7a7066', '#8d847a', '#5f574f', '#9b9187'];
  voxSphere(v, 0, 0, 0, size, () => rng.pick(cols), { step: Math.max(0.8, size / 4), noise: size * 0.5, rng });
  return v.mesh();
}

export function makeBomb() {
  const v = new Vox(1);
  const rng = makeRng(3);
  voxSphere(v, 0, 0, 0, 1.8, () => rng.pick(['#3a2f2f', '#2a2222', '#ff5a1f', '#ff9a3d']), { step: 0.7, noise: 0.8, rng });
  return v.mesh(MAT.glow);
}

export function makeRing(r) {
  const v = new Vox(1);
  voxRing(v, r, 1.1, Math.round(r * 5), (i) => (i % 2 ? '#ffc83d' : '#7fe3ff'), 'z');
  const m = v.mesh(MAT.glow, { cast: false });
  return m;
}

export function makeGeyser() {
  const g = new THREE.Group();
  const v = new Vox(1);
  voxRing(v, 3.6, 1.2, 16, (i) => (i % 2 ? '#4a4040' : '#5e5252'), 'y', 0.5);
  v.box(0, 0.1, 0, 4, 0.2, 4, '#2a1c1c');
  g.add(v.mesh());
  const c = new Vox(1);
  for (let y = 0; y < 30; y += 1.5) {
    const w = 2.2 + Math.sin(y) * 0.6 + y * 0.05;
    c.box(Math.sin(y * 1.7) * 0.4, y + 0.75, Math.cos(y * 1.3) * 0.4, w, 1.5, w, y % 3 ? '#e8fbff' : '#bdefff');
  }
  const col = c.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }), { cast: false });
  col.scale.y = 0.01;
  g.add(col);
  g.userData.column = col;
  return g;
}

// ---------- pickups ----------

export function makeCoin() {
  const v = new Vox(0.3);
  for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) {
    const d = Math.hypot(x, y);
    if (d > 4.3) continue;
    v.box(x, y, 0, 1, 1, d > 3.2 ? 1.4 : 1, d > 3.2 ? '#e09a00' : '#ffd23d');
  }
  v.box(0, 0, 0, 1, 5, 1.6, '#e09a00').box(0, 1.5, 0, 3, 1, 1.6, '#e09a00').box(0, -1.5, 0, 3, 1, 1.6, '#e09a00');
  return v.mesh(MAT.glow, { cast: false });
}

let crateMaterial;
export function makeCrate() {
  if (!crateMaterial) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#c47a2c'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#9c5a1c'; x.fillRect(0, 0, 64, 6); x.fillRect(0, 58, 64, 6); x.fillRect(0, 0, 6, 64); x.fillRect(58, 0, 6, 64);
    x.fillStyle = '#ffd23d';
    const px = [[2, 0], [3, 0], [4, 0], [1, 1], [5, 1], [5, 2], [4, 3], [3, 4], [3, 6]];
    for (const [a, b] of px) x.fillRect(14 + a * 6, 12 + b * 6, 6, 6);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    crateMaterial = new THREE.MeshLambertMaterial({ map: tex, emissive: '#3a2400', emissiveIntensity: 0.4 });
  }
  const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.6), crateMaterial);
  m.castShadow = true;
  m.userData.keepMaterial = true; // cached and reused across levels
  return m;
}

// ---------- scenery ----------

export function makeTree(kind, rng, scale = 1) {
  const v = new Vox(scale);
  const h = rng.range(5, 8);
  const trunk = kind === 'dead' ? '#2b2424' : '#7a4e2a';
  v.box(0, h / 2, 0, 1.2, h, 1.2, trunk);
  if (kind === 'pine') {
    for (let i = 0; i < 4; i++) v.box(0, h - 1 + i * 2.2, 0, 7 - i * 1.6, 2.4, 7 - i * 1.6, i % 2 ? '#2f7a3a' : '#3a8c45');
  } else if (kind === 'dead') {
    v.box(1.4, h * 0.7, 0, 2.6, 0.6, 0.6, trunk).box(-1.2, h * 0.85, 0.4, 0.6, 2.4, 0.6, trunk);
  } else if (kind === 'palm') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      v.box(Math.cos(a) * 2, h + 0.2, Math.sin(a) * 2, Math.abs(Math.cos(a)) * 3 + 1, 0.5, Math.abs(Math.sin(a)) * 3 + 1, '#3fa34d');
    }
  } else {
    const cols = kind === 'autumn' ? ['#ff8a3d', '#ffb340', '#e2552e', '#ffd23d'] : kind === 'blossom' ? ['#ffb3c7', '#ff8fb1', '#ffd1dc'] : ['#3fa34d', '#4cb85a', '#2f8a3f', '#56c766'];
    const n = rng.int(4, 7);
    for (let i = 0; i < n; i++) {
      const s = rng.range(3, 5);
      v.box(rng.range(-2, 2), h + rng.range(-0.5, 3), rng.range(-2, 2), s, s * 0.85, s, rng.pick(cols));
    }
  }
  return v;
}

export function makeCloud(rng, color = '#ffffff') {
  const v = new Vox(1);
  const n = rng.int(3, 6);
  for (let i = 0; i < n; i++) {
    const w = rng.range(10, 24);
    v.box(rng.range(-14, 14), rng.range(-2, 3), rng.range(-6, 6), w, rng.range(4, 8), w * 0.7, color, false);
  }
  return v.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: color, emissiveIntensity: 0.35 }), { cast: false });
}

export function makeMountain(v, x, z, w, h, cols, snow) {
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const s = w * (1 - i / steps);
    const c = snow && i >= steps - 2 ? snow : cols[i % cols.length];
    v.box(x, (h / steps) * (i + 0.5), z, s, h / steps, s * 0.8, c, false);
  }
}

export function makeSpectator(rng) {
  const v = new Vox(0.1);
  const shirt = rng.pick(['#ff4f6d', '#2f8cff', '#ffc83d', '#4cc24a', '#9b6bff', '#ffffff', '#ff9a3d']);
  const skin = rng.pick(['#f2c29a', '#d99a6c', '#8d5a3b', '#f5cfb2', '#b97a50']);
  v.box(0, 3.5, -1.1, 1.6, 7, 1.6, '#2b2f4a').box(0, 3.5, 1.1, 1.6, 7, 1.6, '#2b2f4a');
  v.box(0, 10, 0, 2.4, 6, 5, shirt);
  v.box(0, 14.8, 0, 3.8, 3.8, 3.8, skin);
  v.box(0, 16.9, 0, 4, 0.8, 4, rng.pick(['#3b2414', '#1b1b1b', '#d9a441', '#ffffff', '#ff4f6d']));
  v.box(0, 11, 2.9, 1.2, 5, 1.2, shirt).box(0, 11, -2.9, 1.2, 5, 1.2, shirt);
  return v.mesh();
}

export function textSprite(text, { color = '#1b2340', bg = '#fff8ec', w = 256, h = 128, font = 'Bungee', size = 64, border = '#1b2340' } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = border; x.fillRect(0, 0, w, h);
  x.fillStyle = bg; x.fillRect(8, 8, w - 16, h - 16);
  x.fillStyle = color;
  x.font = `${size}px ${font}, Impact, sans-serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeSign(text, opts = {}) {
  const g = new THREE.Group();
  const v = new Vox(1);
  const w = opts.width || 5, h = opts.height || 2.5, post = opts.post ?? 3;
  v.box(-w / 3, post / 2, -0.15, 0.3, post, 0.3, '#5a3a22').box(w / 3, post / 2, -0.15, 0.3, post, 0.3, '#5a3a22');
  g.add(v.mesh());
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: textSprite(text, opts) }),
  );
  board.position.y = post + h / 2;
  g.add(board);
  return g;
}
