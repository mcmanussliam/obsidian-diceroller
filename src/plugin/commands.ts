import type { App } from 'obsidian';
import type DiceRollerPlugin from '@/main';
import { RollModal } from '@/ui/roll-modal';
import { DICE_SIDES } from '@/dice/registry';

export function registerCommands(plugin: DiceRollerPlugin, app: App): void {
  plugin.addCommand({
    id: 'open-roll-modal',
    name: 'Roll dice',
    callback: () => {
      new RollModal(app, (notation) => {
        plugin.overlay.roll(notation);
      }).open();
    },
  });

  for (const n of DICE_SIDES) {
    plugin.addCommand({
      id: `roll-d${n}`,
      name: `Roll d${n}`,
      callback: () => plugin.overlay.roll(`1d${n}`),
    });
  }
}
