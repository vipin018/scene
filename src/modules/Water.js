import * as THREE from "three";
import { Water } from "three/addons/objects/Water.js";

class WaterScene {
  constructor(scene, textureLoader, params) {
    this.scene = scene;
    this.textureLoader = textureLoader;
    this.params = params;
    this.water = null;

    this.init();
  }

  init() {
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
    this.water = new Water(waterGeometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: this.textureLoader.load(
        "https://threejs.org/examples/textures/waternormals.jpg",
        (t) => (t.wrapS = t.wrapT = THREE.RepeatWrapping)
      ),
      sunDirection: new THREE.Vector3(1, 0.4, 1).normalize(),
      sunColor: this.params.sunColor,
      waterColor: this.params.waterColor,
      distortionScale: this.params.distortionScale,
      size: this.params.waterSize,
    });
    this.water.rotation.x = -Math.PI / 2;
    this.scene.add(this.water);
  }

  getWater() {
    return this.water;
  }

  update() {
    if (this.water) {
      this.water.material.uniforms["time"].value += 1.0 / 60.0;
    }
  }
}

export { WaterScene };
