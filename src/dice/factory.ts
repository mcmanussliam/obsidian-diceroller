import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { type DieSides, DICE_REGISTRY, type DieDefinition } from '@/dice/registry';
import { isDark } from '@/utils/color';
import { geomToConvex } from '@/utils/cannon-bridge';
import type { GroundBounds } from '@/scene/physics';
import { buildFaceUVs, applyUVArray, type FaceData } from '@/dice/faces/uv';
import { buildD4VertexMap } from '@/dice/faces/numbers';
import { generateFaceTexture } from '@/dice/faces/texture';
import { DEFAULT_THEME, type DieTheme } from '@/dice/theme';

const Magics = {
  DIE_RADIUS: 0.85,
  FALLBACK_SPHERE_RADIUS: 0.65,
  MATERIAL_ROUGHNESS: 0.35,
  MATERIAL_METALNESS: 0.15,
  EDGE_OPACITY: 0.55,
  EDGE_THRESHOLD_ANGLE: 10,
  LINEAR_DAMPING: 0.25,
  ANGULAR_DAMPING: 0.25,
  SLEEP_SPEED: 0.08,
  SLEEP_TIME: 0.5,
  SPAWN_HEIGHT: 9,
  SPAWN_HEIGHT_RAND: 3,
  SPAWN_CORNER_FACTOR: 0.82,
  SPAWN_SCATTER: 2.5,
  THROW_SPEED: 12,
  THROW_VY: -2,
  THROW_SPIN: 14,
} as const;

export interface DieObject {
  readonly mesh: THREE.Mesh;
  readonly body: CANNON.Body;
  readonly sides: DieSides;
  readonly faceData: FaceData;
  readonly faceLabels: readonly string[];
  readonly readResult: (mesh: THREE.Mesh) => number;
}

interface FaceInfo {
  faceData: FaceData;
  faceLabels: string[];
  uvArray: Float32Array;
  texture: THREE.CanvasTexture;
}

export class DiceFactory {
  readonly #physicsMaterial: CANNON.Material;
  readonly #physicsGeoCache = new Map<DieSides, THREE.BufferGeometry>();
  readonly #faceInfoCache = new Map<DieSides, FaceInfo>();
  readonly #bounds: GroundBounds;
  readonly #theme: DieTheme;

  public constructor(
    physicsMaterial: CANNON.Material,
    bounds: GroundBounds,
    theme: DieTheme = DEFAULT_THEME
  ) {
    this.#physicsMaterial = physicsMaterial;
    this.#bounds = bounds;
    this.#theme = theme;
  }

  public createDie(sides: DieSides): DieObject {
    const def = DICE_REGISTRY[sides];
    const physicsGeo = this.#getPhysicsGeo(def);
    const faceInfo = this.#getFaceInfo(def, physicsGeo);
    const mesh = this.#buildMesh(def, physicsGeo, faceInfo);
    const body = this.#buildBody(physicsGeo);

    const { faceLabels, faceData } = faceInfo;

    const readResult = (m: THREE.Mesh): number => {
      const { faceNormals } = faceData;
      let bestIdx = 0;
      let bestY = def.vertexLabels ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

      for (let i = 0; i < faceNormals.length; i++) {
        const wy = faceNormals[i].clone().applyQuaternion(m.quaternion).y;
        if (def.vertexLabels ? wy < bestY : wy > bestY) {
          bestY = wy;
          bestIdx = i;
        }
      }

      return def.readResult(faceLabels[bestIdx]);
    };

    return { mesh, body, sides, faceData, faceLabels, readResult };
  }

  public dispose(): void {
    for (const geo of this.#physicsGeoCache.values()) {
      geo.dispose();
    }
    this.#physicsGeoCache.clear();

    for (const { texture } of this.#faceInfoCache.values()) {
      texture.dispose();
    }
    this.#faceInfoCache.clear();
  }

  #getFaceInfo(def: DieDefinition, physicsGeo: THREE.BufferGeometry): FaceInfo {
    const cached = this.#faceInfoCache.get(def.sides);
    if (cached) {
      return cached;
    }

    const tempGeo = physicsGeo.toNonIndexed();
    tempGeo.computeVertexNormals();
    const { faceData, uvArray } = buildFaceUVs(tempGeo);
    tempGeo.dispose();

    const faceLabels = def.assignLabels(faceData.faceNormals);
    const d4VertexMap = def.vertexLabels
      ? buildD4VertexMap(faceLabels, faceData.faceVertexIds)
      : undefined;

    const texture = generateFaceTexture(
      faceLabels,
      this.#theme.colors[def.sides],
      faceData.faceCentroids,
      faceData.faceVertexPixels,
      faceData.faceVertexIds,
      def.vertexLabels,
      this.#theme.font,
      d4VertexMap
    );

    const info: FaceInfo = { faceData, faceLabels, uvArray, texture };
    this.#faceInfoCache.set(def.sides, info);
    return info;
  }

  #buildMesh(def: DieDefinition, physicsGeo: THREE.BufferGeometry, faceInfo: FaceInfo): THREE.Mesh {
    const color = this.#theme.colors[def.sides];
    const edgeColor = isDark(color) ? 0xffffff : 0x000000;

    const visualGeo = physicsGeo.toNonIndexed();
    visualGeo.computeVertexNormals();
    applyUVArray(visualGeo, faceInfo.uvArray);

    const material = new THREE.MeshStandardMaterial({
      map: faceInfo.texture,
      flatShading: true,
      roughness: Magics.MATERIAL_ROUGHNESS,
      metalness: Magics.MATERIAL_METALNESS,
    });

    const mesh = new THREE.Mesh(visualGeo, material);
    mesh.castShadow = true;

    const edgesGeo = new THREE.EdgesGeometry(physicsGeo, Magics.EDGE_THRESHOLD_ANGLE);
    const edgeMat = new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: Magics.EDGE_OPACITY,
    });

    mesh.add(new THREE.LineSegments(edgesGeo, edgeMat));

    return mesh;
  }

  #buildBody(physicsGeo: THREE.BufferGeometry): CANNON.Body {
    const body = new CANNON.Body({
      mass: 1,
      material: this.#physicsMaterial,
      linearDamping: Magics.LINEAR_DAMPING,
      angularDamping: Magics.ANGULAR_DAMPING,
    });

    body.sleepSpeedLimit = Magics.SLEEP_SPEED;
    body.sleepTimeLimit = Magics.SLEEP_TIME;

    try {
      body.addShape(geomToConvex(physicsGeo));
    } catch {
      body.addShape(new CANNON.Sphere(Magics.FALLBACK_SPHERE_RADIUS));
    }

    const { minX, maxX, minZ, maxZ } = this.#bounds;

    const spawnX =
      maxX * Magics.SPAWN_CORNER_FACTOR + (Math.random() - 0.5) * Magics.SPAWN_SCATTER;
    const spawnZ =
      maxZ * Magics.SPAWN_CORNER_FACTOR + (Math.random() - 0.5) * Magics.SPAWN_SCATTER;
    const spawnY = Magics.SPAWN_HEIGHT + Math.random() * Magics.SPAWN_HEIGHT_RAND;
    body.position.set(spawnX, spawnY, spawnZ);

    const targetX = minX * 0.3 + Math.random() * (maxX - minX) * 0.5;
    const targetZ = minZ * 0.6 + Math.random() * (maxZ - minZ) * 0.3;
    const dx = targetX - spawnX;
    const dz = targetZ - spawnZ;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    body.velocity.set(
      (dx / horizontalDist) * Magics.THROW_SPEED,
      Magics.THROW_VY,
      (dz / horizontalDist) * Magics.THROW_SPEED
    );

    const spin = Magics.THROW_SPIN;
    body.angularVelocity.set(
      (Math.random() - 0.5) * spin,
      (Math.random() - 0.5) * spin,
      (Math.random() - 0.5) * spin
    );

    return body;
  }

  #getPhysicsGeo(def: DieDefinition): THREE.BufferGeometry {
    const cached = this.#physicsGeoCache.get(def.sides);
    if (cached) {
      return cached;
    }
    const geo = def.buildGeometry(Magics.DIE_RADIUS);
    this.#physicsGeoCache.set(def.sides, geo);
    return geo;
  }
}
