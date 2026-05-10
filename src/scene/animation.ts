import * as CANNON from 'cannon-es';
import type { DieObject } from '@/dice/factory';
import type { PhysicsWorld } from '@/scene/physics';
import type { Renderer } from '@/scene/renderer';

const Magics = {
  FIXED_STEP: 1 / 60,
  SETTLE_CONFIRM_TIME: 0.7,
  DELTA_CAP: 0.1,
} as const;

export class AnimationController {
  readonly #physics: PhysicsWorld;

  readonly #renderer: Renderer;

  readonly #dice: readonly DieObject[];

  readonly #maxDuration: number;

  #rafHandle: number | null = null;

  #lastTime: number | null = null;

  #settleAccum = 0;

  #settled = false;

  #forceSettleTimer = 0;

  #onSettled: (() => void) | null = null;

  public constructor(
    physics: PhysicsWorld,
    renderer: Renderer,
    dice: readonly DieObject[],
    maxDuration: number
  ) {
    this.#physics = physics;
    this.#renderer = renderer;
    this.#dice = dice;
    this.#maxDuration = maxDuration;
  }

  public start(onSettled: () => void): void {
    this.#onSettled = onSettled;
    this.#settled = false;
    this.#lastTime = null;
    this.#settleAccum = 0;
    this.#forceSettleTimer = 0;
    this.#rafHandle = requestAnimationFrame(this.#tick);
  }

  public stop(): void {
    if (this.#rafHandle === null) {
      return;
    }

    cancelAnimationFrame(this.#rafHandle);
    this.#rafHandle = null;
  }

  #tick = (now: number): void => {
    if (this.#lastTime === null) {
      this.#lastTime = now;
      this.#rafHandle = requestAnimationFrame(this.#tick);
      return;
    }

    const rawDelta = (now - this.#lastTime) / 1000;
    this.#lastTime = now;
    const delta = Math.min(rawDelta, Magics.DELTA_CAP);

    this.#physics.step(Magics.FIXED_STEP, delta);
    this.#syncMeshes();
    this.#renderer.render();

    this.#forceSettleTimer += delta;

    if (!this.#settled) {
      if (this.#allSlow()) {
        this.#settleAccum += delta;
        if (this.#settleAccum >= Magics.SETTLE_CONFIRM_TIME) {
          this.#declare();
          return;
        }
      } else {
        this.#settleAccum = 0;
      }

      if (this.#forceSettleTimer >= this.#maxDuration) {
        this.#declare();
        return;
      }
    }

    this.#rafHandle = requestAnimationFrame(this.#tick);
  };

  #syncMeshes(): void {
    for (const { body, mesh } of this.#dice) {
      mesh.position.set(body.position.x, body.position.y, body.position.z);
      mesh.quaternion.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w
      );
    }
  }

  #allSlow(): boolean {
    return this.#dice.every(({ body }) => body.sleepState === CANNON.Body.SLEEPING);
  }

  #declare(): void {
    this.#settled = true;
    this.stop();
    this.#onSettled?.();
  }
}
