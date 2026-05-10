const Magics = {
  MIN_VELOCITY: 1.5,
  MAX_VELOCITY: 15,
} as const;

export class DiceSoundPlayer {
  readonly #context: AudioContext;

  public constructor() {
    this.#context = new AudioContext();
  }

  public play(buffer: AudioBuffer, gain = 1.0): void {
    if (this.#context.state === 'suspended') {
      void this.#context.resume();
    }

    const source = this.#context.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.#context.createGain();
    gainNode.gain.value = Math.max(0, Math.min(1, gain));

    source.connect(gainNode).connect(this.#context.destination);
    source.start();
  }

  public dispose(): void {
    void this.#context.close();
  }
}

export function collisionGain(impactVelocity: number): number {
  const { MIN_VELOCITY, MAX_VELOCITY } = Magics;
  return Math.min(1, Math.max(0, (impactVelocity - MIN_VELOCITY) / (MAX_VELOCITY - MIN_VELOCITY)));
}
