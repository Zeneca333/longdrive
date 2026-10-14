// The 3D stage: renderer, sky and lighting per theme, the fairway, scenery, hazard visuals and the camera.
import * as THREE from './three.js';
import { Vox, MAT, voxSphere, voxRing } from './vox.js';
import * as M from './models.js';
import { Particles, Trail } from './fx.js';
import { makeRng } from './rng.js';

export const THEMES = {
  range: {
    sky: ['#3e9fff', '#d4f0ff'], fog: '#d4f0ff', fairway: ['#72d150', '#66c548'], rough: '#4aa63e',
    hemi: ['#ffffff', '#5a8a3a', 2.1], sun: ['#fff1d6', 2.6], tree: 'oak', cloud: '#ffffff',
    mountains: [['#79b4e3', '#8cc2ea', '#6aa7d8'], '#ffffff'], tufts: ['#3f9637', '#5bb84a', '#ffffff', '#ffd23d'],
  },
  links: {
    sky: ['#7ea2c0', '#e6eef2'], fog: '#e1e9ed', fairway: ['#a3d06e', '#93c461'], rough: '#7c9a55',
    hemi: ['#f2f6ff', '#6b7f4e', 2.0], sun: ['#fff8ec', 2.0], tree: 'pine', cloud: '#eef2f5',
    mountains: [['#7d8f9e', '#8a9aa8'], null], tufts: ['#c8c06a', '#6c8a48', '#e8d98a', '#9aa3b5'],
  },
  autumn: {
    sky: ['#58a8f0', '#ffe4c2'], fog: '#ffe4c2', fairway: ['#7acb52', '#6dbf48'], rough: '#5b9a3d',
    hemi: ['#fff6e8', '#6a6a30', 2.1], sun: ['#ffe2b0', 2.6], tree: 'autumn', cloud: '#fff6ee',
    mountains: [['#b88a6a', '#a77a5c', '#c99a78'], null], tufts: ['#ff8a3d', '#e2552e', '#ffd23d', '#6a9a3d'],
  },
  tulips: {
    sky: ['#4fb6ff', '#e6f8ff'], fog: '#e6f8ff', fairway: ['#7ad957', '#6ccc4b'], rough: '#55b047',
    hemi: ['#ffffff', '#5a9a3a', 2.2], sun: ['#fff4dc', 2.6], tree: 'blossom', cloud: '#ffffff',
    mountains: null, tufts: ['#ff4f6d', '#ffc83d', '#ff8fb1', '#9b6bff'],
  },
  construction: {
    sky: ['#86b3d9', '#f5e2c4'], fog: '#efdcc0', fairway: ['#74c94f', '#68bd46'], rough: '#b98a5c',
    hemi: ['#fff5e6', '#8a6a4a', 2.1], sun: ['#ffe9c4', 2.6], tree: null, cloud: '#fff8ec',
    mountains: [['#c79a72', '#b8875a'], null], tufts: ['#9c6b42', '#ff9a3d', '#d4a373', '#6b7280'],
  },
  volcano: {
    sky: ['#2a0d18', '#ff7438'], fog: '#8a3424', fairway: ['#5fae40', '#55a238'], rough: '#3b3540',
    hemi: ['#ffb08a', '#3a1d1d', 1.8], sun: ['#ff9a5a', 2.4], tree: 'dead', cloud: '#5a4a4a',
    mountains: [['#2e2730', '#3b3540', '#463d48'], null], tufts: ['#2a2428', '#ff5a1f', '#4a4048', '#5e5252'],
  },
  storm: {
    sky: ['#38463f', '#b0bb9f'], fog: '#a4ae94', fairway: ['#6db04c', '#62a444'], rough: '#d9b553',
    hemi: ['#d8e2d0', '#6b5a2a', 1.8], sun: ['#e8eedd', 1.7], tree: 'oak', cloud: '#5a6660',
    mountains: null, tufts: ['#c99a2e', '#e8c15a', '#b08a2a', '#f0d27a'],
  },
  night: {
    sky: ['#03061a', '#1d2a5c'], fog: '#111a3c', fairway: ['#2f7d42', '#29713b'], rough: '#1d4a2a',
    hemi: ['#7d8cff', '#0b1a20', 1.2], sun: ['#b8c4ff', 1.2], tree: 'pine', cloud: '#2a3566',
    mountains: [['#151d3d', '#1b2550'], null], tufts: ['#2f6b2a', '#3d8a35', '#7dff9a', '#1d4a2a'], stars: true,
  },
  moon: {
    sky: ['#000000', '#0b0e1c'], fog: '#04050a', fairway: ['#3cb04a', '#34a142'], rough: '#8a8c93',
    hemi: ['#e8ecff', '#3a3a40', 1.5], sun: ['#ffffff', 3.0], tree: null, cloud: null,
    mountains: [['#6d6f76', '#7d7f86', '#5d5f66'], null], tufts: ['#6d6f76', '#a3a5ab', '#5d5f66', '#b5b7bd'], stars: true,
  },
};

const BALL_LIFT = 0.19;
const SHARED = new Set(Object.values(MAT));

export class Stage {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 5000);
    this.camera.position.set(3, 3, 8);

    this.hemi = new THREE.HemisphereLight('#ffffff', '#446644', 2);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -45; sc.right = sc.top = 45; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.sky = this.makeSky();
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog('#ffffff', 250, 1500);

    this.particles = new Particles(this.scene);
    this.trail = new Trail(this.scene);

    this.ball = M.makeBall();
    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 12),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.ball, this.ballShadow);

    this.aim = this.makeAimArrow();
    this.scene.add(this.aim);
    this.scope = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), new THREE.MeshBasicMaterial({ color: '#ff2f5a' }), 400);
    this.scope.count = 0;
    this.scope.frustumCulled = false;
    this.scene.add(this.scope);

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.golfer = null;
    this.focus = new THREE.Vector3();
    this.camLook = new THREE.Vector3(0, 1, -30);
    this.camOffset = new THREE.Vector3(0, 6, 16);
    this.shake = 0;
    this.flash = 0;
    this.theme = THEMES.range;
    this.t = 0;
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 70 : 55;
    this.camera.updateProjectionMatrix();
  }

  makeSky() {
    const g = new THREE.SphereGeometry(3000, 24, 16);
    const colors = new Float32Array(g.attributes.position.count * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    m.renderOrder = -1;
    return m;
  }

  paintSky([top, bottom]) {
    const g = this.sky.geometry;
    const pos = g.attributes.position, col = g.attributes.color;
    const a = new THREE.Color(top), b = new THREE.Color(bottom), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, Math.min(1, pos.getY(i) / 3000));
      c.copy(b).lerp(a, Math.pow(t, 0.6));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  setTheme(id) {
    const T = THEMES[id] || THEMES.range;
    this.theme = T;
    this.themeId = id;
    this.paintSky(T.sky);
    this.scene.fog.color.set(T.fog);
    this.scene.fog.near = id === 'moon' ? 600 : 260;
    this.scene.fog.far = id === 'moon' ? 3000 : 1600;
    this.hemi.color.set(T.hemi[0]); this.hemi.groundColor.set(T.hemi[1]); this.hemi.intensity = T.hemi[2];
    this.sun.color.set(T.sun[0]); this.sun.intensity = T.sun[1];
    this.baseHemi = T.hemi[2];
    const night = id === 'night';
    this.ball.material.emissiveIntensity = night ? 0.9 : 0.25;
  }

  setGolfer(id) {
    if (this.golfer) this.scene.remove(this.golfer.root);
    this.golfer = M.makeGolfer(id);
    this.scene.add(this.golfer.root);
  }

  // ---------- level building ----------

  buildLevel(course) {
    const level = course.level;
    this.clearWorld();
    this.setTheme(level.theme);
    this.course = course;
    const T = this.theme;
    const W = this.world;
    const rng = makeRng(level.id * 31);
    const gh = course.gridHalf;
    const len = course.length;

    // Ground and the striped grid.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: T.rough }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    W.add(ground);

    const fw = new Vox(1);
    const tile = 8;
    const cols = Math.ceil((gh * 2) / tile);
    for (let z = 10; z > -len; z -= 10) {
      const stripe = Math.round(z / 10) % 2 === 0;
      for (let i = 0; i < cols; i++) {
        const x0 = -gh + i * tile;
        const w = Math.min(tile, gh - x0);
        const c = stripe ? T.fairway[0] : T.fairway[1];
        fw.box(x0 + w / 2, 0.02, z - 5, w, 0.04, 10, i % 2 ? shade(c, 0.97) : c, false);
      }
    }
    for (const s of [-1, 1]) fw.box(s * (gh + 0.2), 0.05, -len / 2 + 5, 0.4, 0.06, len + 10, '#ffffff', false);
    W.add(fw.mesh(MAT.vox, { cast: false, receive: true }));

    // OB stakes, yardage signs and the target lines.
    const stakes = new Vox(1);
    for (let d = 25; d < len; d += 25) {
      for (const s of [-1, 1]) {
        stakes.box(s * (gh + 0.8), 0.6, -d, 0.25, 1.2, 0.25, '#ffffff');
        stakes.box(s * (gh + 0.8), 1.1, -d, 0.27, 0.2, 0.27, '#1b2340');
      }
    }
    W.add(stakes.mesh());
    for (let d = 50; d < len; d += 50) {
      const sign = M.makeSign(`${d}`, { width: 4.4, height: 2.2, post: 2.2, size: 72 });
      sign.position.set(-(gh + 5), 0, -d);
      W.add(sign);
      if (d % 100 === 0) {
        const s2 = M.makeSign(`${d}`, { width: 4.4, height: 2.2, post: 2.2, size: 72 });
        s2.position.set(gh + 5, 0, -d);
        W.add(s2);
      }
    }
    const [t1, t2, t3] = level.stars;
    const lines = new Vox(1);
    for (let x = -gh; x < gh; x += 2) {
      lines.box(x + 1, 0.06, -t1, 2, 0.06, 1, Math.round(x / 2) % 2 ? '#ffc83d' : '#1b2340', false);
      lines.box(x + 1, 0.06, -t2, 2, 0.05, 0.5, Math.round(x / 2) % 2 ? '#ffffff' : '#c9ced6', false);
      lines.box(x + 1, 0.06, -t3, 2, 0.05, 0.5, Math.round(x / 2) % 2 ? '#ff4f6d' : '#ffc83d', false);
    }
    W.add(lines.mesh(MAT.glow, { cast: false }));
    for (const s of [-1, 1]) {
      const f = M.makeFlag('#ffc83d', 10);
      f.position.set(s * (gh + 1.5), 0, -t1);
      W.add(f);
      this.flags.push(f);
    }
    const tsign = M.makeSign(`TARGET ${t1}`, { width: 9, height: 2.6, post: 7, w: 512, h: 128, size: 64, bg: '#ffc83d' });
    tsign.position.set(gh + 7, 0, -t1);
    W.add(tsign);

    // Tee box, spectators and the golfer's patch.
    W.add(M.makeTeeBox(level.theme));
    for (let i = 0; i < 26; i++) {
      const s = M.makeSpectator(rng);
      const side = i % 2 ? 1 : -1;
      const row = Math.floor(i / 2) % 3;
      s.position.set(side * (7 + row * 1.6 + rng.range(0, 0.6)), 0, 2 + (Math.floor(i / 6)) * 2.2 + rng.range(-0.4, 0.4));
      s.rotation.y = side > 0 ? Math.PI * 0.75 : Math.PI * 0.25;
      s.userData.phase = rng.range(0, 6);
      W.add(s);
      this.spectators.push(s);
    }

    this.buildScenery(level, rng, gh, len);
    this.buildRegions(course);
    this.buildEntities(course);
    this.buildTriggers(course);
  }

  clearWorld() {
    for (const o of [...this.world.children]) {
      this.world.remove(o);
      o.traverse((c) => {
        if (!c.isMesh && !c.isPoints) return;
        c.geometry?.dispose();
        if (c.material && !SHARED.has(c.material) && !c.userData.keepMaterial) {
          c.material.map?.dispose();
          c.material.dispose();
        }
      });
    }
    this.flags = [];
    this.spectators = [];
    this.entityViews = [];
    this.triggerViews = new Map();
    this.lavaMats = [];
    this.markers = [];
    this.particles.clear();
    this.trail.clear();
  }

  buildScenery(level, rng, gh, len) {
    const T = this.theme;
    const W = this.world;
    const id = level.theme;

    // Ground texture: tufts, flowers and pebbles scattered in the rough.
    const tufts = new Vox(1);
    for (let i = 0; i < 900; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const x = side * (gh + 2 + Math.pow(rng(), 1.6) * 160);
      const z = rng.range(-len - 100, 40);
      const s = rng.range(0.4, 1.2);
      tufts.box(x, s / 2, z, s, s * rng.range(0.6, 1.4), s, rng.pick(T.tufts));
    }
    W.add(tufts.mesh(MAT.vox, { cast: false, receive: true }));

    // Trees lining the rough.
    if (T.tree) {
      const trees = new Vox(1);
      const n = id === 'storm' ? 30 : 110;
      for (let i = 0; i < n; i++) {
        const side = rng() < 0.5 ? -1 : 1;
        const x = side * (gh + rng.range(14, 140));
        const z = rng.range(-len - 60, 30);
        const t = M.makeTree(T.tree, rng);
        mergeInto(trees, t, x, 0, z);
        if (Math.abs(x) < gh + 24 && z < -40) {
          // Trees close to the grid can be hit.
          const col = { kind: 'tree', a: { x, y: 5.5, z }, b: { x, y: 9, z }, r: 2.6, e: 0.2, damp: 0.3, v: { x: 0, y: 0, z: 0 } };
          this.course.env.colliders.push(col);
        }
      }
      W.add(trees.mesh());
    }

    // Distant mountains.
    if (T.mountains) {
      const mv = new Vox(1);
      for (let i = 0; i < 14; i++) {
        const x = rng.range(-1400, 1400);
        const z = -len - rng.range(300, 1200);
        makeMountainSafe(mv, x, z, rng.range(160, 420), rng.range(70, 220), T.mountains[0], T.mountains[1]);
      }
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1;
        makeMountainSafe(mv, side * rng.range(500, 1100), rng.range(-len, 0), rng.range(160, 360), rng.range(60, 160), T.mountains[0], T.mountains[1]);
      }
      W.add(mv.mesh(MAT.vox, { cast: false }));
    }

    // Clouds.
    if (T.cloud) {
      for (let i = 0; i < 22; i++) {
        const c = M.makeCloud(rng, T.cloud);
        c.position.set(rng.range(-700, 700), rng.range(90, 220), rng.range(-len - 600, 200));
        c.userData.drift = rng.range(1, 4);
        c.userData.cloud = true;
        W.add(c);
      }
    }

    if (T.stars) {
      const n = 900;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, e = Math.acos(rng() * 0.95);
        pos.set([Math.cos(a) * Math.sin(e) * 2500, Math.cos(e) * 2500, Math.sin(a) * Math.sin(e) * 2500], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      W.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 3.5, sizeAttenuation: false, fog: false })));
    }

    const v = new Vox(1);
    const glow = new Vox(1);
    if (id === 'range') {
      buildClubhouse(v, -26, 40);
      for (const [d, x, c] of [[100, -14, '#ff4f6d'], [150, 16, '#ffc83d'], [200, -6, '#2f8cff'], [300, 10, '#9b6bff']]) {
        for (let a = 0; a < 6.3; a += 0.25) for (let r = 0; r < 6; r += 1.2) v.box(x + Math.cos(a) * r, 0.05, -d + Math.sin(a) * r, 1.3, 0.05, 1.3, '#4fbf45', false);
        const f = M.makeFlag(c, 4);
        f.position.set(x, 0, -d);
        W.add(f);
      }
      for (let x = -gh - 20; x < gh + 20; x += 3) v.box(x, 9, -len + 20, 0.2, 18, 0.2, '#6b7280'); // back net poles
      const net = new THREE.Mesh(new THREE.PlaneGeometry(gh * 2 + 40, 18), new THREE.MeshBasicMaterial({ color: '#1b2340', transparent: true, opacity: 0.18 }));
      net.position.set(0, 9, -len + 20);
      W.add(net);
    }
    if (id === 'links') {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000, 4000), new THREE.MeshLambertMaterial({ color: '#2f6f9a' }));
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(gh + 70 + 1000, -6, -800);
      W.add(sea);
      for (let z = 60; z > -len - 200; z -= 6) {
        const edge = gh + 62 + Math.sin(z * 0.05) * 6;
        v.box(edge, -3, z, 8, 8, 6, z % 12 ? '#9c8c6c' : '#8a7a5c');
        if (rng() < 0.3) v.box(edge - 4, 0.6, z, rng.range(2, 4), 1.2, rng.range(2, 5), '#c8c06a');
      }
      buildLighthouse(v, gh + 58, -len * 0.6);
      for (let i = 0; i < 40; i++) v.box(-(gh + rng.range(6, 40)), rng.range(0.5, 2), rng.range(-len, 0), rng.range(4, 10), rng.range(1, 4), rng.range(4, 10), '#e8d98a');
    }
    if (id === 'autumn') {
      for (const r of this.course.env.regions.filter((q) => q.type === 'water')) {
        for (let x = -gh - 30; x < gh + 30; x += 2.5) {
          for (const s of [-1, 1]) if (rng() < 0.6) v.box(x + rng.range(-1, 1), 1.2, r.z + s * (r.hd + 0.6), 0.3, rng.range(1.5, 2.6), 0.3, '#5a7a2a');
          if (rng() < 0.25) v.box(x, 2.4, r.z + (rng() < 0.5 ? -1 : 1) * (r.hd + 0.6), 0.5, 0.9, 0.5, '#7a4e2a');
        }
      }
      buildBarn(v, -gh - 70, -len * 0.5, '#b8322e');
    }
    if (id === 'tulips') {
      const colors = ['#ff4f6d', '#ffc83d', '#ff8fb1', '#9b6bff', '#ffffff', '#ff9a3d'];
      for (const s of [-1, 1]) {
        for (let row = 0; row < 14; row++) {
          const x = s * (gh + 8 + row * 4);
          const c = colors[(row + (s > 0 ? 3 : 0)) % colors.length];
          for (let z = 20; z > -len; z -= 1.5) v.box(x, 0.5, z, 2.4, 1, 1.2, c, false);
        }
      }
      for (let i = 0; i < 5; i++) {
        const wm = M.makeWindmill(16, 12);
        wm.position.set((i % 2 ? 1 : -1) * rng.range(90, 160), 0, -rng.range(60, len));
        wm.userData.decorSpin = rng.range(0.4, 0.9);
        W.add(wm);
        this.entityViews.push({ ent: null, obj: wm, kind: 'decorMill' });
      }
    }
    if (id === 'construction') {
      for (let d = 20; d < len; d += 12) for (const s of [-1, 1]) {
        v.box(s * (gh + 2.5), 0.5, -d, 0.8, 1, 0.8, '#ff7a1a').box(s * (gh + 2.5), 1.05, -d, 0.4, 0.3, 0.4, '#ffffff');
      }
      for (let i = 0; i < 6; i++) buildGirders(v, (i % 2 ? 1 : -1) * rng.range(gh + 40, gh + 110), -rng.range(40, len), rng);
      v.box(-(gh + 10), 1.6, -30, 1.8, 3.2, 1.8, '#2f8cff').box(-(gh + 10), 3.3, -30, 2, 0.3, 2, '#1b2340'); // porta-potty
      for (let i = 0; i < 10; i++) v.box((i % 2 ? 1 : -1) * rng.range(gh + 12, gh + 70), rng.range(1, 4), -rng.range(20, len), rng.range(6, 14), rng.range(2, 8), rng.range(6, 14), '#a8794c');
    }
    if (id === 'volcano') {
      buildVolcano(v, glow, 260, -len - 380);
      for (let i = 0; i < 30; i++) v.box((i % 2 ? 1 : -1) * rng.range(gh + 8, gh + 140), rng.range(1, 3), -rng.range(0, len), rng.range(3, 9), rng.range(2, 6), rng.range(3, 9), '#2e2730');
      for (let i = 0; i < 8; i++) glow.box((i % 2 ? 1 : -1) * rng.range(gh + 20, gh + 120), 0.05, -rng.range(30, len), rng.range(6, 16), 0.1, rng.range(6, 16), '#ff6a20', false);
    }
    if (id === 'storm') {
      for (const s of [-1, 1]) for (let i = 0; i < 1400; i++) {
        const x = s * (gh + 3 + rng() * 140);
        v.box(x, 0.7, rng.range(-len - 50, 30), 0.5, rng.range(1, 1.8), 0.5, rng.pick(['#e8c15a', '#d9b553', '#c99a2e']), false);
      }
      buildBarn(v, -gh - 50, -len * 0.35, '#a8322e');
      buildSilo(v, -gh - 64, -len * 0.35 + 14);
    }
    if (id === 'night') {
      for (const s of [-1, 1]) for (let row = 0; row < 18; row++) {
        const x = s * (gh + 6 + row * 3);
        for (let z = 20; z > -len - 40; z -= 2) v.box(x, 1.4, z, 1, rng.range(2, 3), 1, row % 2 ? '#2f5a26' : '#3b6e2e', false);
      }
      for (const [cx, cz] of [[-gh - 30, -260], [gh + 40, -420]]) {
        for (const r of [6, 12, 18]) for (let a = 0; a < Math.PI * 2; a += 0.12) v.box(cx + Math.cos(a) * r, 2.6, cz + Math.sin(a) * r, 1.4, 0.4, 1.4, '#1a3a16', false);
      }
      buildFarmhouse(v, glow, gh + 34, -60);
      voxSphere(glow, -500, 600, -1800, 40, () => '#fff6d5', { step: 8 });
    }
    if (id === 'moon') {
      for (let i = 0; i < 40; i++) {
        const cx = (i % 2 ? 1 : -1) * rng.range(gh + 10, gh + 260), cz = -rng.range(0, len), r = rng.range(5, 18);
        const ring = new Vox(1);
        voxRing(ring, r, 1.6, Math.round(r * 3), () => (rng() < 0.5 ? '#7a7c83' : '#9a9ca3'), 'y', 0.5);
        mergeInto(v, ring, cx, 0, cz);
      }
      buildLander(v, -gh - 30, -120);
      const earth = new Vox(1);
      voxSphere(earth, 0, 0, 0, 22, (x, y, z) => (Math.sin(x * 0.3) + Math.cos(z * 0.25 + y * 0.2) > 0.6 ? '#4cc24a' : y > 17 ? '#ffffff' : '#2f6fff'), { step: 3 });
      const e = earth.mesh(MAT.glow, { cast: false });
      e.position.set(-600, 520, -2200);
      e.material = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
      W.add(e);
    }
    W.add(v.mesh(MAT.vox, { cast: true, receive: true }));
    if (glow.pos.length) {
      const g = glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }), { cast: false });
      W.add(g);
    }
  }

  buildRegions(course) {
    const W = this.world;
    const gh = course.gridHalf;
    for (const r of course.env.regions) {
      if (r.type === 'bunker') {
        const v = new Vox(1);
        const col = r.skin === 'cement' ? ['#a3a7ad', '#b4b8be'] : r.skin === 'crater' ? ['#55575d', '#62646a'] : ['#f2dfa0', '#e8d28c'];
        for (let x = -r.r; x <= r.r; x += 1) for (let z = -r.r; z <= r.r; z += 1) {
          if (Math.hypot(x, z) <= r.r) v.box(r.x + x, 0.06, r.z + z, 1.02, 0.06, 1.02, (x + z) % 2 ? col[0] : col[1], false);
        }
        const m = v.mesh(MAT.vox, { cast: false, receive: true });
        W.add(m);
        if (r.skin === 'crater') {
          const rim = voxRing(new Vox(1), r.r + 0.6, 1, Math.round(r.r * 6), () => '#7a7c83', 'y', 0.4).mesh();
          rim.position.set(r.x, 0, r.z);
          W.add(rim);
        }
      } else if (r.type === 'trampoline') {
        const m = M.makeTrampoline(r.r, r.skin);
        m.position.set(r.x, 0, r.z);
        W.add(m);
      } else if (r.type === 'water' || r.type === 'lava') {
        const lava = r.type === 'lava';
        const mat = lava
          ? new THREE.MeshBasicMaterial({ color: '#ff5a1f' })
          : new THREE.MeshLambertMaterial({ color: '#2f8fd6', emissive: '#0a3a66', emissiveIntensity: 0.5 });
        const w = gh * 2 + 70;
        const plane = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, r.hd * 2), mat);
        plane.position.set(0, 0.04, r.z);
        plane.receiveShadow = !lava;
        W.add(plane);
        const deco = new Vox(1);
        const rng = makeRng(Math.round(-r.z));
        for (let i = 0; i < w * 0.6; i++) {
          const x = rng.range(-w / 2, w / 2), z = r.z + rng.range(-r.hd + 1, r.hd - 1);
          if (lava) deco.box(x, 0.12, z, rng.range(1, 3), 0.1, rng.range(1, 3), rng.pick(['#3a2222', '#2a1a1a', '#ffb340']));
          else deco.box(x, 0.1, z, rng.range(0.8, 1.8), 0.05, rng.range(0.8, 1.8), rng.pick(['#4cc24a', '#7fd0ff', '#a8e4ff']));
        }
        for (let x = -w / 2; x < w / 2; x += 2) {
          for (const s of [-1, 1]) deco.box(x + 1, 0.15, r.z + s * (r.hd + 0.4), 2, 0.3, 0.8, lava ? '#2e2730' : '#7a6a4a');
        }
        W.add(deco.mesh(lava ? MAT.glow : MAT.vox, { cast: false }));
        if (lava) this.lavaMats.push(mat);
        const warn = M.makeSign(lava ? 'LAVA' : 'POND', { width: 4.2, height: 1.8, post: 1.6, size: 60, bg: lava ? '#ff9a3d' : '#9fd8ff' });
        warn.position.set(-(gh + 4), 0, r.z + r.hd + 2);
        W.add(warn);
      }
    }
  }

  buildEntities(course) {
    const W = this.world;
    for (const e of course.entities) {
      let obj = null;
      switch (e.kind) {
        case 'sheep': obj = M.makeSheep(); break;
        case 'cow': obj = M.makeCow(); break;
        case 'cart': obj = M.makeCart(); break;
        case 'goose': obj = M.makeGoose(); break;
        case 'windmill': obj = M.makeWindmill(e.hub, e.blade); break;
        case 'wreck': obj = M.makeCrane(e.x, e.pivot, e.len); break;
        case 'geyser': obj = M.makeGeyser(); break;
        case 'bomb': obj = M.makeBomb(); break;
        case 'asteroid': obj = M.makeAsteroid(e.size, e.seed); break;
        case 'ring': obj = M.makeRing(e.r); break;
        case 'ufo': obj = M.makeUfo(e.r, e.y); break;
        case 'tornado': {
          obj = M.makeTornado();
          e.cowViews = e.cows.map(() => { const c = M.makeCow(); W.add(c); return c; });
          break;
        }
      }
      if (obj) {
        W.add(obj);
        this.entityViews.push({ ent: e, obj, kind: e.kind });
      }
    }
  }

  buildTriggers(course) {
    for (const tr of course.env.triggers) {
      if (tr.kind !== 'coin' && tr.kind !== 'crate') continue;
      const m = tr.kind === 'coin' ? M.makeCoin() : M.makeCrate();
      m.position.set(tr.x, tr.y, tr.z);
      m.userData.phase = Math.random() * 6;
      this.world.add(m);
      this.triggerViews.set(tr.id, { tr, m });
    }
  }

  addMarker(x, z, color, label) {
    const f = M.makeFlag(color, 3.2);
    f.position.set(x, 0, z);
    this.world.add(f);
    this.markers.push(f);
    if (label) {
      const s = M.makeSign(label, { width: 2.6, height: 1.1, post: 3, size: 60, bg: color });
      s.position.set(x + 1.8, 0, z);
      this.world.add(s);
      this.markers.push(s);
    }
  }

  // ---------- per-frame ----------

  sync(t, dt, ballState) {
    this.t += dt;
    for (const ev of this.entityViews) {
      const e = ev.ent, o = ev.obj;
      switch (ev.kind) {
        case 'sheep':
        case 'cow':
          o.position.set(e.x, Math.abs(Math.sin(t * 3 + e.id)) * 0.08 * e.speed, e.z);
          o.rotation.y = -e.heading;
          break;
        case 'cart':
          o.position.set(e.x, 0, e.z);
          o.rotation.y = e.heading;
          break;
        case 'goose':
          o.position.set(e.x, e.y, e.z);
          o.rotation.y = e.dir > 0 ? 0 : Math.PI;
          for (const w of o.userData.wings) w.m.rotation.x = w.side * Math.sin(t * 9 + e.flap) * 0.7;
          break;
        case 'windmill':
          o.position.set(e.x, 0, e.z);
          o.userData.sails.rotation.z = e.angle;
          break;
        case 'decorMill':
          o.userData.sails.rotation.z = t * o.userData.decorSpin;
          break;
        case 'wreck':
          o.position.set(0, 0, e.z);
          o.userData.swing.rotation.z = e.theta;
          break;
        case 'geyser': {
          o.position.set(e.x, 0, e.z);
          const f = e.field;
          const ph = (t + f.phase) % f.period;
          const on = ph < f.on;
          const col = o.userData.column;
          const target = on ? 1 : 0.01;
          col.scale.y += (target - col.scale.y) * Math.min(1, dt * (on ? 10 : 3));
          col.position.y = Math.sin(t * 20) * 0.1;
          if (on && Math.random() < 0.6) this.particles.burst({ x: e.x, y: col.scale.y * 26, z: e.z }, { count: 2, colors: ['#ffffff', '#bdefff'], speed: 4, up: 6, size: 0.8, life: 1 });
          if (!on && ph > f.period - 0.8 && Math.random() < 0.3) this.particles.burst({ x: e.x, y: 0.4, z: e.z }, { count: 1, colors: ['#bdefff'], speed: 1.5, up: 3, size: 0.4, life: 0.6 });
          break;
        }
        case 'bomb':
          o.position.set(e.x, e.y, e.z);
          o.rotation.set(e.spin, e.spin * 0.7, 0);
          if (Math.random() < 0.4) this.particles.burst({ x: e.x, y: e.y, z: e.z }, { count: 1, colors: ['#ff5a1f', '#ffb340', '#3a3030'], speed: 1, up: 1, size: 0.6, life: 0.8, gravity: 0.2 });
          break;
        case 'asteroid':
          o.position.set(e.x, e.y, e.z);
          o.rotation.set(t * e.spin * 0.3, t * e.spin * 0.5, 0);
          break;
        case 'ring':
          o.position.set(e.x, e.y, e.z);
          o.rotation.z = t * 0.8;
          break;
        case 'ufo':
          o.position.set(e.x, e.y, e.z);
          o.userData.lights.rotation.y = t * 2;
          o.userData.beam.material.opacity = 0.14 + Math.sin(t * 6) * 0.05;
          break;
        case 'tornado':
          o.position.set(e.x, 0, e.z);
          o.userData.layers.forEach((l, i) => { l.rotation.y = t * (2.4 - i * 0.04); l.position.x = Math.sin(t * 1.3 + i * 0.3) * i * 0.18; });
          e.cows.forEach((c, i) => {
            const v = e.cowViews[i];
            v.position.set(c.col.a.x, c.col.a.y - 1.3, c.col.a.z);
            v.rotation.set(t * 1.3 + i, t * 2 + i, t * 0.7);
          });
          if (Math.random() < 0.5) this.particles.burst({ x: e.x + (Math.random() - 0.5) * 8, y: 0.3, z: e.z + (Math.random() - 0.5) * 8 }, { count: 1, colors: ['#8a8f96', '#d9b553', '#6b5a2a'], speed: 5, up: 8, size: 0.5, life: 1.2 });
          break;
      }
    }
    for (const { tr, m } of this.triggerViews.values()) {
      m.visible = !tr.taken;
      if (!m.visible) continue;
      m.rotation.y = t * 2.2 + m.userData.phase;
      m.position.y = tr.y + Math.sin(t * 2 + m.userData.phase) * 0.4;
    }
    for (const f of this.flags) f.userData.cloth.rotation.y = Math.sin(t * 3 + f.position.x) * 0.25;
    for (const m of this.markers) {
      if (m.userData.cloth) m.userData.cloth.rotation.y = Math.sin(t * 3) * 0.25;
      else m.rotation.y = Math.atan2(this.camera.position.x - m.position.x, this.camera.position.z - m.position.z);
    }
    for (const s of this.spectators) {
      const cheer = this.cheer > 0 ? Math.abs(Math.sin(t * 9 + s.userData.phase)) * 0.35 : Math.abs(Math.sin(t * 1.5 + s.userData.phase)) * 0.03;
      s.position.y = cheer;
    }
    if (this.cheer > 0) this.cheer -= dt;
    for (const mat of this.lavaMats) mat.color.setHSL(0.045 + Math.sin(t * 2) * 0.012, 1, 0.52 + Math.sin(t * 3.1) * 0.05);
    for (const o of this.world.children) if (o.userData.cloud) { o.position.x += o.userData.drift * dt; if (o.position.x > 800) o.position.x = -800; }
    if (this.themeId === 'storm' && Math.random() < dt * 0.12) this.flash = 1;
    if (this.flash > 0) {
      this.flash -= dt * 3;
      this.hemi.intensity = this.baseHemi + Math.max(0, this.flash) * 3;
    }

    // Ball and its blob shadow.
    if (ballState) {
      const p = ballState.p;
      this.ball.position.set(p.x, p.y + BALL_LIFT, p.z);
      this.ball.rotation.x -= dt * Math.hypot(ballState.v.x, ballState.v.z) * 2;
      this.ballShadow.position.set(p.x, 0.07, p.z);
      const h = Math.max(0, p.y);
      this.ballShadow.scale.setScalar(1 + h * 0.04);
      this.ballShadow.material.opacity = Math.max(0.08, 0.35 - h * 0.006);
      this.ball.visible = ballState.mode !== 'lost';
      this.ballShadow.visible = this.ball.visible;
    }
    this.particles.update(dt);
    this.trail.update(dt);
  }

  makeAimArrow() {
    const g = new THREE.Group();
    const v = new Vox(1);
    for (let i = 0; i < 9; i++) {
      const z = -4 - i * 4;
      v.box(-0.5, 0.08, z, 1.2, 0.06, 0.5, '#ffffff', false).box(0.5, 0.08, z, 1.2, 0.06, 0.5, '#ffffff', false);
      v.box(0, 0.08, z - 0.4, 0.6, 0.06, 0.6, '#ffffff', false);
    }
    const m = v.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75 }), { cast: false });
    g.add(m);
    return g;
  }

  setAim(deg, visible) {
    this.aim.visible = visible;
    this.aim.rotation.y = (-deg * Math.PI) / 180;
    this.aim.children[0].material.opacity = 0.45 + Math.sin(this.t * 4) * 0.25;
  }

  setScope(path) {
    if (!path) { this.scope.count = 0; return; }
    const d = new THREE.Object3D();
    let n = 0;
    for (let i = 0; i < path.length && n < 400; i += 1) {
      const p = path[i];
      const dist = Math.hypot(p.x, p.z);
      if (dist < 3) continue;
      d.position.set(p.x, p.y + BALL_LIFT, p.z);
      d.scale.setScalar(Math.min(1.3, 0.25 + dist * 0.008)); // small near the tee, readable far away
      d.updateMatrix();
      this.scope.setMatrixAt(n++, d.matrix);
    }
    this.scope.count = n;
    this.scope.instanceMatrix.needsUpdate = true;
  }

  // ---------- camera ----------

  cameraAddress(aimDeg, dt, snap = false) {
    const r = (aimDeg * Math.PI) / 180;
    const dir = new THREE.Vector3(Math.sin(r), 0, -Math.cos(r));
    const right = new THREE.Vector3(Math.cos(r), 0, Math.sin(r));
    const narrow = this.camera.aspect < 0.8;
    // Framed high so the golfer sits above the swing meter.
    const pos = dir.clone().multiplyScalar(narrow ? -9 : -7).add(right.clone().multiplyScalar(narrow ? 0.4 : 0.9)).add(new THREE.Vector3(0, narrow ? 3.6 : 3.1, 0));
    const look = dir.clone().multiplyScalar(40).add(new THREE.Vector3(0, narrow ? -6 : -4.5, 0));
    this.moveCamera(pos, look, snap ? 1 : 1 - Math.exp(-dt * 6));
    this.focus.set(0, 0, -10);
  }

  cameraFlyover(u, len) {
    const z = -len * (1 - u) * 0.95;
    const pos = new THREE.Vector3(Math.sin(u * 3) * 20, 34 - u * 22, z + 40);
    const look = new THREE.Vector3(0, 0, z - 60);
    this.moveCamera(pos, look, 1);
    this.focus.set(0, 0, z - 20);
  }

  cameraOrbit(center, t, radius = 12, height = 4.5) {
    const pos = new THREE.Vector3(center.x + Math.sin(t * 0.25) * radius, height, center.z + Math.cos(t * 0.25) * radius);
    this.moveCamera(pos, new THREE.Vector3(center.x, 1.2, center.z), 0.08);
    this.focus.copy(center);
  }

  cameraFollow(b, dt, landed) {
    const p = new THREE.Vector3(b.p.x, b.p.y + BALL_LIFT, b.p.z);
    const hv = new THREE.Vector3(b.v.x, 0, b.v.z);
    const sp = hv.length();
    if (sp > 1) hv.normalize(); else hv.set(0, 0, -1);
    // Behind the ball while it climbs, swinging out to the side as it lands and rolls.
    const side = landed ? 1 : Math.min(1, Math.max(0, -b.v.y / 25));
    const behind = hv.clone().multiplyScalar(-(landed ? 7 : 11 + Math.min(10, sp * 0.08)));
    const lateral = new THREE.Vector3(-hv.z, 0, hv.x).multiplyScalar(4 + side * 9);
    const desired = behind.add(lateral).add(new THREE.Vector3(0, landed ? 3.5 : 3 + side * 3, 0));
    this.camOffset.lerp(desired, 1 - Math.exp(-dt * (landed ? 1.5 : 2.5)));
    const pos = p.clone().add(this.camOffset);
    pos.y = Math.max(pos.y, 1.2);
    const look = p.clone().add(hv.clone().multiplyScalar(landed ? 1 : 5));
    this.moveCamera(pos, look, 1);
    this.focus.copy(p);
  }

  moveCamera(pos, look, k) {
    this.camera.position.lerp(pos, k);
    this.camLook.lerp(look, k);
    const shake = this.shake > 0 ? this.shake : 0;
    this.camera.lookAt(this.camLook.x + (Math.random() - 0.5) * shake, this.camLook.y + (Math.random() - 0.5) * shake, this.camLook.z);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.05);
  }

  render() {
    this.sky.position.copy(this.camera.position);
    const f = this.focus;
    this.sun.position.set(f.x + 60, f.y + 120, f.z + 40);
    this.sun.target.position.copy(f);
    this.renderer.render(this.scene, this.camera);
  }
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return '#' + c.getHexString();
}

// Copy a builder's boxes into another builder at an offset.
function mergeInto(dst, src, ox, oy, oz) {
  const base = dst.pos.length / 3;
  for (let i = 0; i < src.pos.length; i += 3) dst.pos.push(src.pos[i] + ox, src.pos[i + 1] + oy, src.pos[i + 2] + oz);
  dst.nor.push(...src.nor);
  dst.col.push(...src.col);
  for (const i of src.idx) dst.idx.push(i + base);
}

function makeMountainSafe(v, x, z, w, h, cols, snow) {
  M.makeMountain(v, x, z, w, h, cols, snow);
}

function buildClubhouse(v, x, z) {
  v.box(x, 4, z, 26, 8, 14, '#fff8ec');
  v.box(x, 8.6, z, 28, 1.2, 16, '#2f6b3a');
  v.box(x, 10, z, 22, 1.6, 12, '#2f6b3a');
  for (let i = -3; i <= 3; i++) v.box(x + i * 3.4, 4.5, z - 7.05, 2, 2.4, 0.2, '#9fd8ff');
  v.box(x, 2, z - 7.05, 3, 4, 0.2, '#7a4e2a');
}

function buildLighthouse(v, x, z) {
  for (let i = 0; i < 12; i++) v.box(x, i * 2 + 1, z, 5 - i * 0.15, 2, 5 - i * 0.15, i % 4 < 2 ? '#ffffff' : '#ff4f6d');
  v.box(x, 25.5, z, 4, 3, 4, '#ffd23d');
  v.box(x, 27.6, z, 4.6, 1.2, 4.6, '#1b2340');
}

function buildBarn(v, x, z, red) {
  v.box(x, 6, z, 16, 12, 20, red);
  for (let i = 0; i < 6; i++) v.box(x, 12.5 + i, z, 16 - i * 2.6, 1, 20.4, i % 2 ? '#3a2a2a' : '#4a3a3a');
  v.box(x + 8.05, 4, z, 0.2, 8, 8, '#ffffff');
  v.box(x + 8.1, 4, z, 0.2, 7, 7, red);
  v.box(x + 8.15, 4, z, 0.2, 0.6, 9, '#ffffff');
}

function buildSilo(v, x, z) {
  for (let i = 0; i < 12; i++) v.box(x, i * 2 + 1, z, 7, 2, 7, i % 2 ? '#c9ced6' : '#b4b8be');
  v.box(x, 25, z, 6, 2, 6, '#9aa3b5').box(x, 26.5, z, 3.6, 1.2, 3.6, '#9aa3b5');
}

function buildGirders(v, x, z, rng) {
  const floors = rng.int(3, 6);
  for (let f = 0; f <= floors; f++) {
    v.box(x, f * 5, z, 16, 0.6, 0.6, '#ff7a1a').box(x, f * 5, z + 12, 16, 0.6, 0.6, '#ff7a1a');
    v.box(x - 8, f * 5, z + 6, 0.6, 0.6, 12, '#ff7a1a').box(x + 8, f * 5, z + 6, 0.6, 0.6, 12, '#ff7a1a');
  }
  for (const dx of [-8, 0, 8]) for (const dz of [0, 12]) v.box(x + dx, (floors * 5) / 2, z + dz, 0.6, floors * 5, 0.6, '#e8661a');
}

function buildVolcano(v, glow, x, z) {
  for (let i = 0; i < 14; i++) {
    const w = 420 - i * 26;
    v.box(x, i * 16 + 8, z, w, 16, w * 0.8, i % 2 ? '#2e2730' : '#3b3540', false);
  }
  glow.box(x, 14 * 16 + 1, z, 60, 4, 48, '#ff6a20', false);
  for (let i = 0; i < 9; i++) glow.box(x + (i - 4) * 18, 160 - Math.abs(i - 4) * 30, z + 150, 6, 120 - Math.abs(i - 4) * 20, 4, '#ff5a1f', false);
}

function buildFarmhouse(v, glow, x, z) {
  v.box(x, 4, z, 14, 8, 12, '#d9cdb8');
  for (let i = 0; i < 5; i++) v.box(x, 8.5 + i, z, 14.4 - i * 2.8, 1, 12.4, '#4a2a2a');
  for (const dz of [-3, 3]) glow.box(x - 7.05, 4.5, z + dz, 0.2, 2.2, 2, '#ffd27a');
  v.box(x - 4, 14, z + 4, 1.4, 4, 1.4, '#6b3a3a');
  // Water tower.
  v.box(x + 20, 9, z - 20, 0.6, 18, 0.6, '#9aa3b5').box(x + 26, 9, z - 20, 0.6, 18, 0.6, '#9aa3b5');
  v.box(x + 23, 21, z - 20, 9, 6, 9, '#c9ced6');
  glow.box(x + 23, 21, z - 15.4, 7, 1.4, 0.2, '#7dff9a');
}

function buildLander(v, x, z) {
  v.box(x, 3.5, z, 5, 3, 5, '#ffd23d');
  v.box(x, 6.2, z, 3.6, 2.4, 3.6, '#c9ced6');
  for (const dx of [-3, 3]) for (const dz of [-3, 3]) v.box(x + dx, 1.4, z + dz, 0.4, 2.8, 0.4, '#9aa3b5');
  v.box(x + 6, 4, z, 0.2, 8, 0.2, '#ffffff').box(x + 7.4, 7.2, z, 2.6, 1.6, 0.1, '#ff4f6d');
}
