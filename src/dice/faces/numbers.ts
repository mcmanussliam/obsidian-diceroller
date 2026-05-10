import type * as THREE from 'three';
import type { DieSides } from '@/dice/parser';

const OPPOSITE_SUMS: Partial<Record<DieSides, number>> = {
  6: 7,
  8: 9,
  12: 13,
  20: 21,
};

/**
 * Returns the string label shown on each face index, following standard
 * physical die conventions (opposite faces sum to N, top face = lowest number).
 *
 * faceNormals must be in the same order as returned by buildFaceUVs.
 */
export function assignFaceNumbers(
  sides: DieSides,
  faceNormals: readonly THREE.Vector3[]
): string[] {
  if (sides === 4) {
    return assignSequential(faceNormals, (i) => String(i + 1));
  }

  if (sides === 10) {
    return assignByYThenAzimuth(faceNormals, (rank, total) =>
      rank === total - 1 ? '0' : String(rank + 1)
    );
  }

  if (sides === 100) {
    return assignByYThenAzimuth(faceNormals, (rank, total) =>
      rank === total - 1 ? '00' : String((rank + 1) * 10)
    );
  }

  const oppositeSum = OPPOSITE_SUMS[sides];
  if (oppositeSum !== undefined) {
    return assignOpposites(faceNormals, oppositeSum);
  }

  return assignSequential(faceNormals, (i) => String(i + 1));
}

/**
 * For d4: returns a map from global vertex ID to the number shown at that vertex.
 *
 * On a physical d4 the number at each corner equals the number of the face
 * opposite to that corner.  faceLabels[f] must already be set (call
 * assignFaceNumbers first).
 */
export function buildD4VertexMap(
  faceLabels: readonly string[],
  faceVertexIds: readonly (readonly number[])[]
): Map<number, number> {
  const map = new Map<number, number>();
  const allIds = new Set(faceVertexIds.flat());

  for (const vId of allIds) {
    // The face that does NOT contain this vertex is the opposite face.
    const oppFaceIdx = faceVertexIds.findIndex((corners) => !corners.includes(vId));
    if (oppFaceIdx !== -1) {
      map.set(vId, Number.parseInt(faceLabels[oppFaceIdx], 10));
    }
  }

  return map;
}

/** Converts a face label string back to a numeric result value. */
export function labelToResult(label: string, sides: DieSides): number {
  if (sides === 10) {
    return label === '0' ? 10 : Number.parseInt(label, 10);
  }

  if (sides === 100) {
    return label === '00' ? 100 : Number.parseInt(label, 10);
  }

  return Number.parseInt(label, 10);
}

function assignSequential(
  faceNormals: readonly THREE.Vector3[],
  label: (rank: number) => string
): string[] {
  const labels = new Array<string>(faceNormals.length);
  const sorted = faceNormals.map((_, i) => i).sort((a, b) => faceNormals[b].y - faceNormals[a].y);

  for (let rank = 0; rank < sorted.length; rank++) {
    labels[sorted[rank]] = label(rank);
  }

  return labels;
}

function assignByYThenAzimuth(
  faceNormals: readonly THREE.Vector3[],
  label: (rank: number, total: number) => string
): string[] {
  const labels = new Array<string>(faceNormals.length);
  const sorted = faceNormals
    .map((_, i) => i)
    .sort((a, b) => {
      const dy = faceNormals[b].y - faceNormals[a].y;
      if (Math.abs(dy) > 0.01) {
        return dy;
      }

      return (
        Math.atan2(faceNormals[a].z, faceNormals[a].x) -
        Math.atan2(faceNormals[b].z, faceNormals[b].x)
      );
    });

  for (let rank = 0; rank < sorted.length; rank++) {
    labels[sorted[rank]] = label(rank, faceNormals.length);
  }

  return labels;
}

function assignOpposites(faceNormals: readonly THREE.Vector3[], oppositeSum: number): string[] {
  const n = faceNormals.length;
  const labels = new Array<string>(n).fill('');
  const paired = new Array<boolean>(n).fill(false);
  const pairs: [number, number][] = [];

  for (let i = 0; i < n; i++) {
    if (paired[i]) {
      continue;
    }

    let bestJ = -1;
    let bestDot = 0;

    for (let j = i + 1; j < n; j++) {
      if (paired[j]) {
        continue;
      }

      const dot = faceNormals[i].dot(faceNormals[j]);
      if (dot < bestDot) {
        bestDot = dot;
        bestJ = j;
      }
    }

    if (bestJ !== -1) {
      pairs.push([i, bestJ]);
      paired[i] = paired[bestJ] = true;
    }
  }

  pairs.sort((pa, pb) => {
    const maxYA = Math.max(faceNormals[pa[0]].y, faceNormals[pa[1]].y);
    const maxYB = Math.max(faceNormals[pb[0]].y, faceNormals[pb[1]].y);
    if (Math.abs(maxYA - maxYB) > 0.01) {
      return maxYB - maxYA;
    }

    const upperA = faceNormals[pa[0]].y >= faceNormals[pa[1]].y ? pa[0] : pa[1];
    const upperB = faceNormals[pb[0]].y >= faceNormals[pb[1]].y ? pb[0] : pb[1];

    return (
      Math.atan2(faceNormals[upperA].z, faceNormals[upperA].x) -
      Math.atan2(faceNormals[upperB].z, faceNormals[upperB].x)
    );
  });

  for (let rank = 0; rank < pairs.length; rank++) {
    const [a, b] = pairs[rank];
    const lo = rank + 1;
    const hi = oppositeSum - lo;

    if (faceNormals[a].y >= faceNormals[b].y) {
      labels[a] = String(lo);
      labels[b] = String(hi);
    } else {
      labels[a] = String(hi);
      labels[b] = String(lo);
    }
  }

  return labels;
}
