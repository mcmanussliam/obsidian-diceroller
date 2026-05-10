import { DiceRoll } from 'rpg-dice-roller';

export interface DiceGroup {
  /** Number of dice to roll. */
  readonly count: number;

  /** Number of faces on each die. */
  readonly sides: number;
}

export interface ParsedDice {
  /** Original dice notation string. */
  readonly notation: string;

  /** Dice groups extracted for physical rendering. */
  readonly groups: readonly DiceGroup[];

  /** Additive modifier (e.g. +3 or -1), derived from total minus sum of die values. */
  readonly modifier: number;
}

export function parseDice(notation: string): ParsedDice {
  const roll = new DiceRoll(notation);
  const groups = extractGroups(notation);

  let diceSum = 0;
  for (const item of roll.rolls as unknown[]) {
    if (item === null || typeof item !== 'object') {
      continue;
    }
    const { rolls } = item as { rolls?: unknown };
    if (!Array.isArray(rolls)) {
      continue;
    }
    for (const r of rolls) {
      diceSum += (r as { value: number }).value;
    }
  }

  return {
    notation,
    groups,
    modifier: roll.total - diceSum,
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
