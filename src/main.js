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
  boatHeight: 5,
  bobSpeed: 1.2,
  bobAmp: 0.6,
  XPosition: 40,
  ZPosition: -20,
};

let scene, camera, renderer, composer, water, boat, controls;

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

const progressLine = document.getElementById("progress-line");
const loadingText = document.getElementById("loading-text");
const loadingScreen = document.getElementById("loading-screen");

const loadingManager = new THREE.LoadingManager(
  () => {
    setTimeout(() => {
      loadingScreen.classList.add("finished");
      animate(); // Start loop only after loading
    }, 500);
  },
  (url, itemsLoaded, itemsTotal) => {
    const progress = itemsLoaded / itemsTotal;
    if (progressLine) {
      progressLine.style.transform = `translateX(${-100 + progress * 100}%)`;
    }
    loadingText.innerText = `PREPARING VOYAGE ${Math.round(progress * 100)}%`;
  }
);

init();

function init() {
  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = params.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // renderer.antialias = true;

  document.body.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    20000
  );
  camera.position.set(-102.62, 51.94, 290.19);
  // controls.target.set(-7.62, 49.93, -15.09);

  // Lighting Fallbacks
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(100, 100, 50);
  scene.add(dirLight);

  // Loaders
  const textureLoader = new THREE.TextureLoader(loadingManager);
  const gltfLoader = new GLTFLoader(loadingManager);
  const draco = new DRACOLoader(loadingManager).setDecoderPath(
    "https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
  );
  gltfLoader.setDRACOLoader(draco);

  // 1. Environment Map
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  textureLoader.load("hdri/env-3.png", (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;
    scene.environment = pmremGenerator.fromEquirectangular(texture).texture;

    if (boat) {
      boat.traverse((c) => {
        if (c.isMesh) {
          c.material.envMap = scene.environment;
          c.material.needsUpdate = true;
        }
      });
    }
    pmremGenerator.dispose();
  });

  // 2. Water
  const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
  water = new Water(waterGeometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: textureLoader.load(
      "https://threejs.org/examples/textures/waternormals.jpg",
      (t) => (t.wrapS = t.wrapT = THREE.RepeatWrapping)
    ),
    sunDirection: new THREE.Vector3(1, 0.4, 1).normalize(),
    sunColor: params.sunColor,
    waterColor: params.waterColor,
    distortionScale: params.distortionScale,
    size: params.waterSize,
  });
  water.rotation.x = -Math.PI / 2;
  scene.add(water);

  // 3. Boat
  gltfLoader.load("models/rowing_boat.glb", (gltf) => {
    boat = gltf.scene;
    boat.scale.set(0.025, 0.025, 0.025);

    // NEW: Rotate the boat so it's not pointing straight away
    // Math.PI / 4 gives a nice 45-degree angle
    boat.rotation.y = Math.PI / 1.2;

    // Initial position based on params
    boat.position.set(params.XPosition, params.boatHeight, params.ZPosition);

    boat.traverse((c) => {
      if (c.isMesh) {
        c.material.envMapIntensity = params.envIntensity;
        if (scene.environment) c.material.envMap = scene.environment;
      }
    });
    scene.add(boat);
  });
  // ... (rest of the init function is the same)
  // 4. Post Process
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const vignette = new ShaderPass(VignetteShader);
  composer.addPass(vignette);
  composer.addPass(new OutputPass());

  // 5. Controls
  controls = new OrbitControls(camera, renderer.domElement); // Remove 'const'
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.1;
  controls.target.set(0, 10, 0);

  setupGUI(vignette);
}

function setupGUI(vignette) {
  const gui = new GUI();
  gui.close(); // Start closed
  const env = gui.addFolder("Atmosphere");
  env
    .add(params, "exposure", 0, 3)
    .onChange((v) => (renderer.toneMappingExposure = v));
  env
    .add(params, "bgIntensity", 0, 3)
    .onChange((v) => (scene.backgroundIntensity = v));
  env.add(params, "envIntensity", 0, 5).onChange((v) => {
    if (boat)
      boat.traverse((c) => {
        if (c.isMesh) c.material.envMapIntensity = v;
      });
  });

  const waterFolder = gui.addFolder("Water Settings");
  waterFolder
    .addColor(params, "waterColor")
    .name("Deep Color")
    .onChange((v) => water.material.uniforms.waterColor.value.set(v));
  waterFolder
    .addColor(params, "sunColor")
    .name("Sun Reflection")
    .onChange((v) => water.material.uniforms.sunColor.value.set(v));
  waterFolder
    .add(params, "distortionScale", 0, 20)
    .name("Wave Strength")
    .onChange((v) => (water.material.uniforms.distortionScale.value = v));
  waterFolder
    .add(params, "waterSize", 0.1, 10)
    .name("Ripple Size")
    .onChange((v) => (water.material.uniforms.size.value = v));

  const boatFolder = gui.addFolder("Boat Physics");
  boatFolder.add(params, "boatHeight", -10, 5);
  boatFolder.add(params, "bobSpeed", 0, 4);
  boatFolder.add(params, "bobAmp", 0, 2);
  boatFolder.add(params, "distortionScale", 0, 20);
  boatFolder.add(params, "waterSize", 0.1, 10);
  boatFolder.add(params, "XPosition", -100, 100).onChange((v) => {
    if (boat) boat.position.x = v;
  });
  boatFolder.add(params, "ZPosition", -100, 100).onChange((v) => {
    if (boat) boat.position.z = v;
  });

  const camFolder = gui.addFolder("Post-Process");
  camFolder
    .add(params, "vignetteOffset", 0, 2)
    .onChange((v) => (vignette.uniforms.offset.value = v));
  camFolder
    .add(params, "vignetteDarkness", 0, 5)
    .onChange((v) => (vignette.uniforms.darkness.value = v));

  if (window.innerWidth < 768) gui.close();
}

// Log position and target on change
controls.addEventListener("change", () => {
  const pos = camera.position;
  const tar = controls.target;

  console.clear(); // Keeps the console clean
  console.log("--- CAMERA SETTINGS ---");
  console.log(
    `camera.position.set(${pos.x.toFixed(2)}, ${pos.y.toFixed(
      2
    )}, ${pos.z.toFixed(2)});`
  );
  console.log(
    `controls.target.set(${tar.x.toFixed(2)}, ${tar.y.toFixed(
      2
    )}, ${tar.z.toFixed(2)});`
  );
});

function animate() {
  requestAnimationFrame(animate);
  const time = performance.now() * 0.001;

  if (water) {
    water.material.uniforms["time"].value += 1.0 / 60.0;
  }

  if (boat) {
    // Up and down bobbing
    boat.position.y =
      params.boatHeight + Math.sin(time * params.bobSpeed) * params.bobAmp;

    // Side-to-side rocking (Roll)
    boat.rotation.z = Math.sin(time * params.bobSpeed * 0.5) * 0.01;

    // Front-to-back rocking (Pitch)
    boat.rotation.x = Math.cos(time * params.bobSpeed * 0.3) * 0.01;

    // Subtle yaw (drifting)
    boat.rotation.y -= Math.sin(time * 0.001) * 0.01;
  }

  if (controls) controls.update();
  composer.render();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
