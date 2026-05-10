import type * as THREE from 'three';

/**
 * For d4: returns a map from global vertex ID to the number shown at that vertex.
 *
 * On a physical d4 the number at each corner equals the number of the face
 * opposite to that corner. faceLabels[f] must already be set (call
 * assignLabels from the registry entry first).
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

export function assignSequential(
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

export function assignByYThenAzimuth(
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

export function assignOpposites(faceNormals: readonly THREE.Vector3[], oppositeSum: number): string[] {
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
