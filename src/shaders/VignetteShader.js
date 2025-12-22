import vignetteVertexShader from "./glsl/vignette.vert?raw";
import vignetteFragmentShader from "./glsl/vignette.frag?raw";

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.0 },
    darkness: { value: 1.1 },
  },
  vertexShader: vignetteVertexShader,
  fragmentShader: vignetteFragmentShader,
};

export { VignetteShader };
