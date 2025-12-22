import { GUI } from "three/addons/libs/lil-gui.module.min.js";

class GUIManager {
  constructor(params, water, boat, scene, renderer, vignettePass) {
    this.params = params;
    this.water = water;
    this.boat = boat;
    this.scene = scene;
    this.renderer = renderer;
    this.vignettePass = vignettePass;

    this.gui = new GUI();
    this.setupGUI();
  }

  setupGUI() {
    const env = this.gui.addFolder("Atmosphere");
    env
      .add(this.params, "exposure", 0, 3)
      .onChange((v) => (this.renderer.toneMappingExposure = v));
    env
      .add(this.params, "bgIntensity", 0, 3)
      .onChange((v) => (this.scene.backgroundIntensity = v));
    env.add(this.params, "envIntensity", 0, 5).onChange((v) => {
      if (this.boat.getBoat()) {
        this.boat.getBoat().traverse((c) => {
          if (c.isMesh) c.material.envMapIntensity = v;
        });
      }
    });

    const waterFolder = this.gui.addFolder("Water Settings");
    waterFolder
      .addColor(this.params, "waterColor")
      .name("Deep Color")
      .onChange((v) => this.water.getWater().material.uniforms.waterColor.value.set(v));
    waterFolder
      .addColor(this.params, "sunColor")
      .name("Sun Reflection")
      .onChange((v) => this.water.getWater().material.uniforms.sunColor.value.set(v));
    waterFolder
      .add(this.params, "distortionScale", 0, 20)
      .name("Wave Strength")
      .onChange((v) => (this.water.getWater().material.uniforms.distortionScale.value = v));
    waterFolder
      .add(this.params, "waterSize", 0.1, 10)
      .name("Ripple Size")
      .onChange((v) => (this.water.getWater().material.uniforms.size.value = v));

    const boatFolder = this.gui.addFolder("Boat Physics");
    boatFolder.add(this.params, "boatHeight", -10, 5);
    boatFolder.add(this.params, "bobSpeed", 0, 4);
    boatFolder.add(this.params, "bobAmp", 0, 2);

    const camFolder = this.gui.addFolder("Post-Process");
    camFolder
      .add(this.params, "vignetteOffset", 0, 2)
      .onChange((v) => (this.vignettePass.uniforms.offset.value = v));
    camFolder
      .add(this.params, "vignetteDarkness", 0, 5)
      .onChange((v) => (this.vignettePass.uniforms.darkness.value = v));

    if (window.innerWidth < 768) this.gui.close();
  }
}

export { GUIManager };
