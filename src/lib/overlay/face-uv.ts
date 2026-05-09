import * as THREE from 'three';

export interface FaceData {
  readonly faceNormals: readonly THREE.Vector3[];
  readonly faceGroups: readonly (readonly number[])[];
  readonly faceCentroids: readonly { cx: number; cy: number }[];
  readonly faceVertexPixels: readonly (readonly { cx: number; cy: number }[])[];
}

const PADDING = 0.12;
const CELL_SIZE = 256;

/**
 * Groups the triangles of a non-indexed geometry by coplanar face normal,
 * writes a UV atlas onto the geometry (one cell per logical face), and
 * returns the face data needed for result reading and texture rendering.
 *
 * Must be called after toNonIndexed() and computeVertexNormals().
 */
export function buildFaceUVs(geo: THREE.BufferGeometry): {
  faceData: FaceData;
  uvArray: Float32Array;
} {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const triCount = pos.count / 3;

  const faceGroups: number[][] = [];
  const faceNormalSum: THREE.Vector3[] = [];

  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const C = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    A.fromBufferAttribute(pos, t * 3 + 0);
    B.fromBufferAttribute(pos, t * 3 + 1);
    C.fromBufferAttribute(pos, t * 3 + 2);

    const normal = new THREE.Vector3()
      .subVectors(B, A)
      .cross(new THREE.Vector3().subVectors(C, A))
      .normalize();

    const centroid = new THREE.Vector3().addVectors(A, B).add(C).divideScalar(3);
    if (normal.dot(centroid) < 0) {
      normal.negate();
    }

    let placed = false;
    for (let g = 0; g < faceGroups.length; g++) {
      if (faceNormalSum[g].clone().normalize().dot(normal) > 0.99) {
        faceGroups[g].push(t);
        faceNormalSum[g].add(normal);
        placed = true;
        break;
      }
    }

    if (!placed) {
      faceGroups.push([t]);
      faceNormalSum.push(normal.clone());
    }
  }

  const faceNormals = faceNormalSum.map((s) => s.normalize());
  const faceCount = faceGroups.length;
  const cols = Math.ceil(Math.sqrt(faceCount));
  const rows = Math.ceil(faceCount / cols);
  const uvArray = new Float32Array(pos.count * 2);

  const faceCentroids: { cx: number; cy: number }[] = [];
  const faceVertexPixels: { cx: number; cy: number }[][] = [];

  for (let faceIdx = 0; faceIdx < faceGroups.length; faceIdx++) {
    const triIndices = faceGroups[faceIdx];
    const cellCol = faceIdx % cols;
    const cellRow = Math.floor(faceIdx / cols);

    const u0 = cellCol / cols;
    const u1 = (cellCol + 1) / cols;
    const v0 = 1 - (cellRow + 1) / rows;
    const v1 = 1 - cellRow / rows;

    const N = faceNormals[faceIdx];
    const ref = Math.abs(N.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const T = new THREE.Vector3().crossVectors(ref, N).normalize();
    const Bv = new THREE.Vector3().crossVectors(N, T).normalize();

    const projected: Array<{ vi: number; pu: number; pv: number }> = [];
    for (const t of triIndices) {
      for (let v = 0; v < 3; v++) {
        const vi = t * 3 + v;
        const p = new THREE.Vector3().fromBufferAttribute(pos, vi);
        projected.push({ vi, pu: p.dot(T), pv: p.dot(Bv) });
      }
    }

    let uMin = Number.POSITIVE_INFINITY;
    let uMax = Number.NEGATIVE_INFINITY;
    let vMin = Number.POSITIVE_INFINITY;
    let vMax = Number.NEGATIVE_INFINITY;

    for (const { pu, pv } of projected) {
      if (pu < uMin) uMin = pu;
      if (pu > uMax) uMax = pu;
      if (pv < vMin) vMin = pv;
      if (pv > vMax) vMax = pv;
    }

    const uRange = uMax - uMin || 1;
    const vRange = vMax - vMin || 1;

    const pixelPoints: { cx: number; cy: number }[] = [];

    for (const { vi, pu, pv } of projected) {
      const un = (pu - uMin) / uRange;
      const vn = (pv - vMin) / vRange;
      uvArray[vi * 2 + 0] = u0 + (PADDING + un * (1 - 2 * PADDING)) * (u1 - u0);
      uvArray[vi * 2 + 1] = v0 + (PADDING + vn * (1 - 2 * PADDING)) * (v1 - v0);
      pixelPoints.push({
        cx: (PADDING + un * (1 - 2 * PADDING)) * CELL_SIZE,
        cy: (1 - PADDING - vn * (1 - 2 * PADDING)) * CELL_SIZE,
      });
    }

    const unique: { cx: number; cy: number }[] = [];
    for (const pp of pixelPoints) {
      if (!unique.some((u) => Math.abs(u.cx - pp.cx) < 1 && Math.abs(u.cy - pp.cy) < 1)) {
        unique.push(pp);
      }
    }

    faceCentroids.push({
      cx: unique.reduce((s, p) => s + p.cx, 0) / unique.length,
      cy: unique.reduce((s, p) => s + p.cy, 0) / unique.length,
    });
    faceVertexPixels.push(unique);
  }

  geo.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));

  return { faceData: { faceNormals, faceGroups, faceCentroids, faceVertexPixels }, uvArray };
}

export function applyUVArray(geo: THREE.BufferGeometry, uvArray: Float32Array): void {
  geo.setAttribute('uv', new THREE.BufferAttribute(uvArray.slice(), 2));
}
