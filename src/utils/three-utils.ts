import * as CANNON from 'cannon-es';
import * as THREE from 'three';

/**
 * Converts a `THREE.BufferGeometry` into a `CANNON.ConvexPolyhedron` for physics simulation.
 * Deduplicates vertices by position to prevent zero-area faces that would crash `cannon-es`.
 */
export function geomToConvex(geometry: THREE.BufferGeometry): CANNON.ConvexPolyhedron {
  const posAttr = geometry.attributes.position;
  const index = geometry.index;

  const points: CANNON.Vec3[] = [];
  const faces: number[][] = [];
  const seen = new Map<string, number>();

  const getIdx = (i: number): number => {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const key = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;

    const existing = seen.get(key);
    if (existing) {
      return existing;
    }

    const idx = points.length;
    seen.set(key, idx);
    points.push(new CANNON.Vec3(x, y, z));

    return idx;
  };

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = getIdx(index.getX(i));
      const b = getIdx(index.getX(i + 1));
      const c = getIdx(index.getX(i + 2));
      if (a === b || b === c || a ===c) {
        continue;
      }

      faces.push([a, b, c]);
    }

  } else {
    for (let i = 0; i < posAttr.count; i += 3) {
      const a = getIdx(i);
      const b = getIdx(i + 1);
      const c = getIdx(i + 2);
      if (a === b || b === c || a ===c) {
        continue;
      }

      faces.push([a, b, c]);
    }
  }

  return new CANNON.ConvexPolyhedron({ vertices: points, faces });
}
