import * as THREE from "three";
import { SceneManager } from "./modules/SceneManager.js";
import { AssetLoader } from "./modules/AssetLoader.js";
import { WaterScene } from "./modules/Water.js";
import { Boat } from "./modules/Boat.js";
import { PostProcessing } from "./modules/PostProcessing.js";
import { GUIManager } from "./modules/GUI.js";
import { AnimationLoop } from "./modules/AnimationLoop.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js"; // This import was removed, but it's needed for controls

const params = {
  exposure: 1.1,
  bgBlur: 0.04,
  bgIntensity: 1.0,
  envIntensity: 1.8,
  // Water Params
  waterColor: 0x001e0f,
  sunColor: 0xffffff,
  distortionScale: 3.7,
  waterSize: 1.0,
  // Vignette
  vignetteOffset: 1.0,
  vignetteDarkness: 1.1,
  // Boat
  boatHeight: -8.0,
  bobSpeed: 1.2,
  bobAmp: 0.6,
};

// Global references for animation loop and GUI
let waterInstance, boatInstance, controlsInstance, postProcessingInstance;

init();

function init() {
  const sceneManager = new SceneManager(params);
  const scene = sceneManager.getScene();
  const camera = sceneManager.getCamera();
  const renderer = sceneManager.getRenderer();

  const loadingScreen = document.getElementById("loading-screen");

    const loadingLine = document.getElementById("loading-line");
    const assetLoader = new AssetLoader(loadingScreen, loadingLine);
  const textureLoader = assetLoader.getTextureLoader();
  const gltfLoader = assetLoader.getGltfLoader();

  // Environment Map
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  textureLoader.load("hdri/env3.jpg", (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;
    scene.environment = pmremGenerator.fromEquirectangular(texture).texture;

    if (boatInstance) {
      boatInstance.updateEnvMap(scene.environment);
    }
    pmremGenerator.dispose();
  });

  waterInstance = new WaterScene(scene, textureLoader, params);
  boatInstance = new Boat(scene, gltfLoader, params);
  postProcessingInstance = new PostProcessing(scene, camera, renderer);

  // Controls
  controlsInstance = new OrbitControls(camera, renderer.domElement);
  controlsInstance.enableDamping = true;
  controlsInstance.maxPolarAngle = Math.PI / 2 - 0.1;
  controlsInstance.target.set(0, 15, 0);

  // GUI
  new GUIManager(
    params,
    waterInstance,
    boatInstance,
    scene,
    renderer,
    postProcessingInstance.getVignettePass()
  );

  // Animation Loop
  const animationLoop = new AnimationLoop(
    controlsInstance,
    waterInstance,
    boatInstance,
    postProcessingInstance
  );
  animationLoop.animate();

  // Update post-processing and renderer on resize
  window.addEventListener("resize", () => {
    postProcessingInstance.setSize(window.innerWidth, window.innerHeight);
  });
}