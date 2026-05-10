import * as THREE from 'three';
import { type DieSides, DICE_REGISTRY } from '@/dice/registry';
import { applyUVArray, type FaceLayout } from '@/dice/faces/uv';
import { generateFaceTexture } from '@/dice/faces/texture';
import { buildD4VertexMap } from '@/dice/faces/numbers';
import { isDark } from '@/utils/color';
import type { DiceSkinDefinition, DiceSkinHandler } from '@/dice/skin/definition';

const DEFAULT_COLORS: Record<DieSides, number> = {
  4: 0xcc2222,
  6: 0xf5f0e8,
  8: 0x2266cc,
  10: 0x8833bb,
  12: 0x229955,
  20: 0xeef0ff,
  100: 0xcc7722,
};

const Magics = {
  MATERIAL_ROUGHNESS: 0.35,
  MATERIAL_METALNESS: 0.15,
  EDGE_OPACITY: 0.55,
  EDGE_THRESHOLD_ANGLE: 10,
} as const;

export const DEFAULT_SKIN: DiceSkinDefinition = {
  id: 'default',
  name: 'Default',
  source: 'procedural',
};

export class ProceduralSkinHandler implements DiceSkinHandler {
  public readonly definition: DiceSkinDefinition;

  readonly #colors: Record<DieSides, number>;

  readonly #font: string;

  readonly #textureCache = new Map<DieSides, THREE.CanvasTexture>();

  public constructor(definition: DiceSkinDefinition) {
    this.definition = definition;
    this.#colors = { ...DEFAULT_COLORS, ...definition.colors } as Record<DieSides, number>;
    this.#font = definition.font ?? 'Georgia, serif';
  }

  public async preload(): Promise<void> {}

  public buildMesh(
    sides: DieSides,
    physicsGeo: THREE.BufferGeometry,
    layout: FaceLayout
  ): THREE.Mesh {
    const color = this.#colors[sides];
    const texture = this.#getTexture(sides, layout, color);

    const visualGeo = physicsGeo.toNonIndexed();
    visualGeo.computeVertexNormals();
    applyUVArray(visualGeo, layout.uvArray);

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      flatShading: true,
      roughness: Magics.MATERIAL_ROUGHNESS,
      metalness: Magics.MATERIAL_METALNESS,
    });

    const mesh = new THREE.Mesh(visualGeo, material);
    mesh.castShadow = true;

    const edgeColor = isDark(color) ? 0xffffff : 0x000000;
    const edgesGeo = new THREE.EdgesGeometry(physicsGeo, Magics.EDGE_THRESHOLD_ANGLE);
    const edgeMat = new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: Magics.EDGE_OPACITY,
    });
    mesh.add(new THREE.LineSegments(edgesGeo, edgeMat));

    return mesh;
  }

  public getSound(): undefined {
    return undefined;
  }

  public dispose(): void {
    for (const texture of this.#textureCache.values()) {
      texture.dispose();
    }
    this.#textureCache.clear();
  }

  #getTexture(sides: DieSides, layout: FaceLayout, color: number): THREE.CanvasTexture {
    const cached = this.#textureCache.get(sides);
    if (cached) {
      return cached;
    }

    const def = DICE_REGISTRY[sides];
    const d4VertexMap = def.vertexLabels
      ? buildD4VertexMap([...layout.faceLabels], layout.faceData.faceVertexIds)
      : undefined;

    const texture = generateFaceTexture(
      [...layout.faceLabels],
      color,
      layout.faceData.faceCentroids,
      layout.faceData.faceVertexPixels,
      layout.faceData.faceVertexIds,
      def.vertexLabels,
      this.#font,
      d4VertexMap
    );

    this.#textureCache.set(sides, texture);
    return texture;
  }
}
