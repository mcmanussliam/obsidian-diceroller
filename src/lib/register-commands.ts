import type { App } from 'obsidian';
import type DiceRollerPlugin from '@/main';
import { RollModal } from '@/lib/ui/roll-modal';

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

  for (const n of [4, 6, 8, 10, 12, 20, 100]) {
    plugin.addCommand({
      id: `roll-d${n}`,
      name: `Roll d${n}`,
      callback: () => plugin.overlay.roll(`1d${n}`),
    });
  }
}
