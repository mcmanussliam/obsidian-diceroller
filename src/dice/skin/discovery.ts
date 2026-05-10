import type { Vault } from 'obsidian';
import type { DiceSkinDefinition } from '@/dice/skin/definition';
import { SKIN_REGISTRY } from '@/dice/skin/registry';
import { VaultAssetResolver } from '@/dice/skin/resolver';
import { AssetSkinHandler } from '@/dice/skin/handlers/asset';

const SKINS_ROOT = 'dice-skins';

export class VaultSkinDiscovery {
  readonly #vault: Vault;

  public constructor(vault: Vault) {
    this.#vault = vault;
  }

  public async discover(): Promise<void> {
    const exists = await this.#vault.adapter.exists(SKINS_ROOT);
    if (!exists) {
      return;
    }

    const { folders } = await this.#vault.adapter.list(SKINS_ROOT);
    await Promise.all(folders.map((folderPath) => this.#loadSkin(folderPath)));
  }

  async #loadSkin(folderPath: string): Promise<void> {
    const manifestPath = `${folderPath}/skin.json`;
    const exists = await this.#vault.adapter.exists(manifestPath);
    if (!exists) {
      return;
    }

    try {
      const json = await this.#vault.adapter.read(manifestPath);
      const definition = JSON.parse(json) as DiceSkinDefinition;
      if (!definition.id || !definition.name) {
        return;
      }

      const resolver = new VaultAssetResolver(this.#vault.adapter, folderPath);
      SKIN_REGISTRY.register(new AssetSkinHandler(definition, resolver));
    } catch {
      // Skip malformed manifests silently
    }
  }
}
