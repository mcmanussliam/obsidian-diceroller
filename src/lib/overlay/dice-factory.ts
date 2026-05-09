import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { clampSides, type DieSides } from '@/lib/parser/dice-parser';
import { isDark } from '@/utils/color';
import { geomToConvex } from '@/utils/three-utils';
import { DecagonGeometry } from '@/lib/geometry/decagon-geometry';
import type { GroundBounds } from '@/lib/overlay/physics-world';

enum Magics {
  // Die geometry, shared radius for all non-cube shapes
  DIE_RADIUS = 0.85,
  FALLBACK_SPHERE_RADIUS = 0.65,

  // Die material appearance
  MATERIAL_ROUGHNESS = 0.35,
  MATERIAL_METALNESS = 0.15,

  // Edge overlay drawn on top of each die face
  EDGE_OPACITY = 0.55,
  EDGE_THRESHOLD_ANGLE = 10,

  // Physics body initial motion
  LINEAR_DAMPING = 0.25,
  ANGULAR_DAMPING = 0.25,
  SLEEP_SPEED = 0.08,
  SLEEP_TIME = 0.5,

  // Spawn — bottom-right corner of the screen
  SPAWN_HEIGHT = 9,
  SPAWN_HEIGHT_RAND = 3,
  SPAWN_CORNER_FACTOR = 0.82,
  SPAWN_SCATTER = 2.5,

  // Throw — fixed comfortable speed aimed toward upper-left area
  THROW_SPEED = 12,
  THROW_VY = -2,
  THROW_SPIN = 14,
}

export interface DieObject {
  /** Three.js mesh used for rendering. */
  readonly mesh: THREE.Mesh;

  /** Cannon-es body used for physics simulation. */
  readonly body: CANNON.Body;

  /** Number of faces on this die. */
  readonly sides: DieSides;
}

const DIE_COLORS: Record<DieSides, number> = {
  4: 0xcc2222,
  6: 0xf5f0e8,
  8: 0x2266cc,
  10: 0x8833bb,
  12: 0x229955,
  20: 0xeef0ff,
  100: 0xcc7722,
};

export class DiceFactory {
  readonly #physicsMaterial: CANNON.Material;

  readonly #physicsGeoCache = new Map<DieSides, THREE.BufferGeometry>();

  readonly #bounds: GroundBounds;

  public constructor(physicsMaterial: CANNON.Material, bounds: GroundBounds) {
    this.#physicsMaterial = physicsMaterial;
    this.#bounds = bounds;
  }

  public createDie(sides: DieSides): DieObject {
    const s = clampSides(sides);
    const physicsGeo = this.#getPhysicsGeo(s);
    const mesh = this.#buildMesh(s, physicsGeo);
    const body = this.#buildBody(physicsGeo);

    return { mesh, body, sides: s };
  }

  public dispose(): void {
    for (const geo of this.#physicsGeoCache.values()) {
      geo.dispose();
    }

    this.#physicsGeoCache.clear();
  }

  #buildMesh(sides: DieSides, physicsGeo: THREE.BufferGeometry): THREE.Mesh {
    const color = DIE_COLORS[sides];
    const dark = isDark(color);
    const edgeColor = dark ? 0xffffff : 0x000000;

    const visualGeo = physicsGeo.toNonIndexed();
    visualGeo.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color,
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

    // Spawn near the bottom-right corner with small random scatter
    const spawnX = maxX * Magics.SPAWN_CORNER_FACTOR + (Math.random() - 0.5) * Magics.SPAWN_SCATTER;
    const spawnZ = maxZ * Magics.SPAWN_CORNER_FACTOR + (Math.random() - 0.5) * Magics.SPAWN_SCATTER;
    const spawnY = Magics.SPAWN_HEIGHT + Math.random() * Magics.SPAWN_HEIGHT_RAND;
    body.position.set(spawnX, spawnY, spawnZ);

    // Throw toward a random point in the upper-left area of the play field
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
    if (cached) {
      return cached;
    }

    const geo = buildGeometry(sides);
    this.#physicsGeoCache.set(sides, geo);
    return geo;
  }
}

function buildGeometry(sides: DieSides): THREE.BufferGeometry {
  switch (sides) {
    case 4:
      return new THREE.TetrahedronGeometry(Magics.DIE_RADIUS);
    case 6:
      return new THREE.BoxGeometry(1, 1, 1);
    case 8:
      return new THREE.OctahedronGeometry(Magics.DIE_RADIUS);
    case 10:
      return new DecagonGeometry(Magics.DIE_RADIUS);
    case 12:
      return new THREE.DodecahedronGeometry(Magics.DIE_RADIUS);
    case 20:
      return new THREE.IcosahedronGeometry(Magics.DIE_RADIUS);
    case 100:
      return new DecagonGeometry(Magics.DIE_RADIUS);
  }
}
