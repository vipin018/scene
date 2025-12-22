import * as THREE from "three";

class Boat {
  constructor(scene, gltfLoader, params) {
    this.scene = scene;
    this.gltfLoader = gltfLoader;
    this.params = params;
    this.boat = null;

    this.init();
  }

  init() {
    this.gltfLoader.load("models/boat.glb", (gltf) => {
      this.boat = gltf.scene;
      this.boat.scale.set(15, 15, 15);
      this.boat.traverse((c) => {
        if (c.isMesh) {
          c.material.envMapIntensity = this.params.envIntensity;
          if (this.scene.environment) c.material.envMap = this.scene.environment;
        }
      });
      this.scene.add(this.boat);
    });
  }

  getBoat() {
    return this.boat;
  }

  update(time) {
    if (this.boat) {
      this.boat.position.y =
        this.params.boatHeight + Math.sin(time * this.params.bobSpeed) * this.params.bobAmp;
      this.boat.rotation.z = Math.sin(time * this.params.bobSpeed * 0.8) * 0.05;
      this.boat.rotation.x = Math.cos(time * this.params.bobSpeed * 0.5) * 0.03;
    }
  }

  updateEnvMap(environment) {
    if (this.boat) {
      this.boat.traverse((c) => {
        if (c.isMesh) {
          c.material.envMap = environment;
          c.material.needsUpdate = true;
        }
      });
    }
  }
}

export { Boat };
