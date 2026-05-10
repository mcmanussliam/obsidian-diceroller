import * as THREE from 'three';

export interface FaceData {
  readonly faceNormals: readonly THREE.Vector3[];

  readonly faceGroups: readonly (readonly number[])[];

  readonly faceCentroids: readonly { cx: number; cy: number }[];

  readonly faceVertexPixels: readonly (readonly { cx: number; cy: number }[])[];

  /** Parallel to faceVertexPixels: global vertex ID for each corner of each face. */
  readonly faceVertexIds: readonly (readonly number[])[];

  /** One entry per unique 3-D vertex position across the whole geometry. */
  readonly globalVertexPositions: readonly THREE.Vector3[];
}

export interface FaceLayout {
  readonly faceData: FaceData;

  readonly faceLabels: readonly string[];

  readonly uvArray: Float32Array;
}

const PADDING = 0.12;
export const CELL_SIZE = 256;

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

    const matchIdx = faceGroups.findIndex(
      (_, g) => faceNormalSum[g].clone().normalize().dot(normal) > 0.99
    );

    if (matchIdx !== -1) {
      faceGroups[matchIdx].push(t);
      faceNormalSum[matchIdx].add(normal);
    } else {
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
  const faceCorner3D: THREE.Vector3[][] = [];

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

    const projected: Array<{ vi: number; pu: number; pv: number; p3d: THREE.Vector3 }> = [];
    for (const t of triIndices) {
      for (let v = 0; v < 3; v++) {
        const vi = t * 3 + v;
        const p = new THREE.Vector3().fromBufferAttribute(pos, vi);
        projected.push({ vi, pu: p.dot(T), pv: p.dot(Bv), p3d: p });
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

    const pixelPoints: { cx: number; cy: number; p3d: THREE.Vector3 }[] = [];

    for (const { vi, pu, pv, p3d } of projected) {
      const un = (pu - uMin) / uRange;
      const vn = (pv - vMin) / vRange;
      uvArray[vi * 2 + 0] = u0 + (PADDING + un * (1 - 2 * PADDING)) * (u1 - u0);
      uvArray[vi * 2 + 1] = v0 + (PADDING + vn * (1 - 2 * PADDING)) * (v1 - v0);
      pixelPoints.push({
        cx: (PADDING + un * (1 - 2 * PADDING)) * CELL_SIZE,
        cy: (1 - PADDING - vn * (1 - 2 * PADDING)) * CELL_SIZE,
        p3d,
      });
    }

    const unique: { cx: number; cy: number; p3d: THREE.Vector3 }[] = [];
    for (const pp of pixelPoints) {
      if (!unique.some((u) => Math.abs(u.cx - pp.cx) < 1 && Math.abs(u.cy - pp.cy) < 1)) {
        unique.push(pp);
      }
    }

    let sumCx = 0;
    let sumCy = 0;
    for (const p of unique) {
      sumCx += p.cx;
      sumCy += p.cy;
    }
    faceCentroids.push({ cx: sumCx / unique.length, cy: sumCy / unique.length });
    faceVertexPixels.push(unique.map(({ cx, cy }) => ({ cx, cy })));
    faceCorner3D.push(unique.map(({ p3d }) => p3d));
  }

  // Cluster 3D corner positions across all faces into stable global vertex IDs.
  const globalVertexPositions: THREE.Vector3[] = [];
  const getVertexId = (p: THREE.Vector3): number => {
    for (let i = 0; i < globalVertexPositions.length; i++) {
      if (globalVertexPositions[i].distanceTo(p) < 0.001) return i;
    }
    globalVertexPositions.push(p.clone());
    return globalVertexPositions.length - 1;
  };

  const faceVertexIds = faceCorner3D.map((corners) => corners.map((p3d) => getVertexId(p3d)));

  geo.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));

  return {
    faceData: {
      faceNormals,
      faceGroups,
      faceCentroids,
      faceVertexPixels,
      faceVertexIds,
      globalVertexPositions,
    },
    uvArray,
  };
}

export function applyUVArray(geo: THREE.BufferGeometry, uvArray: Float32Array): void {
  geo.setAttribute('uv', new THREE.BufferAttribute(uvArray.slice(), 2));
}
