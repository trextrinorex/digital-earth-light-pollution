import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===== DOM =====
const container = document.getElementById('canvas-container');
const infoCard = document.getElementById('info-card');
const navBtns = document.querySelectorAll('.nav-btn');
const panels = {
  impacts: document.getElementById('panel-impacts'),
  solutions: document.getElementById('panel-solutions'),
  about: document.getElementById('panel-about')
};
const toggleRotate = document.getElementById('toggle-rotate');
const toggleAtmosphere = document.getElementById('toggle-atmosphere');
const lightIntensitySlider = document.getElementById('light-intensity');

// ===== Three.js Scene =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02040a);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0.8, 3.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1.6;
controls.maxDistance = 8;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;

// ===== Lights =====
const ambient = new THREE.AmbientLight(0x334455, 0.35);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff5e6, 1.8);
sun.position.set(5, 2, 4);
scene.add(sun);

// ===== Starfield =====
function createStars() {
  const count = 4000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 40 + Math.random() * 60;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.08,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85
  });
  return new THREE.Points(geo, mat);
}
scene.add(createStars());

// ===== Earth =====
const EARTH_RADIUS = 1;
const textureLoader = new THREE.TextureLoader();

// Public textures from three-globe examples (NASA-derived)
const dayMap = textureLoader.load('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg');
const nightMap = textureLoader.load('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg');
const bumpMap = textureLoader.load('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png');

dayMap.colorSpace = THREE.SRGBColorSpace;
nightMap.colorSpace = THREE.SRGBColorSpace;

const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);

// Custom shader material that blends day + night based on lighting direction
const earthMat = new THREE.ShaderMaterial({
  uniforms: {
    dayTexture: { value: dayMap },
    nightTexture: { value: nightMap },
    bumpTexture: { value: bumpMap },
    sunDirection: { value: new THREE.Vector3(5, 2, 4).normalize() },
    nightIntensity: { value: 1.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;
    uniform float nightIntensity;
    uniform vec3 sunDirection;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vec3 dayColor = texture2D(dayTexture, vUv).rgb;
      vec3 nightColor = texture2D(nightTexture, vUv).rgb;

      // Cosine of angle between normal and sun
      float cosAngle = dot(normalize(vNormal), sunDirection);
      // Smooth transition around terminator
      float dayFactor = smoothstep(-0.15, 0.25, cosAngle);

      // Boost night lights
      nightColor *= nightIntensity * 1.6;

      vec3 color = mix(nightColor, dayColor, dayFactor);

      // Slight atmosphere rim on day side
      float rim = 1.0 - max(0.0, dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)));
      color += dayFactor * pow(rim, 3.0) * vec3(0.3, 0.5, 0.8) * 0.25;

      gl_FragColor = vec4(color, 1.0);
    }
  `
});

const earth = new THREE.Mesh(earthGeo, earthMat);
scene.add(earth);

// ===== Atmosphere =====
const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.018, 64, 64);
const atmosMat = new THREE.ShaderMaterial({
  uniforms: {
    glowColor: { value: new THREE.Color(0x4fc3f7) }
  },
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 glowColor;
    varying vec3 vNormal;
    void main() {
      float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
      gl_FragColor = vec4(glowColor, 1.0) * intensity;
    }
  `,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false
});
const atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
scene.add(atmosphere);

// ===== Clouds (subtle) =====
const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.008, 48, 48);
const cloudMat = new THREE.MeshPhongMaterial({
  map: textureLoader.load('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-water.png'),
  transparent: true,
  opacity: 0.18,
  depthWrite: false
});
const clouds = new THREE.Mesh(cloudGeo, cloudMat);
scene.add(clouds);

// ===== Major city light markers (extra emphasis) =====
const majorCities = [
  { lat: 40.7, lon: -74.0, name: 'New York' },
  { lat: 34.0, lon: -118.2, name: 'Los Angeles' },
  { lat: 51.5, lon: -0.1, name: 'London' },
  { lat: 48.9, lon: 2.3, name: 'Paris' },
  { lat: 35.7, lon: 139.7, name: 'Tokyo' },
  { lat: 31.2, lon: 121.5, name: 'Shanghai' },
  { lat: 22.3, lon: 114.2, name: 'Hong Kong' },
  { lat: 28.6, lon: 77.2, name: 'Delhi' },
  { lat: 19.4, lon: -99.1, name: 'Mexico City' },
  { lat: -23.5, lon: -46.6, name: 'São Paulo' },
  { lat: 37.6, lon: 126.9, name: 'Seoul' },
  { lat: 55.8, lon: 37.6, name: 'Moscow' },
  { lat: 30.0, lon: 31.2, name: 'Cairo' },
  { lat: 1.3, lon: 103.8, name: 'Singapore' },
  { lat: -33.9, lon: 151.2, name: 'Sydney' }
];

function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

const cityGroup = new THREE.Group();
majorCities.forEach(c => {
  const pos = latLonToVector3(c.lat, c.lon, EARTH_RADIUS * 1.005);
  const geo = new THREE.SphereGeometry(0.012, 8, 8);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffcc66,
    transparent: true,
    opacity: 0.85
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  cityGroup.add(mesh);

  // Soft glow
  const glowGeo = new THREE.SphereGeometry(0.028, 8, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa33,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.copy(pos);
  cityGroup.add(glow);
});
scene.add(cityGroup);

// ===== UI Logic =====
function openPanel(name) {
  Object.values(panels).forEach(p => p.classList.remove('open'));
  if (name && panels[name]) {
    panels[name].classList.add('open');
    infoCard.classList.add('hidden');
  } else {
    infoCard.classList.remove('hidden');
  }
  navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.panel === (name || 'explore'));
  });
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const panel = btn.dataset.panel;
    if (panel === 'explore') openPanel(null);
    else openPanel(panel);
  });
});

document.querySelectorAll('.close-panel').forEach(btn => {
  btn.addEventListener('click', () => openPanel(null));
});

// Close panel on Escape
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') openPanel(null);
});

toggleRotate.addEventListener('change', () => {
  controls.autoRotate = toggleRotate.checked;
});

toggleAtmosphere.addEventListener('change', () => {
  atmosphere.visible = toggleAtmosphere.checked;
});

lightIntensitySlider.addEventListener('input', () => {
  earthMat.uniforms.nightIntensity.value = parseFloat(lightIntensitySlider.value);
});

// ===== Resize =====
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== Animation =====
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Slow cloud drift
  clouds.rotation.y = t * 0.008;

  // Keep sun direction in sync for shader (roughly fixed relative to camera for demo feel)
  // For a more realistic day/night cycle we could rotate the sun, but fixed looks better for exploration
  const sunDir = new THREE.Vector3(5, 2, 4).normalize();
  earthMat.uniforms.sunDirection.value.copy(sunDir);

  controls.update();
  renderer.render(scene, camera);
}

animate();

// Initial state
openPanel(null);
