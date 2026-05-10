import type * as THREE from 'three';
import type { DieSides } from '@/dice/registry';
import type { FaceLayout } from '@/dice/faces/uv';

export interface DiceSkinDefinition {
  readonly id: string;

  readonly name: string;

  readonly source: 'procedural' | 'vault';

  readonly meshAssets?: Partial<Record<DieSides, string>>;

  readonly maps?: {
    readonly albedo?: string;
    readonly normal?: string;
    readonly roughness?: string;
    readonly metalness?: string;
    readonly ao?: string;
    readonly emissive?: string;
  };

  readonly materialParams?: {
    readonly roughness?: number;
    readonly metalness?: number;
    readonly envMapIntensity?: number;
    readonly clearcoat?: number;
    readonly clearcoatRoughness?: number;
  };

  readonly disableEdgeOverlay?: boolean;

  /**
   * Euler rotation in degrees [x, y, z] applied to the visual mesh only.
   * Use this to align an imported GLB's face orientation with the procedural
   * physics geometry so the visible top face matches the result reading.
   */
  readonly meshRotationOffset?: readonly [number, number, number];

  readonly numberStyle?: 'canvas' | 'baked';

  readonly sounds?: {
    readonly collision?: string;

    readonly result?: string;
  };

  readonly colors?: Partial<Record<DieSides, number>>;

  readonly font?: string;
}

export interface DiceSkinHandler {
  readonly definition: DiceSkinDefinition;
  preload(): Promise<void>;
  buildMesh(sides: DieSides, physicsGeo: THREE.BufferGeometry, layout: FaceLayout): THREE.Object3D;
  getSound(key: 'collision' | 'result'): AudioBuffer | undefined;
  dispose(): void;
}
