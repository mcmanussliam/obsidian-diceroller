/** Converts a numeric hex color to a CSS hex string. */
export function colorToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Converts a numeric hex color to a CSS `rgb()` string. */
export function hexToRGBString(color: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgb(${r},${g},${b})`;
}

/**
 * Returns true when the perceived luminance of a color falls below the mid-point,
 * making white the better foreground text choice over black.
 */
export function isDark(color: number): boolean {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

/**
 * Returns a legible foreground colour for text rendered on top of `color`.
 * Uses the same luminance threshold as `isDark`.
 */
export function autoContrast(color: number): string {
  return isDark(color) ? '#f4f4f0' : '#1a1a1a';
}
