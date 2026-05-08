import type { App } from 'obsidian';
import type DiceRollerPlugin from '../main';
import { RollModal } from './ui/roll-modal';

export function registerCommands(plugin: DiceRollerPlugin, app: App): void {
  plugin.addCommand({
    id: 'open-roll-modal',
    name: 'Roll Dice',
    hotkeys: [{ modifiers: ['Alt', 'Shift'], key: 'r' }],
    callback: () => {
      new RollModal(app, (notation) => {
        plugin.overlay.roll(notation);
      }).open();
    },
  });

  plugin.addCommand({
    id: 'roll-d20',
    name: 'Roll d20',
    hotkeys: [{ modifiers: ['Alt'], key: 'r' }],
    callback: () => {
      plugin.overlay.roll('1d20');
    },
  });
}
