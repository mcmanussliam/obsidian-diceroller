import * as THREE from 'three';
import { hexToRGBString, autoContrast } from '@/utils/color';
import { CELL_SIZE } from '@/dice/faces/uv';

/**
 * Draws all face labels into a canvas texture atlas — one cell per face.
 * The cell layout matches the UV atlas written by buildFaceUVs.
 *
 * When vertexLabels is true (d4), draws a different number at each corner:
 * the number of the vertex at that corner (= the face opposite to it),
 * matching real physical d4 dice.  Requires d4VertexMap and faceVertexIds.
 *
 * For all other dice, draws the label at the geometric centroid of each face.
 */
export function generateFaceTexture(
  faceLabels: string[],
  faceColor: number,
  faceCentroids: readonly { cx: number; cy: number }[],
  faceVertexPixels: readonly (readonly { cx: number; cy: number }[])[],
  faceVertexIds: readonly (readonly number[])[],
  vertexLabels: boolean,
  font: string,
  d4VertexMap?: Map<number, number>
): THREE.CanvasTexture {
  const n = faceLabels.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);

  const canvas = new OffscreenCanvas(cols * CELL_SIZE, rows * CELL_SIZE);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2d canvas context');
  }

  const bgCSS = hexToRGBString(faceColor);
  const textColor = autoContrast(faceColor);

  for (const [i] of faceLabels.entries()) {
    const x = (i % cols) * CELL_SIZE;
    const y = Math.floor(i / cols) * CELL_SIZE;

    ctx.fillStyle = bgCSS;
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (vertexLabels && d4VertexMap) {
      // Each corner shows the number of the vertex at that corner (= opposite face number).
      const cornerFontSize = Math.round(CELL_SIZE * 0.2);
      ctx.font = `bold ${cornerFontSize}px ${font}`;
      const centroid = faceCentroids[i];
      const corners = faceVertexPixels[i];
      const vertexIds = faceVertexIds[i];

      for (let c = 0; c < corners.length; c++) {
        const corner = corners[c];
        const num = d4VertexMap.get(vertexIds[c]) ?? '';
        // Nudge 35% toward centroid so the number sits inside the triangle.
        const cx = corner.cx + (centroid.cx - corner.cx) * 0.35;
        const cy = corner.cy + (centroid.cy - corner.cy) * 0.35;
        ctx.fillText(String(num), x + cx, y + cy);
      }
    } else {
      const label = faceLabels[i];
      const fontSize =
        label.length > 1 ? Math.round(CELL_SIZE * 0.36) : Math.round(CELL_SIZE * 0.44);
      ctx.font = `bold ${fontSize}px ${font}`;
      ctx.fillText(label, x + faceCentroids[i].cx, y + faceCentroids[i].cy);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
