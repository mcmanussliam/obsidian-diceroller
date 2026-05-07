import * as CANNON from 'cannon-es';
import * as THREE from 'three';

enum Magics {
  TEXTURE_SIZE = 128,
  TEXTURE_INSET = 4,
  TEXTURE_CORNER_RADIUS = 12,
  TEXTURE_FONT_RATIO = 0.45,
}

/**
 * Creates a canvas texture with a centred number drawn on a rounded-rectangle background.
 * Used to label each face of a D6.
 */
export function makeNumberTexture(num: number, bg: string, fg: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = Magics.TEXTURE_SIZE;
  canvas.height = Magics.TEXTURE_SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D canvas context');
  }

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(
    Magics.TEXTURE_INSET,
    Magics.TEXTURE_INSET,
    Magics.TEXTURE_SIZE - Magics.TEXTURE_INSET * 2,
    Magics.TEXTURE_SIZE - Magics.TEXTURE_INSET * 2,
    Magics.TEXTURE_CORNER_RADIUS
  );
  ctx.fill();

  ctx.fillStyle = fg;
  ctx.font = `bold ${Magics.TEXTURE_SIZE * Magics.TEXTURE_FONT_RATIO}px "Georgia", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), Magics.TEXTURE_SIZE / 2, Magics.TEXTURE_SIZE / 2);

  return new THREE.CanvasTexture(canvas);
}

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
