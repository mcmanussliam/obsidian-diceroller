import * as THREE from 'three';
import type { DieSides } from '@/lib/parser/dice-parser';

const CELL_SIZE = 256;

/**
 * Draws all face labels into a canvas texture atlas — one cell per face.
 * The cell layout matches the UV atlas written by buildFaceUVs.
 *
 * For d4, draws 3 smaller labels at face corner positions (nudged toward the
 * centroid) so numbers sit inside each triangular face.
 * For all other dice, draws the label at the geometric centroid of each face.
 */
export function generateFaceTexture(
  faceLabels: string[],
  faceColor: number,
  faceCentroids: readonly { cx: number; cy: number }[],
  faceVertexPixels: readonly (readonly { cx: number; cy: number }[])[],
  sides: DieSides
): THREE.CanvasTexture {
  const n = faceLabels.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);

  const canvas = document.createElement('canvas');
  canvas.width = cols * CELL_SIZE;
  canvas.height = rows * CELL_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2d canvas context');
  }

  const bgCSS = hexToCSS(faceColor);
  const textColor = autoContrast(faceColor);

  for (let i = 0; i < faceLabels.length; i++) {
    const label = faceLabels[i];
    const x = (i % cols) * CELL_SIZE;
    const y = Math.floor(i / cols) * CELL_SIZE;

    ctx.fillStyle = bgCSS;
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (sides === 4) {
      const cornerFontSize = Math.round(CELL_SIZE * 0.28);
      ctx.font = `bold ${cornerFontSize}px Georgia, serif`;
      const centroid = faceCentroids[i];
      for (const corner of faceVertexPixels[i]) {
        const cx = corner.cx + (centroid.cx - corner.cx) * 0.25;
        const cy = corner.cy + (centroid.cy - corner.cy) * 0.25;
        ctx.fillText(label, x + cx, y + cy);
      }
    } else {
      const fontSize = label.length > 1 ? Math.round(CELL_SIZE * 0.36) : Math.round(CELL_SIZE * 0.44);
      ctx.font = `bold ${fontSize}px Georgia, serif`;
      ctx.fillText(label, x + faceCentroids[i].cx, y + faceCentroids[i].cy);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function hexToCSS(hex: number): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `rgb(${r},${g},${b})`;
}

function autoContrast(hex: number): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a1a' : '#f4f4f0';
}
