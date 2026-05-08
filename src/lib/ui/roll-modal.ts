import { type App, Modal, Setting } from 'obsidian';
import { validateNotation } from '@/lib/parser/dice-parser';

const QUICK_PICKS = ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '1d100'] as const;
const FOCUS_DELAY_MS = 50;

export class RollModal extends Modal {
  private notation = '';

  private readonly onRoll: (notation: string) => void;

  private errorEl: HTMLElement | null = null;

  constructor(app: App, onRoll: (notation: string) => void) {
    super(app);
    this.onRoll = onRoll;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('dice-roller-modal');

    contentEl.createEl('h2', { text: 'Roll Dice' });
    contentEl.createEl('p', {
      text: 'Enter dice notation: 1d20, 2d6+3, 4d6kh3, …',
      cls: 'dice-roller-modal__hint',
    });

    new Setting(contentEl).setName('Notation').addText((text) => {
      text
        .setPlaceholder('e.g. 2d6+3')
        .setValue(this.notation)
        .onChange((value) => {
          this.notation = value.trim();
          this.clearError();
        });

      text.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.submit();
      });

      setTimeout(() => text.inputEl.focus(), FOCUS_DELAY_MS);
    });

    this.errorEl = contentEl.createEl('p', {
      cls: 'dice-roller-modal__error',
      text: '',
    });

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText('Roll')
        .setCta()
        .onClick(() => this.submit())
    );

    const quickPick = contentEl.createDiv({ cls: 'dice-roller-modal__quickpick' });
    quickPick.createEl('span', { text: 'Quick roll:' });

    for (const pick of QUICK_PICKS) {
      quickPick
        .createEl('button', { text: pick, cls: 'dice-roller-modal__chip' })
        .addEventListener('click', () => {
          this.notation = pick;
          this.submit();
        });
    }
  }

  private submit(): void {
    if (!this.notation) {
      this.showError('Please enter a dice notation.');
      return;
    }

    if (!validateNotation(this.notation)) {
      this.showError(`"${this.notation}" is not valid dice notation.`);
      return;
    }

    this.close();
    this.onRoll(this.notation);
  }

  private showError(msg: string): void {
    this.errorEl?.setText(msg);
  }

  private clearError(): void {
    this.errorEl?.setText('');
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
