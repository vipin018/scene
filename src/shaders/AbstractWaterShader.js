import abstractWaterVertexShader from "./glsl/abstractWater.vert?raw";
import abstractWaterFragmentShader from "./glsl/abstractWater.frag?raw";
import * as THREE from "three";

const AbstractWaterShader = {
  uniforms: {
    time: { value: 0.0 },
    color: { value: new THREE.Color(0x003366) }, // Deep blue water
    distortionScale: { value: 1.0 },
  },
  vertexShader: abstractWaterVertexShader,
  fragmentShader: abstractWaterFragmentShader,
};

export { AbstractWaterShader };
