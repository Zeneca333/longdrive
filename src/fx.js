// Voxel particles (dirt, splashes, feathers, sparkles) and the shot tracer trail.
import * as THREE from './three.js';

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

export class Particles {
  constructor(scene, max = 800) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#222222' }),
      max,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, tmpColor.set('#ffffff'));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.list = [];
  }

  burst(pos, { count = 12, colors = ['#ffffff'], speed = 6, up = 4, size = 0.3, life = 1.2, gravity = 1, drag = 0.5 } = {}) {
    for (let i = 0; i < count; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.list.push({
        x: pos.x, y: pos.y + 0.2, z: pos.z,
        vx: Math.cos(a) * s, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * s,
        life, age: 0, size: size * (0.6 + Math.random() * 0.8), gravity, drag,
        color: colors[Math.floor(Math.random() * colors.length)],
        rx: Math.random() * 6, ry: Math.random() * 6,
      });
    }
  }

  clear() { this.list.length = 0; this.mesh.count = 0; }

  update(dt) {
    let n = 0;
    const keep = [];
    for (const p of this.list) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy -= 18 * p.gravity * dt;
      const k = 1 - p.drag * dt;
      p.vx *= k; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05 && p.gravity > 0) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.rx += dt * 4; p.ry += dt * 3;
      const s = p.size * (1 - Math.pow(p.age / p.life, 3));
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, 0);
      dummy.scale.setScalar(Math.max(0.001, s));
      dummy.updateMatrix();
      this.mesh.setMatrixAt(n, dummy.matrix);
      this.mesh.setColorAt(n, tmpColor.set(p.color));
      n++;
      keep.push(p);
    }
    this.list = keep;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// Little glowing cubes dropped along the flight path. Each ball gets its own colour.
export class Trail {
  constructor(scene, max = 1600) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), max);
    this.mesh.setColorAt(0, tmpColor.set('#ffffff'));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.items = [];
    this.dirty = false;
  }

  add(pos, color, size = 0.55) {
    if (this.items.length >= this.max) this.items.shift();
    this.items.push({ x: pos.x, y: pos.y, z: pos.z, color, age: 0, size });
    this.dirty = true;
  }

  clear() { this.items.length = 0; this.mesh.count = 0; }

  update(dt) {
    let n = 0;
    for (const it of this.items) {
      if (it.age < 1.5) { it.age += dt; this.dirty = true; }
      const s = it.size * (0.45 + 0.55 * Math.max(0, 1 - it.age / 1.5));
      dummy.position.set(it.x, it.y, it.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(n, dummy.matrix);
      this.mesh.setColorAt(n, tmpColor.set(it.color));
      n++;
    }
    this.mesh.count = n;
    if (this.dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      this.dirty = false;
    }
  }
}
