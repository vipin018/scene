import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { LoadingAnimation } from "./LoadingAnimation.js";

class AssetLoader {
  constructor(loadingScreen, loadingLine) { // Removed loadingBoatContainer
    this.loadingScreen = loadingScreen;
    this.loadingLine = loadingLine;

    this.loadingAnimation = new LoadingAnimation(this.loadingScreen, this.loadingLine); // Removed loadingBoatContainer

    this.loadingManager = new THREE.LoadingManager(
      // On-Load
      () => {
        this.loadingAnimation.completeLoading();
      },
      // On-Progress
      (url, itemsLoaded, itemsTotal) => {
        const progress = itemsLoaded / itemsTotal;
        this.loadingAnimation.startLoading();
        this.loadingAnimation.updateProgress(progress);
      },
      // On-Error
      (url) => {
        console.error(`Error loading ${url}`);
        // Optionally, inform LoadingAnimation about an error state
      }
    );

    this.textureLoader = new THREE.TextureLoader(this.loadingManager);
    this.gltfLoader = new GLTFLoader(this.loadingManager);
    const draco = new DRACOLoader(this.loadingManager).setDecoderPath(
      "https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
    );
    this.gltfLoader.setDRACOLoader(draco);
  }

  getTextureLoader() {
    return this.textureLoader;
  }

  getGltfLoader() {
    return this.gltfLoader;
  }

  getLoadingManager() {
    return this.loadingManager;
  }
}

export { AssetLoader };