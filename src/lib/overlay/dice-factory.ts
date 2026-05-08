import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { clampSides, type DieSides } from '../parser/dice-parser';
import { isDark } from '../../utils/color';
import { geomToConvex } from '../../utils/three-utils';
import { DecagonGeometry } from '../geometry/decagon-geometry';

enum Magics {
  // Die geometry, shared radius for all non-cube shapes
  DIE_RADIUS = 0.85,
  BOX_HALF_EXTENT = 0.5,
  FALLBACK_SPHERE_RADIUS = 0.65,

  // Die material appearance
  MATERIAL_ROUGHNESS = 0.35,
  MATERIAL_METALNESS = 0.15,

  // Edge overlay drawn on top of each die face
  EDGE_OPACITY = 0.55,
  EDGE_THRESHOLD_ANGLE = 10,

  // Physics body initial motion
  SPAWN_X_SPREAD = 16,
  SPAWN_Y_BASE = 10,
  SPAWN_Y_RAND = 4,
  SPAWN_Z_SPREAD = 5,
  LINEAR_DAMPING = 0.25,
  ANGULAR_DAMPING = 0.25,
  SLEEP_SPEED = 0.08,
  SLEEP_TIME = 0.5,
  SPIN_SCALE = 18,
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
  private readonly physicsMaterial: CANNON.Material;

  private readonly physicsGeoCache = new Map<DieSides, THREE.BufferGeometry>();

  public constructor(physicsMaterial: CANNON.Material) {
    this.physicsMaterial = physicsMaterial;
  }

  public createDie(sides: DieSides, intensity: number): DieObject {
    const s = clampSides(sides);
    const physicsGeo = this.getPhysicsGeo(s);
    const mesh = this.buildMesh(s, physicsGeo);
    const body = this.buildBody(s, physicsGeo, intensity);

    return { mesh, body, sides: s };
  }

  public dispose(): void {
    for (const geo of this.physicsGeoCache.values()) {
      geo.dispose();
    }

    this.physicsGeoCache.clear();
  }

  private buildMesh(sides: DieSides, physicsGeo: THREE.BufferGeometry): THREE.Mesh {
    const color = DIE_COLORS[sides];
    const dark = isDark(color);
    const edgeColor = dark ? 0xffffff : 0x000000;

    let visualGeo: THREE.BufferGeometry;
    let material: THREE.Material | THREE.Material[];

    visualGeo = physicsGeo.toNonIndexed();
    visualGeo.computeVertexNormals();
    material = new THREE.MeshStandardMaterial({
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

  private buildBody(
    sides: DieSides,
    physicsGeo: THREE.BufferGeometry,
    intensity: number
  ): CANNON.Body {
    const body = new CANNON.Body({
      mass: 1,
      material: this.physicsMaterial,
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

    const spawnX = (Math.random() - 0.5) * Magics.SPAWN_X_SPREAD;
    const spawnY = Magics.SPAWN_Y_BASE + Math.random() * Magics.SPAWN_Y_RAND;
    const spawnZ = (Math.random() - 0.5) * Magics.SPAWN_Z_SPREAD;
    body.position.set(spawnX, spawnY, spawnZ);

    const vx = (-spawnX * 0.4 + (Math.random() - 0.5) * 4) * intensity;
    const vy = (-3 - Math.random() * 3) * intensity;
    const vz = (Math.random() - 0.5) * 4 * intensity;
    body.velocity.set(vx, vy, vz);

    const spin = Magics.SPIN_SCALE * intensity;
    body.angularVelocity.set(
      (Math.random() - 0.5) * spin,
      (Math.random() - 0.5) * spin,
      (Math.random() - 0.5) * spin
    );

    return body;
  }

  private getPhysicsGeo(sides: DieSides): THREE.BufferGeometry {
    const cached = this.physicsGeoCache.get(sides);
    if (cached) {
      return cached;
    }

    const geo = buildGeometry(sides);
    this.physicsGeoCache.set(sides, geo);
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
