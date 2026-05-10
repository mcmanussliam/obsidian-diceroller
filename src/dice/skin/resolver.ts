export interface SkinAssetResolver {
  resolve(filename: string): Promise<ArrayBuffer>;
}

interface SkinAdapter {
  readBinary(path: string): Promise<ArrayBuffer>;
}

export class VaultAssetResolver implements SkinAssetResolver {
  readonly #adapter: SkinAdapter;

  readonly #basePath: string;

  public constructor(adapter: SkinAdapter, basePath: string) {
    this.#adapter = adapter;
    this.#basePath = basePath;
  }

  public resolve(filename: string): Promise<ArrayBuffer> {
    return this.#adapter.readBinary(`${this.#basePath}/${filename}`);
  }
}
