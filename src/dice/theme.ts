import type { DieSides } from '@/dice/registry';

export interface DieTheme {
  /** Face background color per die type. */
  readonly colors: Record<DieSides, number>;
  /** CSS font family used for face labels (size is computed per-face). */
  readonly font: string;
}

export const DEFAULT_THEME: DieTheme = {
  colors: {
    4: 0xcc2222,
    6: 0xf5f0e8,
    8: 0x2266cc,
    10: 0x8833bb,
    12: 0x229955,
    20: 0xeef0ff,
    100: 0xcc7722,
  },
  font: 'Georgia, serif',
};
