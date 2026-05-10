import * as THREE from 'three';
import { DecagonGeometry } from '@/dice/geometry/decagon';
import { assignSequential, assignOpposites, assignByYThenAzimuth } from '@/dice/faces/numbers';

export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export type DieSides = (typeof DICE_SIDES)[number];

export function clampSides(sides: number): DieSides {
  const sorted = [...DICE_SIDES].sort((a, b) => Math.abs(a - sides) - Math.abs(b - sides));
  return sorted[0];
}

export interface DieDefinition {
  readonly sides: DieSides;
  /** Builds the THREE geometry used for both physics and rendering. */
  readonly buildGeometry: (radius: number) => THREE.BufferGeometry;
  /** Assigns face labels from sorted normals; returns one string per logical face. */
  readonly assignLabels: (normals: readonly THREE.Vector3[]) => string[];
  /** Converts a settled face label string to its numeric result value. */
  readonly readResult: (label: string) => number;
  /**
   * When true, face numbers are drawn at the three corners rather than the
   * centroid (d4 physical convention).  Also inverts result reading: the
   * bottom face (lowest world-Y normal) wins instead of the top.
   */
  readonly vertexLabels: boolean;
}

const parseInt10 = (label: string): number => Number.parseInt(label, 10);

/** Single source of truth for all supported die types. */
export const DICE_REGISTRY: Record<DieSides, DieDefinition> = {
  4: {
    sides: 4,
    buildGeometry: (r) => new THREE.TetrahedronGeometry(r),
    assignLabels: (normals) => assignSequential(normals, (i) => String(i + 1)),
    readResult: parseInt10,
    vertexLabels: true,
  },
  6: {
    sides: 6,
    buildGeometry: () => new THREE.BoxGeometry(1, 1, 1),
    assignLabels: (normals) => assignOpposites(normals, 7),
    readResult: parseInt10,
    vertexLabels: false,
  },
  8: {
    sides: 8,
    buildGeometry: (r) => new THREE.OctahedronGeometry(r),
    assignLabels: (normals) => assignOpposites(normals, 9),
    readResult: parseInt10,
    vertexLabels: false,
  },
  10: {
    sides: 10,
    buildGeometry: (r) => new DecagonGeometry(r),
    assignLabels: (normals) =>
      assignByYThenAzimuth(normals, (rank, total) => (rank === total - 1 ? '0' : String(rank + 1))),
    readResult: (label) => (label === '0' ? 10 : parseInt10(label)),
    vertexLabels: false,
  },
  12: {
    sides: 12,
    buildGeometry: (r) => new THREE.DodecahedronGeometry(r),
    assignLabels: (normals) => assignOpposites(normals, 13),
    readResult: parseInt10,
    vertexLabels: false,
  },
  20: {
    sides: 20,
    buildGeometry: (r) => new THREE.IcosahedronGeometry(r),
    assignLabels: (normals) => assignOpposites(normals, 21),
    readResult: parseInt10,
    vertexLabels: false,
  },
  100: {
    sides: 100,
    buildGeometry: (r) => new DecagonGeometry(r),
    assignLabels: (normals) =>
      assignByYThenAzimuth(normals, (rank, total) =>
        rank === total - 1 ? '00' : String((rank + 1) * 10)
      ),
    readResult: (label) => (label === '00' ? 100 : parseInt10(label)),
    vertexLabels: false,
  },
};
