import type { DiceSkinDefinition, DiceSkinHandler } from '@/dice/skin/definition';

export class SkinRegistry {
  readonly #handlers = new Map<string, DiceSkinHandler>();

  public register(handler: DiceSkinHandler): void {
    this.#handlers.set(handler.definition.id, handler);
  }

  public get(id: string): DiceSkinHandler | undefined {
    return this.#handlers.get(id);
  }

  public getOrDefault(id: string): DiceSkinHandler {
    return this.#handlers.get(id) ?? (this.#handlers.values().next().value as DiceSkinHandler);
  }

  public list(): DiceSkinDefinition[] {
    return [...this.#handlers.values()].map((h) => h.definition);
  }
}

export const SKIN_REGISTRY = new SkinRegistry();
