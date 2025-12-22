import * as THREE from "three";

class SceneManager {
  constructor(params) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      20000
    );
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.params = params; // Store params for initial setup

    this.init();
  }

  init() {
    this.setupRenderer();
    this.setupCamera();
    this.setupLighting();
    this.addEventListeners();
  }

  setupRenderer() {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = this.params.exposure;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(this.renderer.domElement);
  }

  setupCamera() {
    this.camera.position.set(200, 120, 300);
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(100, 100, 50);
    this.scene.add(dirLight);
  }

  addEventListeners() {
    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  getScene() {
    return this.scene;
  }

  getCamera() {
    return this.camera;
  }

  getRenderer() {
    return this.renderer;
  }
}

export { SceneManager };
