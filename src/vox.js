// Voxel geometry: lots of coloured boxes merged into one mesh with vertex colours.
import * as THREE from './three.js';

const colorCache = new Map();
export function rgb(hex) {
  let c = colorCache.get(hex);
  if (!c) {
    const col = new THREE.Color(hex);
    c = [col.r, col.g, col.b];
    colorCache.set(hex, c);
  }
  return c;
}

// Faces of a box from (x0,y0,z0) to (x1,y1,z1), counter-clockwise seen from outside.
const FACES = [
  { n: [1, 0, 0], v: (a, b) => [[b[0], a[1], b[2]], [b[0], a[1], a[2]], [b[0], b[1], a[2]], [b[0], b[1], b[2]]] },
  { n: [-1, 0, 0], v: (a, b) => [[a[0], a[1], a[2]], [a[0], a[1], b[2]], [a[0], b[1], b[2]], [a[0], b[1], a[2]]] },
  { n: [0, 1, 0], v: (a, b) => [[a[0], b[1], b[2]], [b[0], b[1], b[2]], [b[0], b[1], a[2]], [a[0], b[1], a[2]]] },
  { n: [0, -1, 0], v: (a, b) => [[a[0], a[1], a[2]], [b[0], a[1], a[2]], [b[0], a[1], b[2]], [a[0], a[1], b[2]]] },
  { n: [0, 0, 1], v: (a, b) => [[a[0], a[1], b[2]], [b[0], a[1], b[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]]] },
  { n: [0, 0, -1], v: (a, b) => [[b[0], a[1], a[2]], [a[0], a[1], a[2]], [a[0], b[1], a[2]], [b[0], b[1], a[2]]] },
];

export class Vox {
  constructor(scale = 1) {
    this.s = scale;
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.idx = [];
  }

  // Box by centre and size, in this builder's units.
  box(cx, cy, cz, sx, sy, sz, hex, shade = true) {
    const s = this.s;
    const a = [(cx - sx / 2) * s, (cy - sy / 2) * s, (cz - sz / 2) * s];
    const b = [(cx + sx / 2) * s, (cy + sy / 2) * s, (cz + sz / 2) * s];
    const [r, g, bl] = rgb(hex);
    for (const f of FACES) {
      const base = this.pos.length / 3;
      // A touch of baked shading keeps flat colours readable from any light angle.
      const k = !shade ? 1 : f.n[1] > 0 ? 1.06 : f.n[1] < 0 ? 0.7 : f.n[0] !== 0 ? 0.9 : 0.96;
      for (const p of f.v(a, b)) {
        this.pos.push(p[0], p[1], p[2]);
        this.nor.push(f.n[0], f.n[1], f.n[2]);
        this.col.push(r * k, g * k, bl * k);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return this;
  }

  // Box by its min corner, handy for grid-aligned voxel art.
  cube(x, y, z, hex, w = 1, h = 1, d = 1) {
    return this.box(x + w / 2, y + h / 2, z + d / 2, w, h, d, hex);
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }

  mesh(material = MAT.vox, { cast = true, receive = false } = {}) {
    const m = new THREE.Mesh(this.geometry(), material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  }
}

export const MAT = {
  vox: new THREE.MeshLambertMaterial({ vertexColors: true }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  glass: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.55 }),
};

// A sphere of voxels. `noise` roughens the surface (asteroids, rocks).
export function voxSphere(v, cx, cy, cz, radius, colorFn, { step = 1, noise = 0, rng = Math.random } = {}) {
  const r = Math.ceil(radius);
  for (let x = -r; x <= r; x += step) {
    for (let y = -r; y <= r; y += step) {
      for (let z = -r; z <= r; z += step) {
        const d = Math.hypot(x, y, z);
        const lim = radius + (noise ? (rng() - 0.5) * noise : 0);
        if (d > lim || d < radius - 2 * step) continue;
        v.box(cx + x, cy + y, cz + z, step, step, step, colorFn(x, y, z));
      }
    }
  }
  return v;
}

// A ring of voxels around the Z axis (boost rings) or Y axis (trampolines, craters).
export function voxRing(v, radius, thickness, segments, hex, axis = 'z', y = 0) {
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a) * radius, s = Math.sin(a) * radius;
    const color = typeof hex === 'function' ? hex(i) : hex;
    if (axis === 'z') v.box(c, s, 0, thickness, thickness, thickness, color);
    else v.box(c, y, s, thickness, thickness, thickness, color);
  }
  return v;
}
