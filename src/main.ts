import { Plugin } from 'obsidian';
import '@/styles/styles.css';
import {
  DEFAULT_SETTINGS,
  DiceRollerSettingTab,
  type DiceRollerSettings,
} from '@/plugin/settings';
import { registerCommands } from '@/plugin/commands';
import { DiceOverlay } from '@/dice/overlay';

export default class DiceRollerPlugin extends Plugin {
  public settings!: DiceRollerSettings;

  public overlay!: DiceOverlay;

  public async onload(): Promise<void> {
    await this.loadSettings();

    this.overlay = new DiceOverlay(this.settings);
    registerCommands(this, this.app);
    this.addSettingTab(new DiceRollerSettingTab(this.app, this));
  }

  public onunload(): void {
    this.overlay.destroy();
  }

  public async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<DiceRollerSettings>
    );
  }

  public async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.overlay.destroy();
    this.overlay = new DiceOverlay(this.settings);
  }
}
