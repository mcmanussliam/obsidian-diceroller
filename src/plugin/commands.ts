import type { App, Editor } from 'obsidian';
import type DiceRollerPlugin from '@/main';
import { RollModal } from '@/ui/roll-modal';
import { DICE_SIDES } from '@/dice/registry';
import { validateNotation } from '@/dice/parser';

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

  plugin.registerEvent(
    app.workspace.on('editor-menu', (menu, editor: Editor) => {
      const selection = editor.getSelection().trim();
      if (!selection || !validateNotation(selection)) {
        return;
      }

      menu.addItem((item) => {
        item
          .setTitle('Roll dice')
          .setIcon('dice')
          .onClick(() => plugin.overlay.roll(selection));
      });
    })
  );

  for (const n of DICE_SIDES) {
    plugin.addCommand({
      id: `roll-d${n}`,
      name: `Roll d${n}`,
      callback: () => plugin.overlay.roll(`1d${n}`),
    });
  }
}
