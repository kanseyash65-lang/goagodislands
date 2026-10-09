import {
  DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, type BufferGeometry, type Material, type Matrix4,
} from 'three';

const GROW = 2;

/**
 * One instanced mesh per model. Each frame: `begin`, `push` instances (matrix
 * written straight into the typed array, no Object3D per entity), `commit`.
 * Grows by doubling when full (rare: only on big spawns).
 */
export class InstancedLayer {
  mesh: InstancedMesh;
  private count = 0;
  private anim: InstancedBufferAttribute;

  constructor(private readonly geometry: BufferGeometry, private readonly material: Material, private readonly parent: { add(m: InstancedMesh): void; remove(m: InstancedMesh): void }, private capacity = 32) {
    this.mesh = this.create(capacity);
    this.anim = this.attachAnim(this.mesh, capacity);
  }

  begin(): void {
    this.count = 0;
  }

  /** Writes a precomposed column-major matrix (16 floats) and per-instance colour/animation. */
  pushMatrix(m: ArrayLike<number>, r: number, g: number, b: number, phase: number, amp: number, flash: number): void {
    if (this.count >= this.capacity) this.grow();
    const i = this.count++;
    const arr = this.mesh.instanceMatrix.array as Float32Array;
    const o = i * 16;
    for (let k = 0; k < 16; k++) arr[o + k] = m[k] ?? 0;
    this.writeExtras(i, r, g, b, phase, amp, flash);
  }

  /** Writes T·Ry(yaw)·Rz(roll)·S directly (the common case, allocation-free). */
  push(x: number, y: number, z: number, yaw: number, roll: number, sx: number, sy: number, sz: number, r: number, g: number, b: number, phase: number, amp: number, flash: number): void {
    if (this.count >= this.capacity) this.grow();
    const i = this.count++;
    const a = this.mesh.instanceMatrix.array as Float32Array;
    const o = i * 16;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    a[o] = c * cr * sx; a[o + 1] = sr * sx; a[o + 2] = -s * cr * sx; a[o + 3] = 0;
    a[o + 4] = -c * sr * sy; a[o + 5] = cr * sy; a[o + 6] = s * sr * sy; a[o + 7] = 0;
    a[o + 8] = s * sz; a[o + 9] = 0; a[o + 10] = c * sz; a[o + 11] = 0;
    a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
    this.writeExtras(i, r, g, b, phase, amp, flash);
  }

  commit(): void {
    const n = this.count;
    this.mesh.count = n;
    this.mesh.instanceMatrix.clearUpdateRanges();
    this.mesh.instanceMatrix.addUpdateRange(0, n * 16);
    this.mesh.instanceMatrix.needsUpdate = true;
    const col = this.mesh.instanceColor;
    if (col) {
      col.clearUpdateRanges();
      col.addUpdateRange(0, n * 3);
      col.needsUpdate = true;
    }
    this.anim.clearUpdateRanges();
    this.anim.addUpdateRange(0, n * 3);
    this.anim.needsUpdate = true;
    this.mesh.visible = n > 0;
  }

  /** Copies a Matrix4 (for attachments composed with three's math). */
  pushM4(m: Matrix4, r: number, g: number, b: number): void {
    this.pushMatrix(m.elements, r, g, b, 0, 0, 0);
  }

  private writeExtras(i: number, r: number, g: number, b: number, phase: number, amp: number, flash: number): void {
    const col = this.mesh.instanceColor?.array as Float32Array | undefined;
    if (col) {
      col[i * 3] = r;
      col[i * 3 + 1] = g;
      col[i * 3 + 2] = b;
    }
    const an = this.anim.array as Float32Array;
    an[i * 3] = phase;
    an[i * 3 + 1] = amp;
    an[i * 3 + 2] = flash;
  }

  private create(capacity: number): InstancedMesh {
    const mesh = new InstancedMesh(this.geometry, this.material, capacity);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    mesh.instanceColor.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false; // instances span the island; culling per instance is not worth it here
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.count = 0;
    this.parent.add(mesh);
    return mesh;
  }

  private attachAnim(mesh: InstancedMesh, capacity: number): InstancedBufferAttribute {
    const a = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    a.setUsage(DynamicDrawUsage);
    // Geometry is shared between layers only via clone, so the attribute lives on this mesh's geometry copy.
    mesh.geometry.setAttribute('iAnim', a);
    return a;
  }

  private grow(): void {
    const next = this.capacity * GROW;
    const old = this.mesh;
    const fresh = this.create(next);
    (fresh.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array as Float32Array);
    const oc = old.instanceColor?.array as Float32Array | undefined;
    if (oc) (fresh.instanceColor?.array as Float32Array).set(oc);
    const anim = new InstancedBufferAttribute(new Float32Array(next * 3), 3);
    anim.setUsage(DynamicDrawUsage);
    (anim.array as Float32Array).set(this.anim.array as Float32Array);
    fresh.geometry.setAttribute('iAnim', anim);
    this.anim = anim;
    this.parent.remove(old);
    old.dispose();
    this.mesh = fresh;
    this.capacity = next;
  }
}
