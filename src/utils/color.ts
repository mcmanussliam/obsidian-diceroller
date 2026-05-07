/** Converts a numeric hex color to a CSS hex string */
export function colorToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
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
