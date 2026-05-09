import type { App } from 'obsidian';
import type { DiceRollerSettings } from '@/lib/settings/plugin-settings';
import { clampSides, extractGroups, parseAndRoll } from '@/lib/parser/dice-parser';
import { ResultDisplay } from '@/lib/ui/result-display';
import { AnimationController } from '@/lib/overlay/animation-controller';
import { DiceFactory, type DieObject } from '@/lib/overlay/dice-factory';
import { PhysicsWorld } from '@/lib/overlay/physics-world';
import { Renderer } from '@/lib/overlay/renderer';

enum Magics {
  // Overlay fade animation
  FADE_DURATION_MS = 350,

  // Extra wait after result display before tearing down, gives the user time to read
  TEARDOWN_EXTRA_S = 0.6,
}

export class DiceOverlay {
  readonly #app: App;

  readonly #settings: DiceRollerSettings;

  #overlayEl: HTMLElement | null = null;

  #renderer: Renderer | null = null;

  #physics: PhysicsWorld | null = null;

  #factory: DiceFactory | null = null;

  #animation: AnimationController | null = null;

  #resultDisplay: ResultDisplay | null = null;

  #dice: DieObject[] = [];

  #active = false;

  public constructor(app: App, settings: DiceRollerSettings) {
    this.#app = app;
    this.#settings = settings;
  }

  public roll(notation: string): void {
    if (this.#active) this.destroy();

    const result = parseAndRoll(notation);
    const groups = extractGroups(notation);
    if (groups.length === 0) {
      return;
    }

    this.#build();
    this.#spawnDice(groups);
    this.#fadeIn();

    this.#animation?.start(() => {
      this.#onSettled(result.total, result.output, notation);
    });
  }

  public destroy(): void {
    this.#animation?.stop();
    this.#animation = null;
    this.#resultDisplay?.dispose();
    this.#resultDisplay = null;

    for (const die of this.#dice) {
      this.#physics?.removeBody(die.body);
    }
    this.#dice = [];

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
    this.#overlayEl = document.body.createDiv({ cls: 'dice-overlay dice-overlay--hidden' });
    this.#renderer = new Renderer(this.#overlayEl, this.#settings.shadowQuality);
    const bounds = this.#renderer.getGroundBounds();
    this.#physics = new PhysicsWorld(bounds);
    this.#factory = new DiceFactory(this.#physics.dicePhysicsMaterial, bounds);
    this.#resultDisplay = new ResultDisplay(this.#overlayEl);
    this.#active = true;
  }

  #spawnDice(groups: ReturnType<typeof extractGroups>): void {
    if (!this.#factory || !this.#physics || !this.#renderer) {
      return;
    }

    for (const group of groups) {
      const sides = clampSides(group.sides);
      for (let i = 0; i < group.count; i++) {
        const die = this.#factory.createDie(sides);
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

  #onSettled(total: number, output: string, notation: string): void {
    this.#resultDisplay?.show({ notation, total, output }, this.#settings.resultDisplayDuration);

    if (this.#settings.autoInsertResult) {
      this.#insertResult(output);
    }

    const teardownMs =
      (this.#settings.resultDisplayDuration + Magics.TEARDOWN_EXTRA_S) * 1000 +
      Magics.FADE_DURATION_MS;

    setTimeout(() => {
      this.#fadeOut(() => this.destroy());
    }, teardownMs);
  }

  #insertResult(output: string): void {
    const editor = this.#app.workspace.activeEditor?.editor;
    if (!editor) return;

    const cursor = editor.getCursor();
    editor.replaceRange(`\n${output}`, cursor);
  }

  #fadeIn(): void {
    if (!this.#overlayEl) return;
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
    setTimeout(() => cb?.(), Magics.FADE_DURATION_MS);
  }
}
