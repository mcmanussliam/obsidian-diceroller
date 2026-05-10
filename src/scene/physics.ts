import * as CANNON from 'cannon-es';

const Magics = {
  GRAVITY: -28,
  SOLVER_ITERATIONS: 12,
  SOLVER_SUBSTEPS: 5,
  GROUND_FRICTION: 0.55,
  GROUND_RESTITUTION: 0.38,
  DICE_FRICTION: 0.4,
  DICE_RESTITUTION: 0.3,
} as const;

export interface GroundBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export class PhysicsWorld {
  readonly #world: CANNON.World;

  readonly #groundMaterial: CANNON.Material;

  readonly #diceMaterial: CANNON.Material;

  public constructor(bounds: GroundBounds) {
    this.#world = new CANNON.World({
      gravity: new CANNON.Vec3(0, Magics.GRAVITY, 0),
    });

    this.#world.broadphase = new CANNON.NaiveBroadphase();
    (this.#world.solver as CANNON.GSSolver).iterations = Magics.SOLVER_ITERATIONS;
    this.#world.allowSleep = true;

    this.#groundMaterial = new CANNON.Material('ground');
    this.#diceMaterial = new CANNON.Material('dice');

    this.#world.addContactMaterial(
      new CANNON.ContactMaterial(this.#groundMaterial, this.#diceMaterial, {
        friction: Magics.GROUND_FRICTION,
        restitution: Magics.GROUND_RESTITUTION,
      })
    );

    this.#world.addContactMaterial(
      new CANNON.ContactMaterial(this.#diceMaterial, this.#diceMaterial, {
        friction: Magics.DICE_FRICTION,
        restitution: Magics.DICE_RESTITUTION,
      })
    );

    this.#addGround();
    this.#addWalls(bounds);
  }

  public get dicePhysicsMaterial(): CANNON.Material {
    return this.#diceMaterial;
  }

  public step(fixedStep: number, deltaTime: number): void {
    this.#world.step(fixedStep, deltaTime, Magics.SOLVER_SUBSTEPS);
  }

  public addBody(body: CANNON.Body): void {
    this.#world.addBody(body);
  }

  public removeBody(body: CANNON.Body): void {
    this.#world.removeBody(body);
  }

  public dispose(): void {
    // cannon-es has no formal dispose; dropping the reference is sufficient.
  }

  #addGround(): void {
    const ground = new CANNON.Body({ mass: 0, material: this.#groundMaterial });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.#world.addBody(ground);
  }

  #addWalls(bounds: GroundBounds): void {
    const wallDefs: Array<{ pos: CANNON.Vec3; euler: [number, number, number] }> = [
      // Left wall — normal faces +X (inward)
      { pos: new CANNON.Vec3(bounds.minX, 0, 0), euler: [0, Math.PI / 2, 0] },
      // Right wall — normal faces -X (inward)
      { pos: new CANNON.Vec3(bounds.maxX, 0, 0), euler: [0, -Math.PI / 2, 0] },
      // Top wall (screen top, minZ) — normal faces +Z (inward)
      { pos: new CANNON.Vec3(0, 0, bounds.minZ), euler: [0, 0, 0] },
      // Bottom wall (screen bottom, maxZ) — normal faces -Z (inward)
      { pos: new CANNON.Vec3(0, 0, bounds.maxZ), euler: [0, Math.PI, 0] },
    ];

    for (const { pos, euler } of wallDefs) {
      const wall = new CANNON.Body({ mass: 0, material: this.#groundMaterial });
      wall.addShape(new CANNON.Plane());
      wall.position.copy(pos);
      wall.quaternion.setFromEuler(...euler);
      this.#world.addBody(wall);
    }
  }
}
