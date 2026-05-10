import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { DiceRollerSettings } from '@/plugin/settings';

const Magics = {
  CAMERA_FOV: 45,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 100,
  CAMERA_POS_Y: 20,
  MAX_PIXEL_RATIO: 2,
  TONE_MAPPING_EXPOSURE: 1.4,
  AMBIENT_INTENSITY: 1.8,
  KEY_LIGHT_COLOR: 0xfff5e0,
  KEY_LIGHT_INTENSITY: 1.4,
  FILL_LIGHT_INTENSITY: 1.2,
  FILL_LIGHT_RANGE: 30,
  UNDER_FILL_INTENSITY: 0.8,
  UNDER_FILL_RANGE: 30,
  RIM_LIGHT_COLOR: 0xccddff,
  RIM_LIGHT_INTENSITY: 0.3,
  SHADOW_NEAR: 0.5,
  SHADOW_FAR: 40,
  SHADOW_EXTENT: 12,
  SHADOW_BIAS: -0.001,
  SHADOW_PLANE_SIZE: 40,
  SHADOW_PLANE_OPACITY: 0.25,
  SHADOW_PLANE_Y: 0.01,
} as const;

const SHADOW_MAP_SIZES: Record<DiceRollerSettings['shadowQuality'], number> = {
  low: 512,
  medium: 1024,
  high: 2048,
};

export class Renderer {
  public readonly scene: THREE.Scene;

  readonly #camera: THREE.PerspectiveCamera;

  readonly #threeRenderer: THREE.WebGLRenderer;

  readonly #onResize: () => void;

  public constructor(container: HTMLElement, shadowQuality: DiceRollerSettings['shadowQuality']) {
    this.scene = new THREE.Scene();

    this.#camera = new THREE.PerspectiveCamera(
      Magics.CAMERA_FOV,
      window.innerWidth / window.innerHeight,
      Magics.CAMERA_NEAR,
      Magics.CAMERA_FAR
    );

    this.#camera.position.set(0, Magics.CAMERA_POS_Y, 0);
    this.#camera.up.set(0, 0, -1);
    this.#camera.lookAt(0, 0, 0);
    this.#camera.updateMatrixWorld();

    this.#threeRenderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });

    this.#threeRenderer.setSize(window.innerWidth, window.innerHeight);
    this.#threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, Magics.MAX_PIXEL_RATIO));
    this.#threeRenderer.shadowMap.enabled = true;
    this.#threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.#threeRenderer.setClearColor(0x000000, 0);
    this.#threeRenderer.toneMapping = THREE.ReinhardToneMapping;
    this.#threeRenderer.toneMappingExposure = Magics.TONE_MAPPING_EXPOSURE;

    container.appendChild(this.#threeRenderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.#threeRenderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
    pmrem.dispose();

    this.#setupLights(shadowQuality);
    this.#setupShadowPlane();

    this.#onResize = () => {
      this.#camera.aspect = window.innerWidth / window.innerHeight;
      this.#camera.updateProjectionMatrix();
      this.#threeRenderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', this.#onResize);
  }

  /** Returns the world-space AABB of the camera's view projected onto y=0. */
  public getGroundBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    const ndcCorners = [
      new THREE.Vector3(-1, -1, 0.5),
      new THREE.Vector3(1, -1, 0.5),
      new THREE.Vector3(-1, 1, 0.5),
      new THREE.Vector3(1, 1, 0.5),
    ];

    const xs: number[] = [];
    const zs: number[] = [];

    for (const ndc of ndcCorners) {
      const world = ndc.clone().unproject(this.#camera);
      const dir = world.sub(this.#camera.position).normalize();
      const t = -this.#camera.position.y / dir.y;
      xs.push(this.#camera.position.x + t * dir.x);
      zs.push(this.#camera.position.z + t * dir.z);
    }

    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
    };
  }

  public render(): void {
    this.#threeRenderer.render(this.scene, this.#camera);
  }

  public dispose(): void {
    window.removeEventListener('resize', this.#onResize);
    this.#threeRenderer.dispose();

    this.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mesh = obj as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
      mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        m.dispose();
      }
    });
  }

  #setupLights(shadowQuality: DiceRollerSettings['shadowQuality']): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, Magics.AMBIENT_INTENSITY));

    const mapSize = SHADOW_MAP_SIZES[shadowQuality];

    const key = new THREE.DirectionalLight(Magics.KEY_LIGHT_COLOR, Magics.KEY_LIGHT_INTENSITY);
    key.position.set(6, 12, 7);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(mapSize);
    key.shadow.camera.near = Magics.SHADOW_NEAR;
    key.shadow.camera.far = Magics.SHADOW_FAR;
    key.shadow.camera.left = -Magics.SHADOW_EXTENT;
    key.shadow.camera.right = Magics.SHADOW_EXTENT;
    key.shadow.camera.top = Magics.SHADOW_EXTENT;
    key.shadow.camera.bottom = -Magics.SHADOW_EXTENT;
    key.shadow.bias = Magics.SHADOW_BIAS;
    this.scene.add(key);

    const fill = new THREE.PointLight(
      0x8899cc,
      Magics.FILL_LIGHT_INTENSITY,
      Magics.FILL_LIGHT_RANGE
    );
    fill.position.set(-8, 7, -3);
    this.scene.add(fill);

    const underFill = new THREE.PointLight(
      0x99aabb,
      Magics.UNDER_FILL_INTENSITY,
      Magics.UNDER_FILL_RANGE
    );
    underFill.position.set(0, -5, 0);
    this.scene.add(underFill);

    const rim = new THREE.DirectionalLight(Magics.RIM_LIGHT_COLOR, Magics.RIM_LIGHT_INTENSITY);
    rim.position.set(-5, 8, -8);
    this.scene.add(rim);
  }

  /** Transparent plane that only receives shadows, giving dice soft ground shadows. */
  #setupShadowPlane(): void {
    const geo = new THREE.PlaneGeometry(Magics.SHADOW_PLANE_SIZE, Magics.SHADOW_PLANE_SIZE);
    const mat = new THREE.ShadowMaterial({ opacity: Magics.SHADOW_PLANE_OPACITY });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = Magics.SHADOW_PLANE_Y;
    plane.receiveShadow = true;
    this.scene.add(plane);
  }
}
