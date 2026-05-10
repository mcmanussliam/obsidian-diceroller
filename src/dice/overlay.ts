import { Notice } from 'obsidian';
import type { DiceRollerSettings } from '@/plugin/settings';
import { parseDice, type ParsedDice } from '@/dice/parser';
import { clampSides, type DieSides } from '@/dice/registry';
import { AnimationController } from '@/scene/animation';
import { DiceFactory, type DieObject } from '@/dice/factory';
import { PhysicsWorld } from '@/scene/physics';
import { Renderer } from '@/scene/renderer';

const Magics = {
  FADE_DURATION_MS: 350,
  TEARDOWN_EXTRA_MS: 600,
  ROLL_DEBOUNCE_MS: 1000,
} as const;

export class DiceOverlay {
  readonly #settings: DiceRollerSettings;

  #overlayEl: HTMLElement | null = null;

  #renderer: Renderer | null = null;

  #physics: PhysicsWorld | null = null;

  #factory: DiceFactory | null = null;

  #animation: AnimationController | null = null;

  #dice: DieObject[] = [];

  #diceGroups: { sides: DieSides; count: number }[] = [];

  #modifier = 0;

  #active = false;

  #rollStartTime = 0;

  public constructor(settings: DiceRollerSettings) {
    this.#settings = settings;
  }

  public roll(notation: string): void {
    if (this.#active) {
      if (Date.now() - this.#rollStartTime < Magics.ROLL_DEBOUNCE_MS) {
        return;
      }
      this.destroy();
    }

    this.#rollStartTime = Date.now();

    const parsed = parseDice(notation);
    if (parsed.groups.length === 0) {
      return;
    }

    this.#build();
    this.#spawnDice(parsed);
    this.#fadeIn();

    this.#animation?.start(() => {
      if (this.#active) {
        const { total, output } = this.#computeResults();
        this.#onSettled(total, output);
      }
    });
  }

  public destroy(): void {
    this.#animation?.stop();
    this.#animation = null;

    for (const die of this.#dice) {
      this.#physics?.removeBody(die.body);
    }

    this.#dice = [];
    this.#diceGroups = [];

    this.#renderer?.dispose();
    this.#renderer = null;
    this.#physics?.dispose();
    this.#physics = null;
    this.#factory?.dispose();
    this.#factory = null;

    this.#overlayEl?.remove();
    this.#overlayEl = null;

    this.#active = false;
  }

  #build(): void {
    this.#overlayEl = activeDocument.body.createDiv({ cls: 'dice-overlay dice-overlay--hidden' });
    this.#renderer = new Renderer(this.#overlayEl, this.#settings.shadowQuality);
    const bounds = this.#renderer.getGroundBounds();
    this.#physics = new PhysicsWorld(bounds);
    this.#factory = new DiceFactory(this.#physics.dicePhysicsMaterial, bounds);
    this.#active = true;
  }

  #spawnDice(parsed: ParsedDice): void {
    if (!this.#factory || !this.#physics || !this.#renderer) {
      return;
    }

    this.#diceGroups = parsed.groups.map((g) => ({ sides: clampSides(g.sides), count: g.count }));
    this.#modifier = parsed.modifier;

    for (const group of this.#diceGroups) {
      for (let i = 0; i < group.count; i++) {
        const die = this.#factory.createDie(group.sides);
        this.#physics.addBody(die.body);
        this.#renderer.scene.add(die.mesh);
        this.#dice.push(die);
      }
    }

    this.#animation = new AnimationController(
      this.#physics,
      this.#renderer,
      this.#dice,
      this.#settings.animationDuration
    );
  }

  #computeResults(): { total: number; output: string } {
    let dieIdx = 0;
    let diceTotal = 0;
    const parts: string[] = [];

    for (const group of this.#diceGroups) {
      const values: number[] = [];
      for (let i = 0; i < group.count; i++) {
        const die = this.#dice[dieIdx++];
        if (die) {
          const value = die.readResult(die.mesh);
          values.push(value);
          diceTotal += value;
        }
      }
      parts.push(`${group.count}d${group.sides}: [${values.join(', ')}]`);
    }

    const total = diceTotal + this.#modifier;
    let output = parts.join(' + ');
    if (this.#modifier > 0) output += ` + ${this.#modifier}`;
    else if (this.#modifier < 0) output += ` - ${Math.abs(this.#modifier)}`;
    output += ` = ${total}`;

    return { total, output };
  }

  #onSettled(total: number, output: string): void {
    const fragment = new DocumentFragment();
    fragment.createDiv({ cls: 'dice-notice__total', text: String(total) });
    fragment.createDiv({ cls: 'dice-notice__breakdown', text: output });
    new Notice(fragment, this.#settings.resultDisplayDuration * 1000);

    activeWindow.setTimeout(() => {
      this.#fadeOut(() => this.destroy());
    }, Magics.TEARDOWN_EXTRA_MS);
  }

  #fadeIn(): void {
    if (!this.#overlayEl) {
      return;
    }
    this.#overlayEl.removeClass('dice-overlay--hidden');
    this.#overlayEl.addClass('dice-overlay--visible');
  }

  #fadeOut(cb?: () => void): void {
    if (!this.#overlayEl) {
      cb?.();
      return;
    }
    this.#overlayEl.removeClass('dice-overlay--visible');
    this.#overlayEl.addClass('dice-overlay--fading');
    activeWindow.setTimeout(() => cb?.(), Magics.FADE_DURATION_MS);
  }
}
