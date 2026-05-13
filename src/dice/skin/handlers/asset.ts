import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { type DieSides, DICE_SIDES } from '@/dice/registry';
import { applyUVArray, type FaceLayout } from '@/dice/faces/uv';
import type { DiceSkinDefinition, DiceSkinHandler } from '@/dice/skin/definition';
import type { SkinAssetResolver } from '@/dice/skin/resolver';

type MapKey = keyof NonNullable<DiceSkinDefinition['maps']>;

const MAP_KEYS: MapKey[] = ['albedo', 'normal', 'roughness', 'metalness', 'ao', 'emissive'];

const hasMaps = (def: DiceSkinDefinition): boolean =>
  !!def.maps && Object.values(def.maps).some(Boolean);

export class AssetSkinHandler implements DiceSkinHandler {
  public readonly definition: DiceSkinDefinition;

  readonly #resolver: SkinAssetResolver;

  readonly #glbScenes = new Map<DieSides, THREE.Group>();

  readonly #textures = new Map<string, THREE.Texture>();

  readonly #sounds = new Map<string, AudioBuffer>();

  #builtMaterial: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | null = null;

  public constructor(definition: DiceSkinDefinition, resolver: SkinAssetResolver) {
    this.definition = definition;
    this.#resolver = resolver;
  }

  public async preload(): Promise<void> {
    await Promise.all([this.#loadMaps(), this.#loadMeshes(), this.#loadSounds()]);
    if (hasMaps(this.definition)) {
      this.#builtMaterial = this.#buildMaterial();
    }
  }

  public buildMesh(
    sides: DieSides,
    physicsGeo: THREE.BufferGeometry,
    layout: FaceLayout
  ): THREE.Object3D {
    const scene = this.#glbScenes.get(sides);

    if (scene) {
      const clone = scene.clone(true);
      this.#scaleToPhysics(clone, physicsGeo);
      this.#applyRotationOffset(clone);
      return clone;
    }

    const geo = this.#fallbackGeo(physicsGeo, layout);
    const material = hasMaps(this.definition)
      ? (this.#builtMaterial ?? this.#buildMaterial())
      : this.#buildMaterial();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    return mesh;
  }

  public getSound(key: 'collision' | 'result'): AudioBuffer | undefined {
    const filename = this.definition.sounds?.[key];
    return filename ? this.#sounds.get(filename) : undefined;
  }

  public dispose(): void {
    this.#glbScenes.clear();
    for (const tex of this.#textures.values()) tex.dispose();
    this.#textures.clear();
    this.#builtMaterial?.dispose();
    this.#builtMaterial = null;
    this.#sounds.clear();
  }

  async #loadMaps(): Promise<void> {
    const maps = this.definition.maps ?? {};
    await Promise.all(
      MAP_KEYS.map(async (key) => {
        const filename = maps[key];
        if (!filename || this.#textures.has(filename)) return;
        const buffer = await this.#resolver.resolve(filename);
        const texture = await this.#textureFromBuffer(buffer);
        texture.colorSpace = key === 'albedo' ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
        this.#textures.set(filename, texture);
      })
    );
  }

  async #loadMeshes(): Promise<void> {
    const meshAssets = this.definition.meshAssets ?? {};
    const loader = new GLTFLoader();
    await Promise.all(
      DICE_SIDES.map(async (sides) => {
        const filename = meshAssets[sides];
        if (!filename) return;
        const buffer = await this.#resolver.resolve(filename);
        const group = await this.#parseGLB(loader, buffer);
        this.#glbScenes.set(sides, group);
      })
    );
  }

  async #loadSounds(): Promise<void> {
    const sounds = this.definition.sounds ?? {};
    const filenames = [...new Set(Object.values(sounds).filter(Boolean))] as string[];
    if (filenames.length === 0) return;

    const context = new AudioContext();
    await Promise.all(
      filenames.map(async (filename) => {
        if (this.#sounds.has(filename)) return;
        const buffer = await this.#resolver.resolve(filename);
        const audioBuffer = await context.decodeAudioData(buffer.slice(0));
        this.#sounds.set(filename, audioBuffer);
      })
    );
    void context.close();
  }

  #buildMaterial(): THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial {
    const params = this.definition.materialParams ?? {};
    const maps = this.definition.maps ?? {};
    const needsPhysical = (params.clearcoat ?? 0) > 0;

    const texProps = {
      map: maps.albedo ? this.#textures.get(maps.albedo) : undefined,
      normalMap: maps.normal ? this.#textures.get(maps.normal) : undefined,
      roughnessMap: maps.roughness ? this.#textures.get(maps.roughness) : undefined,
      metalnessMap: maps.metalness ? this.#textures.get(maps.metalness) : undefined,
      aoMap: maps.ao ? this.#textures.get(maps.ao) : undefined,
      emissiveMap: maps.emissive ? this.#textures.get(maps.emissive) : undefined,
    };

    if (needsPhysical) {
      return new THREE.MeshPhysicalMaterial({
        ...texProps,
        roughness: params.roughness ?? 0.5,
        metalness: params.metalness ?? 0.0,
        envMapIntensity: params.envMapIntensity ?? 1.0,
        clearcoat: params.clearcoat ?? 0,
        clearcoatRoughness: params.clearcoatRoughness ?? 0,
      });
    }

    return new THREE.MeshStandardMaterial({
      ...texProps,
      roughness: params.roughness ?? 0.5,
      metalness: params.metalness ?? 0.0,
      envMapIntensity: params.envMapIntensity ?? 1.0,
    });
  }

  #applyRotationOffset(obj: THREE.Object3D): void {
    const offset = this.definition.meshRotationOffset;
    if (!offset) return;
    const DEG = Math.PI / 180;
    obj.rotation.set(offset[0] * DEG, offset[1] * DEG, offset[2] * DEG);
  }

  #scaleToPhysics(obj: THREE.Object3D, physicsGeo: THREE.BufferGeometry): void {
    obj.updateWorldMatrix(false, true);

    const worldScale = new THREE.Vector3();
    let maxRadius = 0;
    obj.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      const mesh = child as THREE.Mesh<THREE.BufferGeometry>;
      const { geometry } = mesh;
      geometry.computeBoundingSphere();
      const sphere = geometry.boundingSphere;
      if (!sphere) {
        return;
      }

      child.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), worldScale);
      maxRadius = Math.max(
        maxRadius,
        sphere.radius * Math.max(worldScale.x, worldScale.y, worldScale.z)
      );
    });

    physicsGeo.computeBoundingSphere();
    const pr = physicsGeo.boundingSphere?.radius;

    if (maxRadius > 0 && pr) {
      obj.scale.setScalar(pr / maxRadius);
    }
  }

  #fallbackGeo(physicsGeo: THREE.BufferGeometry, layout: FaceLayout): THREE.BufferGeometry {
    const geo = physicsGeo.toNonIndexed();
    geo.computeVertexNormals();
    if (this.definition.numberStyle !== 'baked') {
      applyUVArray(geo, layout.uvArray);
    }
    return geo;
  }

  #textureFromBuffer(buffer: ArrayBuffer): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([buffer]);
      const url = URL.createObjectURL(blob);
      new THREE.TextureLoader().load(
        url,
        (texture) => {
          URL.revokeObjectURL(url);
          resolve(texture);
        },
        undefined,
        (err) => {
          URL.revokeObjectURL(url);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      );
    });
  }

  #parseGLB(loader: GLTFLoader, buffer: ArrayBuffer): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      loader.parse(
        buffer,
        '',
        (gltf) => {
          let hasMesh = false;
          gltf.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              hasMesh = true;
              obj.castShadow = true;
            }
          });

          if (hasMesh) {
            resolve(gltf.scene);
          } else {
            reject(new Error('No mesh found in GLB'));
          }
        },
        reject
      );
    });
  }
}
