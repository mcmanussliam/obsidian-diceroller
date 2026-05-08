import type { DieObject } from '@/lib/overlay/dice-factory';
import type { PhysicsWorld } from '@/lib/overlay/physics-world';
import type { Renderer } from '@/lib/overlay/renderer';

enum Magics {
  FIXED_STEP = 1 / 60,

  SETTLE_SPEED = 0.06,
  SETTLE_ANGULAR = 0.08,
  SETTLE_CONFIRM_TIME = 0.7,

  DELTA_CAP = 0.1,
}

export class AnimationController {
  private rafHandle: number | null = null;

  private lastTime: number | null = null;

  private settleAccum = 0;

  private settled = false;

  private forceSettleTimer = 0;

  private onSettled: (() => void) | null = null;

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly renderer: Renderer,
    private readonly dice: readonly DieObject[],
    private readonly maxDuration: number
  ) {}

  start(onSettled: () => void): void {
    this.onSettled = onSettled;
    this.settled = false;
    this.lastTime = null;
    this.settleAccum = 0;
    this.forceSettleTimer = 0;
    this.rafHandle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.rafHandle === null) {
      return;
    }

    cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
  }

  private tick = (now: number): void => {
    if (this.lastTime === null) {
      this.lastTime = now;
      this.rafHandle = requestAnimationFrame(this.tick);
      return;
    }

    const rawDelta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const delta = Math.min(rawDelta, Magics.DELTA_CAP);

    this.physics.step(Magics.FIXED_STEP, delta);
    this.syncMeshes();
    this.renderer.render();

    this.forceSettleTimer += delta;

    if (!this.settled) {
      if (this.allSlow()) {
        this.settleAccum += delta;
        if (this.settleAccum >= Magics.SETTLE_CONFIRM_TIME) {
          this.declare();
          return;
        }
      } else {
        this.settleAccum = 0;
      }

      if (this.forceSettleTimer >= this.maxDuration) {
        this.declare();
        return;
      }
    }

    this.rafHandle = requestAnimationFrame(this.tick);
  };

  private syncMeshes(): void {
    for (const { body, mesh } of this.dice) {
      mesh.position.set(body.position.x, body.position.y, body.position.z);
      mesh.quaternion.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w
      );
    }
  }

  private allSlow(): boolean {
    return this.dice.every(
      ({ body }) =>
        body.velocity.length() < Magics.SETTLE_SPEED &&
        body.angularVelocity.length() < Magics.SETTLE_ANGULAR
    );
  }

  private declare(): void {
    this.settled = true;
    this.stop();
    this.onSettled?.();
  }
}
