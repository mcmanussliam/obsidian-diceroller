import * as THREE from 'three';

export class DecagonGeometry extends THREE.BufferGeometry {
  public constructor(r: number) {
    super();
    this.init(r);
  }

  public init(r: number): void {
    const FACES = 5;
    // Ratios chosen so opposite faces are parallel and the die sits flat.
    const APEX_RATIO = 0.9;
    const RING_RATIO = 0.82;

    const APEX_Y = r * APEX_RATIO;
    const RING_R = r * RING_RATIO;

    const c = Math.cos(Math.PI / FACES);
    const RING_Y = APEX_Y * ((1 - c) / (1 + c));

    const points: THREE.Vector3[] = [];
    const verts: number[] = [];

    const upper: number[] = [];
    const lower: number[] = [];

    for (let i = 0; i < FACES; i++) {
      const angle = (2 * Math.PI * i) / FACES + Math.PI / FACES;
      upper.push(points.length);
      points.push(new THREE.Vector3(RING_R * Math.cos(angle), RING_Y, RING_R * Math.sin(angle)));
    }

    for (let i = 0; i < FACES; i++) {
      const angle = (2 * Math.PI * i) / FACES;
      lower.push(points.length);
      points.push(new THREE.Vector3(RING_R * Math.cos(angle), -RING_Y, RING_R * Math.sin(angle)));
    }

    const top = points.length;
    points.push(new THREE.Vector3(0, APEX_Y, 0));

    const bottom = points.length;
    points.push(new THREE.Vector3(0, -APEX_Y, 0));

    const addTriangle = (a: number, b: number, c: number): void => {
      const A = points[a];
      const B = points[b];
      const C = points[c];

      const normal = new THREE.Vector3()
        .subVectors(B, A)
        .cross(new THREE.Vector3().subVectors(C, A));

      const center = new THREE.Vector3()
        .add(A)
        .add(B)
        .add(C)
        .multiplyScalar(1 / 3);

      const order = normal.dot(center) < 0 ? [a, c, b] : [a, b, c];

      for (const idx of order) {
        const p = points[idx];
        verts.push(p.x, p.y, p.z);
      }
    };

    for (let i = 0; i < FACES; i++) {
      const u0 = upper[i];
      const uPrev = upper[(i - 1 + FACES) % FACES];
      const l0 = lower[i];

      addTriangle(top, u0, l0);
      addTriangle(top, l0, uPrev);
    }

    for (let i = 0; i < FACES; i++) {
      const l0 = lower[i];
      const lNext = lower[(i + 1) % FACES];
      const u0 = upper[i];

      addTriangle(bottom, l0, u0);
      addTriangle(bottom, u0, lNext);
    }

    this.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));

    this.computeVertexNormals();
    this.computeBoundingSphere();
  }
}
