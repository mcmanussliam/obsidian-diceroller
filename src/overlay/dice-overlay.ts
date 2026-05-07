import type { App } from 'obsidian';
import type { DiceRollerSettings } from '../settings/plugin-settings';
import { clampSides, extractGroups, parseAndRoll } from '../parser/dice-parser';
import { ResultDisplay } from '../ui/result-display';
import { AnimationController } from './animation-controller';
import { DiceFactory, type DieObject } from './dice-factory';
import { PhysicsWorld } from './physics-world';
import { Renderer } from './renderer';

enum Magics {
  // Overlay fade animation
  FADE_DURATION_MS = 350,

  // Extra wait after result display before tearing down, gives the user time to read
  TEARDOWN_EXTRA_S = 0.6,
}

export class DiceOverlay {
  private overlayEl: HTMLElement | null = null;

  private renderer: Renderer | null = null;

  private physics: PhysicsWorld | null = null;

  private factory: DiceFactory | null = null;

  private animation: AnimationController | null = null;

  private resultDisplay: ResultDisplay | null = null;

  private dice: DieObject[] = [];

  private active = false;

  constructor(
    private readonly app: App,
    private readonly settings: DiceRollerSettings
  ) {}

  roll(notation: string): void {
    if (this.active) this.destroy();

    const result = parseAndRoll(notation);
    const groups = extractGroups(notation);
    if (groups.length === 0) {
      return;
    }

    this.build();
    this.spawnDice(groups);
    this.fadeIn();

    this.animation?.start(() => {
      this.onSettled(result.total, result.output, notation);
    });
  }

  destroy(): void {
    this.animation?.stop();
    this.animation = null;
    this.resultDisplay?.dispose();
    this.resultDisplay = null;

    for (const die of this.dice) {
      this.physics?.removeBody(die.body);
    }
    this.dice = [];

    this.renderer?.dispose();
    this.renderer = null;
    this.physics?.dispose();
    this.physics = null;
    this.factory?.dispose();
    this.factory = null;

    this.overlayEl?.remove();
    this.overlayEl = null;

    this.active = false;
  }

  private build(): void {
    this.overlayEl = document.body.createDiv({ cls: 'dice-overlay dice-overlay--hidden' });
    this.renderer = new Renderer(this.overlayEl, this.settings.shadowQuality);
    this.physics = new PhysicsWorld();
    this.factory = new DiceFactory(this.physics.dicePhysicsMaterial);
    this.resultDisplay = new ResultDisplay(this.overlayEl);
    this.active = true;
  }

  private spawnDice(groups: ReturnType<typeof extractGroups>): void {
    if (!this.factory || !this.physics || !this.renderer) {
      return;
    }

    for (const group of groups) {
      const sides = clampSides(group.sides);
      for (let i = 0; i < group.count; i++) {
        const die = this.factory.createDie(sides, this.settings.physicsIntensity);
        this.physics.addBody(die.body);
        this.renderer.scene.add(die.mesh);
        this.dice.push(die);
      }
    }

    this.animation = new AnimationController(
      this.physics,
      this.renderer,
      this.dice,
      this.settings.animationDuration,
    );
  }

  private onSettled(total: number, output: string, notation: string): void {
    this.resultDisplay?.show({ notation, total, output }, this.settings.resultDisplayDuration);

    if (this.settings.autoInsertResult) {
      this.insertResult(output);
    }

    const teardownMs =
      (this.settings.resultDisplayDuration + Magics.TEARDOWN_EXTRA_S) * 1000 +
      Magics.FADE_DURATION_MS;

    setTimeout(() => {
      this.fadeOut(() => this.destroy());
    }, teardownMs);
  }

  private insertResult(output: string): void {
    const editor = this.app.workspace.activeEditor?.editor;
    if (!editor) return;

    const cursor = editor.getCursor();
    editor.replaceRange(`\n${output}`, cursor);
  }

  private fadeIn(): void {
    if (!this.overlayEl) return;
    this.overlayEl.removeClass('dice-overlay--hidden');
    this.overlayEl.addClass('dice-overlay--visible');
  }

  private fadeOut(cb?: () => void): void {
    if (!this.overlayEl) {
      cb?.();
      return;
    }
    this.overlayEl.removeClass('dice-overlay--visible');
    this.overlayEl.addClass('dice-overlay--fading');
    setTimeout(() => cb?.(), Magics.FADE_DURATION_MS);
  }
}
