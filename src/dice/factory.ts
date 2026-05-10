import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { type DieSides, DICE_REGISTRY } from '@/dice/registry';
import { geomToConvex } from '@/utils/cannon-bridge';
import type { GroundBounds } from '@/scene/physics';
import { buildFaceUVs, type FaceData, type FaceLayout } from '@/dice/faces/uv';
import type { DiceSkinHandler } from '@/dice/skin/definition';

export type { FaceLayout };

const Magics = {
  DIE_RADIUS: 0.85,
  FALLBACK_SPHERE_RADIUS: 0.65,
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
  readonly mesh: THREE.Object3D;
  readonly body: CANNON.Body;
  readonly sides: DieSides;
  readonly faceData: FaceData;
  readonly faceLabels: readonly string[];
  readonly readResult: (mesh: THREE.Object3D) => number;
}

export class DiceFactory {
  readonly #physicsMaterial: CANNON.Material;

  readonly #physicsGeoCache = new Map<DieSides, THREE.BufferGeometry>();

  readonly #layoutCache = new Map<DieSides, FaceLayout>();

  readonly #bounds: GroundBounds;

  readonly #skinHandler: DiceSkinHandler;

  public constructor(
    physicsMaterial: CANNON.Material,
    bounds: GroundBounds,
    skinHandler: DiceSkinHandler
  ) {
    this.#physicsMaterial = physicsMaterial;
    this.#bounds = bounds;
    this.#skinHandler = skinHandler;
  }

  public createDie(sides: DieSides): DieObject {
    const def = DICE_REGISTRY[sides];
    const physicsGeo = this.#getPhysicsGeo(sides);
    const layout = this.#getLayout(sides, physicsGeo);
    const mesh = this.#skinHandler.buildMesh(sides, physicsGeo, layout);
    const body = this.#buildBody(physicsGeo);

    const { faceData, faceLabels } = layout;

    const readResult = (m: THREE.Object3D): number => {
      let bestIdx = 0;
      let bestY = def.vertexLabels ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

      for (let i = 0; i < faceData.faceNormals.length; i++) {
        const wy = faceData.faceNormals[i].clone().applyQuaternion(m.quaternion).y;
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
    this.#layoutCache.clear();
  }

  #getLayout(sides: DieSides, physicsGeo: THREE.BufferGeometry): FaceLayout {
    const cached = this.#layoutCache.get(sides);
    if (cached) return cached;

    const tempGeo = physicsGeo.toNonIndexed();
    tempGeo.computeVertexNormals();
    const { faceData, uvArray } = buildFaceUVs(tempGeo);
    tempGeo.dispose();

    const faceLabels = DICE_REGISTRY[sides].assignLabels(faceData.faceNormals);
    const layout: FaceLayout = { faceData, faceLabels, uvArray };
    this.#layoutCache.set(sides, layout);
    return layout;
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

    const spawnX = maxX * Magics.SPAWN_CORNER_FACTOR + (Math.random() - 0.5) * Magics.SPAWN_SCATTER;
    const spawnZ = maxZ * Magics.SPAWN_CORNER_FACTOR + (Math.random() - 0.5) * Magics.SPAWN_SCATTER;
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

  #getPhysicsGeo(sides: DieSides): THREE.BufferGeometry {
    const cached = this.#physicsGeoCache.get(sides);
    if (cached) return cached;
    const geo = DICE_REGISTRY[sides].buildGeometry(Magics.DIE_RADIUS);
    this.#physicsGeoCache.set(sides, geo);
    return geo;
  }
}
