const RESULT_FADE_MS = 600;

export interface RollResult {
  /** Original dice notation string (e.g. "2d6+3"). */
  readonly notation: string;

  /** Final numeric total. */
  readonly total: number;

  /** Human-readable breakdown string. */
  readonly output: string;
}

export class ResultDisplay {
  readonly #el: HTMLElement;

  #fadeOutTimer: ReturnType<typeof setTimeout> | null = null;

  #removeTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(container: HTMLElement) {
    this.#el = container.createDiv({ cls: 'dice-result-display' });
  }

  public show(result: RollResult, displayDurationSeconds: number): void {
    this.#clearTimers();

    this.#el.empty();
    this.#el.createEl('div', {
      cls: 'dice-result-display__total',
      text: String(result.total),
    });
    this.#el.createEl('div', {
      cls: 'dice-result-display__breakdown',
      text: result.output,
    });

    this.#el.removeClass('dice-result-display--hidden');
    this.#el.addClass('dice-result-display--visible');

    const displayMs = displayDurationSeconds * 1000;

    this.#fadeOutTimer = setTimeout(() => {
      this.#el.removeClass('dice-result-display--visible');
      this.#el.addClass('dice-result-display--fading');

      this.#removeTimer = setTimeout(() => {
        this.#el.addClass('dice-result-display--hidden');
        this.#el.removeClass('dice-result-display--fading');
      }, RESULT_FADE_MS);
    }, displayMs);
  }

  public dispose(): void {
    this.#clearTimers();
    this.#el.remove();
  }

  #clearTimers(): void {
    if (this.#fadeOutTimer !== null) {
      clearTimeout(this.#fadeOutTimer);
      this.#fadeOutTimer = null;
    }

    if (this.#removeTimer !== null) {
      clearTimeout(this.#removeTimer);
      this.#removeTimer = null;
    }
  }
}
