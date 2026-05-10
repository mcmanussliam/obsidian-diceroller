import type { App, Editor } from 'obsidian';
import type DiceRollerPlugin from '@/main';
import { RollModal } from '@/ui/roll-modal';
import { DICE_SIDES } from '@/dice/registry';
import { validateNotation, resolveVariables } from '@/dice/parser';

function getFrontmatter(app: App): Record<string, unknown> {
  const file = app.workspace.getActiveFile();
  if (!file) return {};
  return (app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
}

function makeResolver(app: App): (raw: string) => string {
  return (raw) => resolveVariables(raw, getFrontmatter(app));
}

export function registerCommands(plugin: DiceRollerPlugin, app: App): void {
  plugin.addCommand({
    id: 'open-roll-modal',
    name: 'Roll dice',
    callback: () => {
      const resolve = makeResolver(app);
      new RollModal(app, (notation) => plugin.overlay.roll(notation), resolve).open();
    },
  });

  plugin.registerEvent(
    app.workspace.on('editor-menu', (menu, editor: Editor) => {
      const selection = editor.getSelection().trim();
      if (!selection) return;

      const resolved = resolveVariables(selection, getFrontmatter(app));
      if (!validateNotation(resolved)) return;

      menu.addItem((item) => {
        item
          .setTitle('Roll dice')
          .setIcon('dice')
          .onClick(() => plugin.overlay.roll(resolved));
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
