import * as THREE from 'three';
import './style.css';

const mount = document.querySelector('#game');
const scoreNode = document.querySelector('#score');
const bestNode = document.querySelector('#best');
const livesNode = document.querySelector('#lives');
const panel = document.querySelector('#message-panel');
const titleNode = document.querySelector('#message-title');
const copyNode = document.querySelector('#message-copy');
const kickerNode = document.querySelector('#message-kicker');
const startButton = document.querySelector('#start-button');
const startLabel = document.querySelector('#start-label');
const soundToggle = document.querySelector('#sound-toggle');
const soundGlyph = document.querySelector('#sound-glyph');
const shopToggle = document.querySelector('#shop-toggle');
const Dnode = document.querySelector('#difficulty');
const shopPanel = document.querySelector('#shop-panel');
const shopCoinsNode = document.querySelector('#shop-coins');
const Drag = 0.99;
let ShotTime = 0.7;
let shotClock = 0;
let Thrust = 2.5;
let MaxSpeed = 7;
let TurnSpeed = 1;
let ShotSpeed = 10;
let Exp = 0;
let Difficulty = 1;
let Coins = 0;
const purchasedUpgrades = { thrust: 0, speed: 0, turn: 0, weapon: 0, ShotTime: 0 };
const upgradeOptions = {
  thrust: { costScaling: 1, getValue: () => Thrust, apply: () => { Thrust += 1; }, format: (value) => value.toFixed(1) },
  speed: { costScaling: 1, getValue: () => MaxSpeed, apply: () => { MaxSpeed += 1; }, format: (value) => value.toFixed(1) },
  turn: { costScaling: 1, getValue: () => TurnSpeed, apply: () => { TurnSpeed += 0.3; }, format: (value) => value.toFixed(1) },
  weapon: { costScaling: 1, getValue: () => ShotSpeed, apply: () => { ShotSpeed += 2; }, format: (value) => value.toFixed(1) },
  ShotTime: { costScaling: 1, getValue: () => ShotTime, apply: () => { ShotTime -= 0.07; }, format: (value) => value.toFixed(1) }
};

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 100);
camera.position.set(0, 10, 0);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
mount.appendChild(renderer.domElement);

let worldWidth = 24;
let worldDepth = 16;
const keys = new Set();
const touchKeys = new Set();
const asteroids = [];
const shots = [];
const particles = [];
let state = 'ready';
let score = 0;
let lives = 3;
let level = 1;
let spawnClock = 0;
let lastTime = 0;
let soundEnabled = true;
let audioContext;
let bestScore = Number(localStorage.getItem('asteroid-drifter-best'));
bestNode.textContent = String(bestScore).padStart(5, '0');

scene.add(new THREE.HemisphereLight(0xbde9d8, 0x18251e, 2));
const keyLight = new THREE.DirectionalLight(0xffdfbd, 2.4);
keyLight.position.set(-5, 12, 7);
scene.add(keyLight);
const fillLight = new THREE.PointLight(0x75dfaa, 45, 28);
fillLight.position.set(6, 6, -6);
scene.add(fillLight);

scene.add(new THREE.Group());
const WrapMarker = new THREE.Mesh(
  new THREE.BoxGeometry(worldWidth / 0.75, 0.1, worldDepth / 0.75),
  new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.2 })
);
WrapMarker.position.set(0, -1, 0);
scene.add(WrapMarker);

scene.add(new THREE.Group());
const VoidMarker = new THREE.Mesh(
  new THREE.BoxGeometry(worldWidth * 4, 0.1, worldDepth * 4),
  new THREE.MeshStandardMaterial({ color: 0x800080, transparent: true, opacity: 0.2 })
);
scene.add(VoidMarker);





const ship = new THREE.Group();
const shipBody = new THREE.Mesh(
  new THREE.ConeGeometry(0.52, 1.38, 3),
  new THREE.MeshStandardMaterial({ color: 0xb6f57b, emissive: 0x426e31, emissiveIntensity: 0.8, roughness: 0.34, metalness: 0.35 })
);
shipBody.rotation.x = Math.PI / 2;
ship.add(shipBody);
const engineGlow = new THREE.PointLight(0xff765f, 0, 3);
engineGlow.position.set(0, 0.1, -0.65);
ship.add(engineGlow);
ship.position.y = 0;
scene.add(ship);
let shipVelocity = new THREE.Vector3();

const asteroidMaterial = new THREE.MeshStandardMaterial({ color: 0x718078, roughness: 0.94, metalness: 0.08, flatShading: true });
const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xff8c67 });

function playTone(frequency, duration = 0.08, type = 'sine', volume = 0.035) {
  if (!soundEnabled) return;
  audioContext ??= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function updateScore(value) {
  score += value;
  scoreNode.textContent = String(score).padStart(5, '0');
  if (score > bestScore) {
    bestScore = score;
    bestNode.textContent = String(bestScore).padStart(5, '0');
    localStorage.setItem('asteroid-drifter-best', String(bestScore));
  }
}


function makeAsteroid(size = 1) {
  const geometry = new THREE.IcosahedronGeometry(size, 1);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, asteroidMaterial.clone());
  mesh.material.color.setHSL(0.38 + Math.random() * 0.12, 0.08 + Math.random() * 0.1, 0.34 + Math.random() * 0.17);
  mesh.position.y = 0
  mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  const asteroid = {
    mesh,
    size,
    radius: size,
    velocity: new THREE.Vector3(),
    spin: new THREE.Vector3(Math.random() * 0.9 - 0.45, Math.random() * 0.9 - 0.45, Math.random() * 0.9 - 0.45)
  };
  asteroids.push(asteroid);
  scene.add(mesh);
  return asteroid;
}

function spawnAsteroid() {
  const size = Math.random() * 2 + 0.5 + Difficulty * 0.2;
  const asteroid = makeAsteroid(size);
  const edge = Math.floor(Math.random() * 4);
  asteroid.mesh.position.x = edge === 0 ? -worldWidth / 0.7 : edge === 1 ? worldWidth / 0.7 : (Math.random() - 0.5) * worldWidth;
  asteroid.mesh.position.z = edge === 2 ? -worldDepth / 0.7 : edge === 3 ? worldDepth / 0.7 : (Math.random() - 0.5) * worldDepth;
  asteroid.velocity.set((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10);
}

function addBurst(position, color, count = 10) {
  for (let index = 0; index < count; index += 1) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true });
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.06 + Math.random() * 0.08), material);
    mesh.position.copy(position);
    mesh.position.y = 0.55;
    scene.add(mesh);
    particles.push({ mesh, velocity: new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4), life: 0.35 + Math.random() * 0.35 });
  }
}

function fire() {
  if (shotClock > 0 || state !== 'playing') return;
  shotClock = ShotTime;
  const direction = new THREE.Vector3(Math.sin(ship.rotation.y), 0, Math.cos(ship.rotation.y));
  const geometry = new THREE.SphereGeometry(0.075, 8, 6);
  const mesh = new THREE.Mesh(geometry, projectileMaterial);
  mesh.position.copy(ship.position).add(direction.clone().multiplyScalar(0.1));
  mesh.position.y = 0.42;
  scene.add(mesh);
  shots.push({ mesh, velocity: direction.multiplyScalar(ShotSpeed).add(shipVelocity), life: 2 });
  playTone(680, 0.06, 'triangle', 0.018);
}

function destroyAsteroid(asteroid, index) {
  addBurst(asteroid.mesh.position, 0xffa276, 12);
  scene.remove(asteroid.mesh);
  asteroid.mesh.geometry.dispose();
  asteroid.mesh.material.dispose();
  asteroids.splice(index, 1);
  updateScore(asteroid.size > 0.9 ? 25 : 50);
  playTone(220, 0.12, 'sawtooth', 0.025);
  if (asteroid.size > 1.2) {
    for (let piece = 0; piece < 2; piece += 1) {
      const child = makeAsteroid(asteroid.size / ((Math.random() + 0.5 * 3)));
      child.mesh.position.copy(asteroid.mesh.position);
      child.velocity.set((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6);
    }
  }
}

function wrapPositionEntity(position) {
  if (position.x > worldWidth) position.x = -worldWidth;
  if (position.x < -worldWidth) position.x = worldWidth;
  if (position.z > worldDepth) position.z = -worldDepth;
  if (position.z < -worldDepth) position.z = worldDepth;
}
function wrapPosition(position) {
  if (position.x > worldWidth / 1.5) position.x = -worldWidth / 1.5;
  if (position.x < -worldWidth / 1.5) position.x = worldWidth / 1.5;
  if (position.z > worldDepth / 1.5) position.z = -worldDepth / 1.5;
  if (position.z < -worldDepth / 1.5) position.z = worldDepth / 1.5;
}


function setLives(value) {
  lives = value;
  [...livesNode.children].forEach((pip, index) => pip.classList.toggle('lost', index >= lives));
  livesNode.setAttribute('aria-label', `${lives} ${lives === 1 ? 'life' : 'lives'}`);
}

function loseLife() {
  if (state !== 'playing') return;
  setLives(lives - 1);
  addBurst(ship.position, 0xb6f57b, 22);
  playTone(105, 0.35, 'sawtooth', 0.06);
  shipVelocity.set(0, 0, 0);
  ship.position.set(0, 0.34, 0);
  ship.rotation.y = 0;
  Exp = 0;
  if (lives <= 0) {
    endRun();
  }
}

function showPanel(mode) {
  panel.classList.remove('hidden');
  if (mode === 'ready') {
    kickerNode.textContent = 'DEEP SPACE / SECTOR 01';
    titleNode.innerHTML = 'ASTEROID<br /><span>DRIFTER</span>';
    copyNode.textContent = 'Keep moving. The field won\'t.';
    startLabel.textContent = 'LAUNCH RUN';
  } else if (mode === 'paused') {
    kickerNode.textContent = 'FLIGHT SYSTEMS / STANDBY';
    titleNode.innerHTML = 'RUN<br /><span>PAUSED</span>';
    copyNode.textContent = 'Your drift is holding. Resume when ready.';
    startLabel.textContent = 'RESUME RUN';
  } else if (mode === 'shop') {
    kickerNode.textContent = 'FLIGHT SYSTEMS / UPGRADES';
    titleNode.innerHTML = 'SHOP';
    copyNode.textContent = 'Spend credits to tune your ship.';
    startLabel.textContent = 'CLOSE SHOP';
  } else {
    kickerNode.textContent = 'SIGNAL LOST / RUN COMPLETE';
    titleNode.innerHTML = 'SHIP<br /><span>LOST</span>';
    copyNode.textContent = `Final score ${String(score).padStart(5, '0')} / Best ${String(bestScore).padStart(5, '0')}`;
    startLabel.textContent = 'FLY AGAIN';
  }
  shopPanel.classList.toggle('hidden', mode !== 'shop');
  document.querySelector('.control-hint').classList.toggle('hidden', mode === 'shop');
  if (mode === 'shop') renderShop();
}

function startRun() {
  asteroids.forEach(({ mesh }) => scene.remove(mesh));
  shots.forEach(({ mesh }) => scene.remove(mesh));
  asteroids.length = 0;
  shots.length = 0;
  score = 0;
  ShotTime = 0.7;
  level = 1;
  Thrust = 2.5;
  MaxSpeed = 7;
  TurnSpeed = 1;
  ShotSpeed = 10;
  Exp = 0;
  Difficulty = 1;
  Coins = 0;
  Dnode.textContent = '1';
  Object.keys(purchasedUpgrades).forEach((key) => {purchasedUpgrades[key] = 0;});
  updateScore(0);
  setLives(3);
  ship.position.set(0, 0.34, 0);
  ship.rotation.y = 0;
  shipVelocity.set(0, 0, 0);
  spawnClock = 0;
  state = 'playing';
  panel.classList.add('hidden');
  for (let index = 0; index < 6; index += 1) spawnAsteroid();
  playTone(440, 0.15, 'sine', 0.04);
}

function endRun() {
  state = 'over';
  showPanel('over');
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    showPanel('paused');
  } else if (state === 'paused') {
    state = 'playing';
    panel.classList.add('hidden');
  }
}

function toggleShop() {
  if (state === 'playing') {
    state = 'shop';
    showPanel('shop');
  } else if (state === 'shop') {
    state = 'playing';
    panel.classList.add('hidden');
  }
}

function renderShop() {
  shopCoinsNode.textContent = String(Coins);
  Object.entries(upgradeOptions).forEach(([upgrade, option]) => {
    const button = shopPanel.querySelector(`[data-upgrade="${upgrade}"]`);
    const cost = getUpgradeCost(upgrade);
    button.querySelector('[data-upgrade-value]').textContent = option.format(option.getValue());
    button.querySelector('[data-upgrade-cost]').textContent = String(cost);
    button.disabled = Coins < cost;
  });
}

function getUpgradeCost(upgrade) {
  return Math.ceil(1 + purchasedUpgrades[upgrade] * upgradeOptions[upgrade].costScaling);
}

function purchaseUpgrade(upgrade) {
  const option = upgradeOptions[upgrade];
  if (!option) return;
  const cost = getUpgradeCost(upgrade);
  if (Coins < cost) return;
  Coins -= cost;
  purchasedUpgrades[upgrade] += 1;
  option.apply();
  renderShop();
}

function update(delta) {
  if (state !== 'playing') return;
  shotClock = Math.max(0, shotClock - delta);
  const left = keys.has('arrowleft') || keys.has('a') || touchKeys.has('left');
  const right = keys.has('arrowright') || keys.has('d') || touchKeys.has('right');
  const thrust = keys.has('arrowup') || keys.has('w') || touchKeys.has('thrust');
  const firing = keys.has(' ');
  const debug1 = keys.has('1'); 
  const debug2 = keys.has('2');
  const debug3 = keys.has('3');
  if (debug1) {
    Difficulty += 1;
    Dnode.textContent = String(Difficulty);
  }
  if (debug2) {
    spawnAsteroid();
  }
  if (debug3) {
    Coins += 1;
    shopCoinsNode.textContent = String(Coins);
  }
  if (left) ship.rotation.y += delta * TurnSpeed;
  if (right) ship.rotation.y -= delta * TurnSpeed;
  if (thrust) {
    const direction = new THREE.Vector3(Math.sin(ship.rotation.y), 0, Math.cos(ship.rotation.y));
    shipVelocity.addScaledVector(direction, delta * Thrust);
    engineGlow.intensity = 2.7;
  } else engineGlow.intensity = 0;
  shipVelocity.multiplyScalar(Math.pow(Drag, delta * 60));
  if (shipVelocity.length() > MaxSpeed) shipVelocity.setLength(MaxSpeed);
  ship.position.addScaledVector(shipVelocity, delta);
  wrapPosition(ship.position);
  if (firing) fire();
  camera.position.copy(ship.position).add(new THREE.Vector3(0, 10, 0));

  spawnClock += delta;
  const spawnInterval = Math.max(0.55, 1.65 - level * 0.07);
  if (spawnClock > spawnInterval && asteroids.length < 15 + Math.floor(Difficulty / 2)) {
    spawnClock = 0;
    spawnAsteroid();
  }

  for (let index = shots.length - 1; index >= 0; index -= 1) {
    const shot = shots[index];
    shot.mesh.position.addScaledVector(shot.velocity, delta);
    shot.life -= delta;
    if (shot.life <= 0) {
      scene.remove(shot.mesh);
      shots.splice(index, 1);
      continue;
    }
    let hit = false;
    for (let asteroidIndex = asteroids.length - 1; asteroidIndex >= 0; asteroidIndex -= 1) {
      const asteroid = asteroids[asteroidIndex];
      if (shot.mesh.position.distanceTo(asteroid.mesh.position) < asteroid.radius) {
        destroyAsteroid(asteroid, asteroidIndex);
        hit = true;
        break;
      }
    }
    if (hit) {
      scene.remove(shot.mesh);
      shots.splice(index, 1);
      Exp += 1;
    }
  }

  for (let index = asteroids.length - 1; index >= 0; index -= 1) {
    const asteroid = asteroids[index];
    asteroid.mesh.position.addScaledVector(asteroid.velocity, delta);
    asteroid.mesh.rotation.x += asteroid.spin.x * delta;
    asteroid.mesh.rotation.y += asteroid.spin.y * delta;
    asteroid.mesh.rotation.z += asteroid.spin.z * delta;
    wrapPositionEntity(asteroid.mesh.position);
    if (asteroid.mesh.position.distanceTo(ship.position) - 0.3 < asteroid.radius * 0.9) {
      scene.remove(asteroid.mesh);
      asteroid.mesh.geometry.dispose();
      asteroid.mesh.material.dispose();
      asteroids.splice(index, 1);
      loseLife();
      Dnode.textContent = String(Difficulty);

    }
  }

  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.mesh.position.addScaledVector(particle.velocity, delta);
    particle.life -= delta;
    particle.mesh.material.opacity = Math.max(0, particle.life * 1.6);
    if (particle.life <= 0) {
      scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      particle.mesh.material.dispose();
      particles.splice(index, 1);
    }
  }
}

function LevelUp() {
  if (Exp >= 10) {
    Coins += 1;
    Difficulty += 1;
    Exp = 0;
    Dnode.textContent = String(Difficulty);
  }
}

function animate(time) {
  requestAnimationFrame(animate);
  const delta = Math.min((time - lastTime) / 1000 || 0, 0.035);
  lastTime = time;
  update(delta);
  renderer.render(scene, camera);
  LevelUp();
}
requestAnimationFrame(animate);


function resize() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -(16 * aspect) / 2;
  camera.right = (16 * aspect) / 2;
  camera.top = 16 / 2;
  camera.bottom = -16 / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}
window.addEventListener('resize', resize);
resize();
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
  keys.add(key);
  if (key === 'p' || key === 'escape') togglePause();
  if (key === 'enter' && state !== 'playing' && state !== 'shop') startRun();
  if (key === 'f') toggleShop();
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
startButton.addEventListener('click', () => {
  if (state === 'shop') toggleShop();
  else if (state === 'paused') togglePause();
  else startRun();
});
shopToggle.addEventListener('click', toggleShop);
shopPanel.addEventListener('click', (event) => {
  const button = event.target.closest('[data-upgrade]');
  if (button) purchaseUpgrade(button.dataset.upgrade);
});
soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundGlyph.textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
  soundToggle.setAttribute('aria-label', soundEnabled ? 'Mute sound' : 'Enable sound');
  soundToggle.title = soundEnabled ? 'Mute sound' : 'Enable sound';
  if (soundEnabled) playTone(440, 0.08);
});
document.querySelector('#new-tab').addEventListener('click', () => window.open(window.location.href, '_blank', 'noopener,noreferrer'));
document.querySelectorAll('[data-control]').forEach((button) => {
  const control = button.dataset.control;
  const press = (event) => {
    event.preventDefault();
    touchKeys.add(control);
    button.classList.add('active');
    button.setPointerCapture(event.pointerId);
  };
  const release = () => {
    touchKeys.delete(control);
    button.classList.remove('active');
  };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});
