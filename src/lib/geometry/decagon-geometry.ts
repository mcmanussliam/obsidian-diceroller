import * as THREE from 'three';

export class DecagonGeometry extends THREE.BufferGeometry {
  public constructor(r: number) {
    super();
    this.init(r);
  }

  public init(r: number): void {
    const FACES = 5;
    const RING_Y = r * 0.35;
    const APEX_Y = r * 0.65;
    const RING_R = r * 0.82;

    const verts: number[] = [];
    const indices: number[] = [];

    // Upper ring offset by half a step so upper/lower vertices interleave
    const upper: number[] = [];
    for (let i = 0; i < FACES; i++) {
      const angle = (2 * Math.PI * i) / FACES + Math.PI / FACES;
      upper.push(verts.length / 3);
      verts.push(RING_R * Math.cos(angle), RING_Y, RING_R * Math.sin(angle));
    }

    const lower: number[] = [];
    for (let i = 0; i < FACES; i++) {
      const angle = (2 * Math.PI * i) / FACES;
      lower.push(verts.length / 3);
      verts.push(RING_R * Math.cos(angle), -RING_Y, RING_R * Math.sin(angle));
    }

    const top = verts.length / 3;
    verts.push(0, APEX_Y, 0);
    const bot = verts.length / 3;
    verts.push(0, -APEX_Y, 0);

    // 10 kite faces of a pentagonal trapezohedron:
    // 5 upper kites — each spans: top, upper[i+1], lower[i], upper[i]
    for (let i = 0; i < FACES; i++) {
      const u0 = upper[i];
      const u1 = upper[(i + 1) % FACES];
      const l0 = lower[i];
      indices.push(top, u1, l0);
      indices.push(top, l0, u0);
    }

    // 5 lower kites — each spans: bot, lower[i], upper[i+1], lower[i+1]
    for (let i = 0; i < FACES; i++) {
      const l0 = lower[i];
      const l1 = lower[(i + 1) % FACES];
      const u1 = upper[(i + 1) % FACES];
      indices.push(bot, l0, u1);
      indices.push(bot, u1, l1);
    }

    this.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    this.setIndex(indices);
    this.computeVertexNormals();
  }
}
