import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { VignetteShader } from "../shaders/VignetteShader.js";

class PostProcessing {
  constructor(scene, camera, renderer) {
    this.composer = new EffectComposer(renderer);
    this.vignettePass = new ShaderPass(VignetteShader);

    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(this.vignettePass);
    this.composer.addPass(new OutputPass());
  }

  getComposer() {
    return this.composer;
  }

  getVignettePass() {
    return this.vignettePass;
  }

  render() {
    this.composer.render();
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
  }
}

export { PostProcessing };
