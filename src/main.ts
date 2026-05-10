import { Plugin } from 'obsidian';
import '@/styles/styles.css';
import { DEFAULT_SETTINGS, DiceRollerSettingTab, type DiceRollerSettings } from '@/plugin/settings';
import { registerCommands } from '@/plugin/commands';
import { DiceOverlay } from '@/dice/overlay';
import { SKIN_REGISTRY } from '@/dice/skin/registry';
import { ProceduralSkinHandler, DEFAULT_SKIN } from '@/dice/skin/handlers/procedural';
import { VaultSkinDiscovery } from '@/dice/skin/discovery';

export default class DiceRollerPlugin extends Plugin {
  public settings!: DiceRollerSettings;

  public overlay!: DiceOverlay;

  public async onload(): Promise<void> {
    await this.loadSettings();
    await this.#initSkins();

    this.overlay = new DiceOverlay(this.settings);
    registerCommands(this, this.app);
    this.addSettingTab(new DiceRollerSettingTab(this.app, this));
  }

  public onunload(): void {
    this.overlay.disposeAll();
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
    this.overlay.disposeAll();
    this.overlay = new DiceOverlay(this.settings);
  }

  async #initSkins(): Promise<void> {
    SKIN_REGISTRY.register(new ProceduralSkinHandler(DEFAULT_SKIN));
    await new VaultSkinDiscovery(this.app.vault).discover();
  }
}
