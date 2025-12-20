import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Water } from "three/addons/objects/Water.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

// Post-Processing
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const params = {
  exposure: 1.1,
  bgBlur: 0.04,
  bgIntensity: 1.0,
  fogColor: 0x94a1b3,
  // Volumetric Mist Params
  mistColor: 0xdde6ed,
  mistDensity: 0.015,
  mistHeight: 40.0, // How high the volume reaches
  mistNoiseScale: 0.015, // Frequency of the noise
  mistSpeed: 0.2,
  // Vignette
  vignetteOffset: 1.0,
  vignetteDarkness: 1.1,
  // Boat
  boatHeight: -0.5,
  bobSpeed: 1.2,
  bobAmp: 0.6,
  envIntensity: 1.8,
};

let scene, camera, renderer, composer, water, boat, volumeMaterial;

// --- SHADER: VOLUMETRIC RAYMARCHED MIST ---
const VolumetricMistShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(params.mistColor) },
    uDensity: { value: params.mistDensity },
    uHeight: { value: params.mistHeight },
    uNoiseScale: { value: params.mistNoiseScale },
    uSpeed: { value: params.mistSpeed },
    uCameraPos: { value: new THREE.Vector3() },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec3 vLocalPosition;
    void main() {
      vLocalPosition = position;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }`,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uDensity;
    uniform float uHeight;
    uniform float uNoiseScale;
    uniform float uSpeed;
    uniform vec3 uCameraPos;
    varying vec3 vWorldPosition;
    varying vec3 vLocalPosition;

    // Simple 3D Noise function for performance
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise(vec3 x) {
      vec3 i = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
                     mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
                 mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                     mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
    }

    void main() {
      vec3 rayDir = normalize(vWorldPosition - uCameraPos);
      vec3 rayOrigin = uCameraPos;

      float totalDensity = 0.0;
      const int steps = 16; // Low steps for performance
      float stepSize = uHeight / float(steps);

      for(int i = 0; i < steps; i++) {
        vec3 p = rayOrigin + rayDir * (float(i) * stepSize * 2.0);
        
        // Only sample if within the height bounds of the mist
        if (p.y > 0.0 && p.y < uHeight) {
          float hFalloff = 1.0 - (p.y / uHeight); // Thicker at bottom
          float n = noise(p * uNoiseScale + vec3(uTime * uSpeed, 0.0, uTime * uSpeed * 0.5));
          totalDensity += n * hFalloff * uDensity;
        }
      }

      totalDensity = clamp(totalDensity, 0.0, 1.0);
      gl_FragColor = vec4(uColor, totalDensity);
    }`,
};

// --- SHADER: VIGNETTE ---
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.0 },
    darkness: { value: 1.1 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float offset; uniform float darkness; varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * 2.0;
      float v = smoothstep(offset, offset + darkness, length(uv));
      gl_FragColor = vec4(texel.rgb * (1.0 - v), texel.a);
    }`,
};

init();

function init() {
  scene = new THREE.Scene();
  // scene.fog = new THREE.FogExp2(params.fogColor, 0.0007);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;
  document.body.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    20000
  );
  camera.position.set(200, 120, 300);

  // 1. Environment
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  new THREE.TextureLoader().load("hdri/env3.jpg", (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;
    scene.environment = pmremGenerator.fromEquirectangular(texture).texture;
  });

  // 2. Water
  water = new Water(new THREE.PlaneGeometry(10000, 10000), {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load(
      "https://threejs.org/examples/textures/waternormals.jpg",
      (t) => (t.wrapS = t.wrapT = THREE.RepeatWrapping)
    ),
    sunDirection: new THREE.Vector3(1, 0.4, 1).normalize(),
    sunColor: 0xffffff,
    waterColor: params.waterColor,
    distortionScale: 3.7,
    size: 1.0,
  });
  water.rotation.x = -Math.PI / 2;
  scene.add(water);

  // 3. Volumetric Mist Box
  // We use a large box that represents the "volume" of air fog sits in.
  volumeMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(VolumetricMistShader.uniforms),
    vertexShader: VolumetricMistShader.vertexShader,
    fragmentShader: VolumetricMistShader.fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide, // Render back of box to avoid clipping when camera enters
    blending: THREE.AdditiveBlending,
  });
  const volumeGeo = new THREE.BoxGeometry(8000, params.mistHeight, 8000);
  const volumeMesh = new THREE.Mesh(volumeGeo, volumeMaterial);
  volumeMesh.position.y = params.mistHeight / 2;
  scene.add(volumeMesh);

  // 4. Boat
  const draco = new DRACOLoader().setDecoderPath(
    "https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
  );
  new GLTFLoader().setDRACOLoader(draco).load("models/boat.glb", (gltf) => {
    boat = gltf.scene;
    boat.scale.set(15, 15, 15);
    boat.traverse((c) => {
      if (c.isMesh) c.material.envMapIntensity = params.envIntensity;
    });
    scene.add(boat);
  });

  // 5. Post Process
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const vignette = new ShaderPass(VignetteShader);
  composer.addPass(vignette);
  composer.addPass(new OutputPass());

  // 6. Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 150;
  controls.maxDistance = 800;
  controls.maxPolarAngle = Math.PI / 2 - 0.1;
  controls.target.set(0, 15, 0);

  setupGUI(controls, vignette);
  animate(controls);
}

function setupGUI(controls, vignette) {
  const gui = new GUI();

  const env = gui.addFolder("Atmosphere");
  env
    .add(params, "exposure", 0, 3)
    .onChange((v) => (renderer.toneMappingExposure = v));
  env
    .add(params, "bgIntensity", 0, 3)
    .onChange((v) => (scene.backgroundIntensity = v));

  const mist = gui.addFolder("Volumetric Mist");
  mist
    .add(params, "mistDensity", 0, 0.1)
    .name("Density")
    .onChange((v) => (volumeMaterial.uniforms.uDensity.value = v));
  mist
    .add(params, "mistHeight", 5, 200)
    .name("Volume Height")
    .onChange((v) => {
      volumeMaterial.uniforms.uHeight.value = v;
      // Rescale the box to match the new height
      const mesh = scene.children.find((c) => c.material === volumeMaterial);
      mesh.scale.y = v / 40; // Relative to original geometry height
      mesh.position.y = v / 2;
    });
  mist
    .add(params, "mistNoiseScale", 0.001, 0.05)
    .name("Noise Scale")
    .onChange((v) => (volumeMaterial.uniforms.uNoiseScale.value = v));
  mist
    .add(params, "mistSpeed", 0, 2)
    .name("Wind Speed")
    .onChange((v) => (volumeMaterial.uniforms.uSpeed.value = v));
  mist
    .addColor(params, "mistColor")
    .onChange((v) => volumeMaterial.uniforms.uColor.value.set(v));

  const boatFolder = gui.addFolder("Boat Physics");
  boatFolder.add(params, "boatHeight", -5, 5);
  boatFolder.add(params, "bobSpeed", 0, 4);

  const camFolder = gui.addFolder("Camera & Vignette");
  camFolder
    .add(params, "vignetteOffset", 0, 2)
    .onChange((v) => (vignette.uniforms.offset.value = v));
  camFolder
    .add(params, "vignetteDarkness", 0, 5)
    .onChange((v) => (vignette.uniforms.darkness.value = v));
}

function animate(controls) {
  requestAnimationFrame(() => animate(controls));
  const time = performance.now() * 0.001;

  water.material.uniforms["time"].value += 1.0 / 60.0;

  // Update Volumetric Shader
  volumeMaterial.uniforms.uTime.value = time;
  volumeMaterial.uniforms.uCameraPos.value.copy(camera.position);

  if (boat) {
    boat.position.y =
      params.boatHeight + Math.sin(time * params.bobSpeed) * params.bobAmp;
    boat.rotation.z = Math.sin(time * params.bobSpeed * 0.8) * 0.05;
    boat.rotation.x = Math.cos(time * params.bobSpeed * 0.5) * 0.03;
  }

  controls.update();
  composer.render();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
