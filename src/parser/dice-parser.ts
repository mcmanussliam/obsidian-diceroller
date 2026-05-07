import { DiceRoll } from 'rpg-dice-roller';

export interface DiceGroup {
  /** Number of dice to roll. */
  readonly count: number;

  /** Number of faces on each die. */
  readonly sides: number;
}

export interface ParsedRoll {
  /** Original dice notation string. */
  readonly notation: string;

  /** Sum of all rolled values plus any modifiers. */
  readonly total: number;

  /** Human-readable breakdown produced by rpg-dice-roller. */
  readonly output: string;

  /** Dice groups extracted for physical rendering. */
  readonly groups: readonly DiceGroup[];
}

export function parseAndRoll(notation: string): ParsedRoll {
  const roll = new DiceRoll(notation);
  return {
    notation,
    total: roll.total,
    output: roll.output,
    groups: extractGroups(notation),
  };
}

/**
 * Extracts dice groups from a notation string for physical rendering.
 * "2d6+1d8+3" → [{count:2,sides:6},{count:1,sides:8}]
 */
export function extractGroups(notation: string): DiceGroup[] {
  const groups: DiceGroup[] = [];

  for (const match of notation.matchAll(/(\d+)d(\d+)/gi)) {
    groups.push({
      count: Number.parseInt(match[1], 10),
      sides: Number.parseInt(match[2], 10),
    });
  }

  return groups;
}

export function validateNotation(notation: string): boolean {
  try {
    new DiceRoll(notation);
    return true;
  } catch {
    return false;
  }
}

export const VALID_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export type DieSides = (typeof VALID_SIDES)[number];

export function clampSides(sides: number): DieSides {
  const sorted = [...VALID_SIDES].sort((a, b) => Math.abs(a - sides) - Math.abs(b - sides));
  return sorted[0];
}
