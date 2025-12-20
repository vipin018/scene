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
  exposure: 1.0,
  bgIntensity: 1.0,
  fogColor: 0x94a1b3,
  fogDensity: 0.0006,
  // Volumetric Mist Params
  mistColor: 0xdde6ed,
  mistDensity: 0.015,
  mistHeight: 15.0, // Thickness of the volume
  mistSpeed: 0.2,
  mistScale: 0.02,
  // Vignette
  vignetteOffset: 1.0,
  vignetteDarkness: 1.1,
  // Boat
  boatHeight: -0.5,
  bobSpeed: 1.2,
  bobAmp: 0.6,
  envIntensity: 1.8,
};

let scene, camera, renderer, composer, water, boat, mistMaterial;

// --- SHADER: VOLUMETRIC RAYMARCHED MIST ---
const VolumetricMistShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(params.mistColor) },
    uDensity: { value: params.mistDensity },
    uMistHeight: { value: params.mistHeight },
    uScale: { value: params.mistScale },
    uSpeed: { value: params.mistSpeed },
    uCameraPos: { value: new THREE.Vector3() },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }`,
  fragmentShader: `
    precision highp float;
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uDensity;
    uniform float uMistHeight;
    uniform float uScale;
    uniform float uSpeed;
    uniform vec3 uCameraPos;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    // Fast Pseudo-Random Noise
    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float n = dot(i, vec3(1.0, 57.0, 113.0));
      return mix(mix(mix( fract(sin(n + 0.0) * 43758.5453), fract(sin(n + 1.0) * 43758.5453), f.x),
                 mix( fract(sin(n + 57.0) * 43758.5453), fract(sin(n + 58.0) * 43758.5453), f.x), f.y),
             mix(mix( fract(sin(n + 113.0) * 43758.5453), fract(sin(n + 114.0) * 43758.5453), f.x),
                 mix( fract(sin(n + 170.0) * 43758.5453), fract(sin(n + 171.0) * 43758.5453), f.x), f.y), f.z);
    }

    void main() {
      vec3 rayDir = normalize(vWorldPosition - uCameraPos);
      vec3 currentPos = uCameraPos;
      
      // If camera is above the mist, start at the top of the mist box
      if(currentPos.y > uMistHeight) {
          float t = (uMistHeight - currentPos.y) / rayDir.y;
          currentPos = currentPos + t * rayDir;
      }

      float accumulatedDensity = 0.0;
      int steps = 12; // Optimized step count for performance
      float stepSize = 3.0;

      for(int i = 0; i < steps; i++) {
        vec3 p = currentPos * uScale;
        p.x += uTime * uSpeed;
        p.z += uTime * (uSpeed * 0.5);

        float d = noise(p);
        
        // Vertical fade (mist is thicker near the water)
        float hFade = smoothstep(uMistHeight, 0.0, currentPos.y);
        accumulatedDensity += d * uDensity * hFade;

        currentPos += rayDir * stepSize;
        
        // Stop if we hit the water or go too high
        if(currentPos.y < 0.0 || currentPos.y > uMistHeight + 10.0) break;
      }

      // Edge fade for the box boundaries
      float edgeFade = smoothstep(1.0, 0.4, length(vUv - 0.5) * 2.0);
      
      gl_FragColor = vec4(uColor, accumulatedDensity * edgeFade);
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
  scene.fog = new THREE.FogExp2(params.fogColor, params.fogDensity);

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
    15000
  );
  camera.position.set(180, 100, 280);

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
  mistMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(VolumetricMistShader.uniforms),
    vertexShader: VolumetricMistShader.vertexShader,
    fragmentShader: VolumetricMistShader.fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide, // Render backfaces so we can go inside the mist
    blending: THREE.AdditiveBlending,
  });
  // A large box that contains the mist volume
  const mistVolume = new THREE.Mesh(
    new THREE.BoxGeometry(6000, params.mistHeight * 2, 6000),
    mistMaterial
  );
  mistVolume.position.y = params.mistHeight / 2;
  scene.add(mistVolume);

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
  vignette.uniforms.offset.value = params.vignetteOffset;
  vignette.uniforms.darkness.value = params.vignetteDarkness;
  composer.addPass(vignette);
  composer.addPass(new OutputPass());

  // 6. Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI / 2 - 0.15;
  controls.target.set(0, 15, 0);

  setupGUI(controls, vignette);
  animate(controls);
}

function setupGUI(controls, vignette) {
  const gui = new GUI();

  const mist = gui.addFolder("Volumetric Winter Mist");
  mist
    .add(params, "mistDensity", 0, 0.1)
    .name("Density")
    .onChange((v) => (mistMaterial.uniforms.uDensity.value = v));
  mist
    .add(params, "mistHeight", 1, 100)
    .name("Volume Height")
    .onChange((v) => {
      mistMaterial.uniforms.uMistHeight.value = v;
      // Find the mist mesh in scene and update geometry scale
      scene.children.forEach((child) => {
        if (child.material === mistMaterial) {
          child.scale.y = v / 15; // Rough scale adjust
          child.position.y = v / 2;
        }
      });
    });
  mist
    .add(params, "mistSpeed", 0, 1)
    .name("Flow Speed")
    .onChange((v) => (mistMaterial.uniforms.uSpeed.value = v));
  mist
    .addColor(params, "mistColor")
    .onChange((v) => mistMaterial.uniforms.uColor.value.set(v));

  const boatFolder = gui.addFolder("Boat Physics");
  boatFolder.add(params, "boatHeight", -5, 5);
  boatFolder.add(params, "bobSpeed", 0, 4);

  const camFolder = gui.addFolder("Camera & Vignette");
  camFolder
    .add(params, "exposure", 0, 3)
    .onChange((v) => (renderer.toneMappingExposure = v));
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

  // Pass dynamic uniforms to volumetric shader
  mistMaterial.uniforms.uTime.value = time;
  mistMaterial.uniforms.uCameraPos.value.copy(camera.position);

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
