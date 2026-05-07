import * as CANNON from 'cannon-es';

enum Magics {
  // World setup
  GRAVITY = -28,

  // Solver, higher iterations = more accurate stacking at a CPU cost
  SOLVER_ITERATIONS = 12,
  SOLVER_SUBSTEPS = 5,

  // Ground/dice contact, controls bounce and slide feel
  GROUND_FRICTION = 0.55,
  GROUND_RESTITUTION = 0.38,

  // Dice/dice contact, gentler bounce when dice hit each other
  DICE_FRICTION = 0.4,
  DICE_RESTITUTION = 0.3,

  // Invisible bounding walls that keep dice on screen
  WALL_HALF_WIDTH = 11,
  WALL_HALF_DEPTH = 9,
  WALL_MID_HEIGHT = 5,
}

export class PhysicsWorld {
  readonly world: CANNON.World;

  private readonly groundMaterial: CANNON.Material;

  private readonly diceMaterial: CANNON.Material;

  public constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, Magics.GRAVITY, 0),
    });

    this.world.broadphase = new CANNON.NaiveBroadphase();
    (this.world.solver as CANNON.GSSolver).iterations = Magics.SOLVER_ITERATIONS;
    this.world.allowSleep = true;

    this.groundMaterial = new CANNON.Material('ground');
    this.diceMaterial = new CANNON.Material('dice');

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.groundMaterial, this.diceMaterial, {
        friction: Magics.GROUND_FRICTION,
        restitution: Magics.GROUND_RESTITUTION,
      })
    );

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.diceMaterial, this.diceMaterial, {
        friction: Magics.DICE_FRICTION,
        restitution: Magics.DICE_RESTITUTION,
      })
    );

    this.addGround();
    this.addWalls();
  }

  get dicePhysicsMaterial(): CANNON.Material {
    return this.diceMaterial;
  }

  step(fixedStep: number, deltaTime: number): void {
    this.world.step(fixedStep, deltaTime, Magics.SOLVER_SUBSTEPS);
  }

  addBody(body: CANNON.Body): void {
    this.world.addBody(body);
  }

  removeBody(body: CANNON.Body): void {
    this.world.removeBody(body);
  }

  dispose(): void {
    // cannon-es has no formal dispose; dropping the reference is sufficient.
  }

  private addGround(): void {
    const ground = new CANNON.Body({ mass: 0, material: this.groundMaterial });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    ground.position.set(0, 0, 0);
    this.world.addBody(ground);
  }

  private addWalls(): void {
    const wallDefs: Array<{ pos: CANNON.Vec3; euler: [number, number, number] }> = [
      {
        pos: new CANNON.Vec3(-Magics.WALL_HALF_WIDTH, Magics.WALL_MID_HEIGHT, 0),
        euler: [0, Math.PI / 2, 0],
      },
      {
        pos: new CANNON.Vec3(Magics.WALL_HALF_WIDTH, Magics.WALL_MID_HEIGHT, 0),
        euler: [0, -Math.PI / 2, 0],
      },
      {
        pos: new CANNON.Vec3(0, Magics.WALL_MID_HEIGHT, -Magics.WALL_HALF_DEPTH),
        euler: [0, 0, 0],
      },
      {
        pos: new CANNON.Vec3(0, Magics.WALL_MID_HEIGHT, Magics.WALL_HALF_DEPTH),
        euler: [0, Math.PI, 0],
      },
    ];

    for (const { pos, euler } of wallDefs) {
      const wall = new CANNON.Body({ mass: 0, material: this.groundMaterial });
      wall.addShape(new CANNON.Plane());
      wall.position.copy(pos);
      wall.quaternion.setFromEuler(...euler);
      this.world.addBody(wall);
    }
  }
}
