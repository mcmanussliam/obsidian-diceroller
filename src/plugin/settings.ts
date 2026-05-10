import { type App, PluginSettingTab, Setting } from 'obsidian';
import type DiceRollerPlugin from '@/main';

export interface DiceRollerSettings {
  /** Maximum seconds before dice are force-settled regardless of motion. */
  animationDuration: number;

  /** Seconds the result card remains visible before fading out. */
  resultDisplayDuration: number;

  /** Shadow-map resolution tier — higher costs more GPU. */
  shadowQuality: 'low' | 'medium' | 'high';
}

export const DEFAULT_SETTINGS: DiceRollerSettings = {
  animationDuration: 8,
  resultDisplayDuration: 3,
  shadowQuality: 'medium',
};

export class DiceRollerSettingTab extends PluginSettingTab {
  public readonly plugin: DiceRollerPlugin;

  public constructor(app: App, plugin: DiceRollerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  public display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Max animation duration')
      .setDesc('Seconds before dice are force-settled (2–15).')
      .addSlider((slider) =>
        slider
          .setLimits(2, 15, 1)
          .setValue(this.plugin.settings.animationDuration)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.animationDuration = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Result display duration')
      .setDesc('Seconds the result stays visible before fading.')
      .addSlider((slider) =>
        slider
          .setLimits(1, 10, 0.5)
          .setValue(this.plugin.settings.resultDisplayDuration)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.resultDisplayDuration = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Shadow quality')
      .setDesc('Higher quality costs more GPU.')
      .addDropdown((drop) =>
        drop
          .addOption('low', 'Low')
          .addOption('medium', 'Medium')
          .addOption('high', 'High')
          .setValue(this.plugin.settings.shadowQuality)
          .onChange(async (value) => {
            this.plugin.settings.shadowQuality = value as DiceRollerSettings['shadowQuality'];
            await this.plugin.saveSettings();
          })
      );
  }
}
