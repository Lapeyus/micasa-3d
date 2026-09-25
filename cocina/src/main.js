import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildModel, disposeModel, materials, PHASES } from './model.js';
import { DEFAULT_LAYOUT, LAYOUT_FIELDS, getPath, setPath, cloneLayout } from './layout.js';

const STORE_KEY = 'cocina-lavado-layout-v1';
const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const inFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();

// ---------- Estado ----------
let layout = loadLayout();
let model = null;
let dimGroup = null;
const state = {
  mode: 'orbit',          // orbit | walk | tour
  showDims: false,
  showItems: true,
  showLaundry: true,
  showLiving: true,
  autoCut: true,
  showShell: false,
  night: false,
  demolished: false,
  doorsOpen: true,
  busy: 0,
};

function loadLayout() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return mergeDeep(cloneLayout(DEFAULT_LAYOUT), JSON.parse(raw));
  } catch { /* sin almacenamiento disponible */ }
  return cloneLayout(DEFAULT_LAYOUT);
}
function saveLayout() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(layout)); } catch { /* ignorar */ }
}
function mergeDeep(a, b) {
  for (const k of Object.keys(b)) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k]) mergeDeep(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}

// ---------- Render ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer({ element: $('labels') });
labelRenderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 200);
camera.position.set(-3.6, 6.8, 7.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 0.8;
controls.maxDistance = 30;

// Luces
const hemi = new THREE.HemisphereLight(0xeef3ff, 0x8a5a3c, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 40 });
scene.add(sun, sun.target);
const lampLights = [];

function applyLighting() {
  const M = materials();
  sun.intensity = state.night ? 0 : 3.2;
  hemi.intensity = state.night ? 0.06 : 0.9;
  scene.environmentIntensity = state.night ? 0.05 : 0.35;
  for (const l of lampLights) l.intensity = state.night ? 5 : 0;
  M.bulb.emissiveIntensity = state.night ? 3 : 0.2;
  M.foliage.color.set(state.night ? 0x1c2a22 : 0xcfe0c0);
  scene.background = new THREE.Color(state.night ? 0x0d1118 : 0xcfdde6);
}

// ---------- Modelo ----------
function rebuild({ keepCamera = true } = {}) {
  if (model) {
    scene.remove(model.root);
    disposeModel(model);
  }
  for (const l of lampLights) scene.remove(l);
  lampLights.length = 0;

  model = buildModel(layout);
  scene.add(model.root);

  for (const p of model.lamps) {
    const l = new THREE.PointLight(0xffd9a0, 0, 7, 1.6);
    l.position.copy(p);
    scene.add(l);
    lampLights.push(l);
  }
  sun.position.copy(model.sunTarget).add(new THREE.Vector3(7 * model.windowSide, 7.5, -2.5));
  sun.target.position.copy(model.sunTarget);

  for (const it of model.items) {
    it.userData.removed = false;
    if (state.demolished && isDemolishable(it)) it.userData.removed = true;
  }
  setDoors(state.doorsOpen, true);
  buildDims();
  applyLighting();
  if (!keepCamera) setView('maqueta', true);
}

const isDemolishable = (it) => it.userData.tags.includes('kitchen');

// ---------- Cotas ----------
function buildDims() {
  if (dimGroup) {
    dimGroup.traverse((o) => { if (o.isCSS2DObject) o.element.remove(); if (o.geometry) o.geometry.dispose(); });
    scene.remove(dimGroup);
  }
  dimGroup = new THREE.Group();
  const color = getComputedStyle(document.documentElement).getPropertyValue('--dim').trim() || '#a4452b';
  const mat = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true });
  for (const d of model.dims) {
    const a = new THREE.Vector3(...d.a), b = new THREE.Vector3(...d.b);
    const dir = b.clone().sub(a).normalize();
    const perp = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const t = perp.multiplyScalar(0.06);
    const pts = [a, b, a.clone().add(t), a.clone().sub(t), b.clone().add(t), b.clone().sub(t)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.LineSegments(geo, mat);
    line.renderOrder = 10;
    dimGroup.add(line);
    const el = document.createElement('div');
    el.className = 'dim-label';
    el.textContent = d.label;
    const lab = new CSS2DObject(el);
    lab.position.copy(a).lerp(b, 0.5);
    dimGroup.add(lab);
  }
  dimGroup.visible = state.showDims;
  $('labels').style.display = state.showDims ? '' : 'none';
  scene.add(dimGroup);
}

// ---------- Animación ----------
const tweens = new Set();
const ease = {
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  out: (k) => 1 - Math.pow(1 - k, 3),
  outBack: (k) => { const c = 1.4; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  in: (k) => k * k * k,
};
function tween({ dur = 1, delay = 0, update, e = ease.inOut }) {
  if (reduceMotion) { dur = Math.min(dur, 0.01); delay = 0; }
  return new Promise((resolve) => tweens.add({ t: -delay, dur, update, e, resolve }));
}
function stepTweens(dt) {
  for (const tw of tweens) {
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = Math.min(1, tw.t / tw.dur);
    tw.update(tw.e(k));
    if (k >= 1) { tweens.delete(tw); tw.resolve(); }
  }
}
function stopAll() {
  for (const tw of tweens) { tw.update(1); tw.resolve(); }
  tweens.clear();
  // Deja cada pieza en su lugar final aunque su animación no hubiera empezado.
  if (model) {
    for (const it of model.items) {
      const u = it.userData;
      if (u.pending || u.leaving) {
        u.pending = false;
        u.leaving = false;
        it.position.copy(u.home);
        it.scale.set(1, 1, 1);
      }
    }
  }
  generation++;
  camGen++;
}
let generation = 0;
let camGen = 0;
const wait = (s) => tween({ dur: s, update: () => {} });

function hiddenPose(it) {
  const h = it.userData.home;
  it.userData.pending = true;
  it.position.copy(h);
  it.scale.set(1, 1, 1);
  if (it.userData.anim === 'spread') it.scale.set(0.001, 1, 0.001);
  else if (it.userData.anim === 'grow') it.scale.set(1, 0.001, 1);
  else { it.position.y = h.y + 1.8; it.scale.setScalar(0.001); }
}
function animateIn(it, delay, dur = 0.9) {
  const h = it.userData.home;
  const type = it.userData.anim;
  return tween({
    dur, delay, e: type === 'drop' ? ease.out : ease.inOut,
    update: (k) => {
      it.userData.pending = false;
      if (type === 'spread') it.scale.set(k || 0.001, 1, k || 0.001);
      else if (type === 'grow') it.scale.set(1, Math.max(k, 0.001), 1);
      else {
        it.position.y = h.y + 1.8 * (1 - k);
        it.scale.setScalar(Math.max(0.001, Math.min(1, k * 1.4)));
      }
    },
  });
}
function animateOut(it, delay, dur = 0.7) {
  const h = it.userData.home;
  it.userData.leaving = true;
  return tween({
    dur, delay, e: ease.in,
    update: (k) => {
      it.position.y = h.y + 1.6 * k;
      it.scale.setScalar(Math.max(0.001, 1 - k));
    },
  }).then(() => { it.userData.leaving = false; it.position.copy(h); it.scale.set(1, 1, 1); });
}

async function playBuild() {
  stopAll();
  const gen = ++generation;
  state.busy++;
  state.demolished = false;
  $('btnRestore').disabled = true;
  if (state.mode !== 'orbit') setMode('orbit');
  const tl = $('timeline');
  tl.replaceChildren(...PHASES.map((p) => Object.assign(document.createElement('span'), { textContent: p })));
  tl.hidden = false;
  for (const it of model.items) { it.userData.removed = false; hiddenPose(it); }
  setView('maqueta');
  await wait(0.6);
  for (let p = 0; p < PHASES.length; p++) {
    if (gen !== generation) break;
    [...tl.children].forEach((s, i) => { s.className = i < p ? 'done' : i === p ? 'now' : ''; });
    const list = model.items.filter((it) => it.userData.phase === p);
    const step = Math.min(0.14, 1.4 / Math.max(list.length, 1));
    const all = list.map((it, i) => animateIn(it, i * step));
    await Promise.all(all);
    await wait(0.15);
  }
  if (gen === generation) {
    [...tl.children].forEach((s) => { s.className = 'done'; });
    await wait(1.2);
  }
  tl.hidden = true;
  state.busy--;
  $('btnDemo').disabled = false;
}

async function demolish() {
  if (state.demolished) return;
  stopAll();
  state.busy++;
  state.demolished = true;
  $('btnDemo').disabled = true;
  const order = [7, 6, 5, 4];
  let i = 0;
  const jobs = [];
  for (const p of order) {
    for (const it of model.items.filter((x) => x.userData.phase === p && isDemolishable(x))) {
      it.userData.removed = true;
      jobs.push(animateOut(it, i++ * 0.12));
    }
  }
  await Promise.all(jobs);
  if (!state.showDims) toggleDims(true);
  $('btnRestore').disabled = false;
  state.busy--;
}

async function restore() {
  if (!state.demolished) return;
  stopAll();
  state.busy++;
  state.demolished = false;
  $('btnRestore').disabled = true;
  let i = 0;
  const jobs = [];
  for (const p of [4, 5, 6, 7]) {
    for (const it of model.items.filter((x) => x.userData.phase === p && isDemolishable(x))) {
      it.userData.removed = false;
      hiddenPose(it);
      jobs.push(animateIn(it, i++ * 0.12));
    }
  }
  await Promise.all(jobs);
  $('btnDemo').disabled = false;
  state.busy--;
}

function setDoors(open, instant = false) {
  state.doorsOpen = open;
  for (const d of Object.values(model.doors)) {
    const from = d.rotation.y;
    const to = open ? d.userData.open : 0;
    if (instant) d.rotation.y = to;
    else tween({ dur: 1.4, update: (k) => { d.rotation.y = from + (to - from) * k; } });
  }
}

// ---------- Cámara ----------
const walk = { yaw: 0, pitch: 0, keys: new Set(), speed: 1.5 };

function setMode(mode) {
  state.mode = mode;
  controls.enabled = mode === 'orbit';
  $('btnWalk').setAttribute('aria-pressed', String(mode === 'walk'));
  const walking = mode === 'walk';
  $('walkHint').hidden = !walking;
  $('dpad').hidden = !walking;
}

function lookToYawPitch(from, to) {
  const d = to.clone().sub(from).normalize();
  walk.yaw = Math.atan2(-d.x, -d.z);
  walk.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
}
function applyWalkLook() {
  camera.rotation.order = 'YXZ';
  camera.rotation.set(walk.pitch, walk.yaw, 0);
}

async function setView(name, instant = false) {
  const v = model.views[name];
  if (!v) return;
  const gen = ++camGen;
  const toPos = new THREE.Vector3(...v.pos);
  const toTgt = new THREE.Vector3(...v.target);
  const fromPos = camera.position.clone();
  const fromTgt = new THREE.Vector3();
  camera.getWorldDirection(fromTgt);
  fromTgt.multiplyScalar(state.mode === 'orbit' ? camera.position.distanceTo(controls.target) : 3).add(camera.position);
  setMode('tour');
  const dur = instant ? 0.001 : 1.6;
  // al entrar a una vista interior, pasar primero por arriba del techo evita atravesar paredes
  const high = !v.orbit || fromPos.y > 3 ? Math.max(fromPos.y, toPos.y) : 0;
  await tween({
    dur,
    update: (k) => {
      if (gen !== camGen) return;
      camera.position.lerpVectors(fromPos, toPos, k);
      if (!v.orbit && fromPos.y > 3) camera.position.y = THREE.MathUtils.lerp(fromPos.y, toPos.y, ease.in(k));
      else if (high && fromPos.y < 3 && v.orbit) camera.position.y = THREE.MathUtils.lerp(fromPos.y, toPos.y, ease.out(k));
      const t = fromTgt.clone().lerp(toTgt, k);
      camera.lookAt(t);
    },
  });
  if (gen !== camGen) return;
  if (v.orbit) {
    setShell(!!v.shell);
    controls.target.copy(toTgt);
    setMode('orbit');
  } else {
    lookToYawPitch(toPos, toTgt);
    applyWalkLook();
    setMode('walk');
  }
}

async function playTour() {
  stopAll();
  const gen = ++camGen;
  const curve = new THREE.CatmullRomCurve3(model.tour.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const start = curve.getPointAt(0);
  const fromPos = camera.position.clone();
  setMode('tour');
  await tween({ dur: 1.4, update: (k) => { camera.position.lerpVectors(fromPos, start, k); camera.lookAt(curve.getPointAt(0.05)); } });
  const sink = model.sink;
  await tween({
    dur: 22,
    e: (k) => k,
    update: (k) => {
      if (gen !== camGen) return;
      const s = ease.inOut(k);
      camera.position.copy(curve.getPointAt(s));
      const ahead = curve.getPointAt(Math.min(1, s + 0.05));
      ahead.y -= 0.12;
      // mirar hacia el fregadero al pasar por la cocina
      const glance = Math.max(0, 1 - Math.abs(s - 0.62) / 0.14);
      ahead.lerp(sink, glance * 0.8);
      camera.lookAt(ahead);
    },
  });
  if (gen !== camGen) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  lookToYawPitch(camera.position, camera.position.clone().add(dir));
  applyWalkLook();
  setMode('walk');
}

async function orbitShow() {
  stopAll();
  if (state.mode !== 'orbit') await setView('maqueta');
  const g2 = ++camGen;
  const c = controls.target.clone();
  const r = Math.hypot(camera.position.x - c.x, camera.position.z - c.z);
  const a0 = Math.atan2(camera.position.z - c.z, camera.position.x - c.x);
  const y = camera.position.y;
  setMode('tour');
  await tween({
    dur: 16, e: (k) => k,
    update: (k) => {
      if (g2 !== camGen) return;
      const a = a0 + k * Math.PI * 2;
      camera.position.set(c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r);
      camera.lookAt(c);
    },
  });
  if (g2 === camGen) setMode('orbit');
}

// Movimiento en modo caminar, con colisión contra las áreas transitables.
function canStand(x, z) {
  return model.walk.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
}
const dpadMove = new Set();
function stepWalk(dt) {
  if (state.mode !== 'walk') return;
  let f = 0, s = 0;
  const k = walk.keys;
  if (k.has('KeyW') || k.has('ArrowUp') || dpadMove.has('f')) f += 1;
  if (k.has('KeyS') || k.has('ArrowDown') || dpadMove.has('b')) f -= 1;
  if (k.has('KeyD') || dpadMove.has('r')) s += 1;
  if (k.has('KeyA') || dpadMove.has('l')) s -= 1;
  if (k.has('ArrowLeft')) walk.yaw += dt * 1.6;
  if (k.has('ArrowRight')) walk.yaw -= dt * 1.6;
  if (f || s) {
    const sp = walk.speed * dt;
    const fx = -Math.sin(walk.yaw), fz = -Math.cos(walk.yaw);
    const dx = (fx * f - fz * s) * sp;
    const dz = (fz * f + fx * s) * sp;
    const p = camera.position;
    const inside = canStand(p.x, p.z);
    if (!inside || canStand(p.x + dx, p.z + dz)) { p.x += dx; p.z += dz; }
    else if (canStand(p.x + dx, p.z)) p.x += dx;
    else if (canStand(p.x, p.z + dz)) p.z += dz;
  }
  applyWalkLook();
}

// Arrastrar para mirar
let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (state.mode !== 'walk') return;
  drag = { x: e.clientX, y: e.clientY };
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (drag && state.mode === 'walk') {
    walk.yaw += (e.clientX - drag.x) * 0.0042;
    walk.pitch = THREE.MathUtils.clamp(walk.pitch + (e.clientY - drag.y) * 0.0036, -1.3, 1.3);
    drag = { x: e.clientX, y: e.clientY };
  }
  queueHover(e);
});
renderer.domElement.addEventListener('pointerup', () => { drag = null; });
renderer.domElement.addEventListener('pointerleave', () => { $('hoverTag').hidden = true; });
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  walk.keys.add(e.code);
  if (state.mode === 'walk' && e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => walk.keys.delete(e.code));
addEventListener('blur', () => walk.keys.clear());
for (const btn of document.querySelectorAll('.dpad button')) {
  const m = btn.dataset.move;
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); dpadMove.add(m); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, () => dpadMove.delete(m));
}

// Nombre del elemento bajo el cursor
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hoverPending = null;
function queueHover(e) {
  if (hoverPending || drag || e.pointerType === 'touch') return;
  hoverPending = requestAnimationFrame(() => {
    hoverPending = null;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(model.items.filter((i) => i.visible), true)[0];
    const tag = $('hoverTag');
    let o = hit?.object;
    while (o && !o.userData?.name) o = o.parent;
    if (o && o !== model.root) {
      tag.textContent = o.userData.name;
      tag.style.left = `${e.clientX}px`;
      tag.style.top = `${e.clientY}px`;
      tag.hidden = false;
    } else tag.hidden = true;
  });
}

// ---------- Visibilidad por filtros y corte automático ----------
function updateVisibility() {
  const H = layout.ceilingHeight;
  const cam = camera.position;
  const outside = cam.y > H + 0.15 || !canStand(cam.x, cam.z);
  model.backdrop.visible = !outside;
  for (const it of model.items) {
    const tags = it.userData.tags;
    let v = !it.userData.removed;
    if (!state.showItems && tags.includes('items')) v = false;
    if (!state.showLaundry && tags.includes('laundry')) v = false;
    if (!state.showLiving && tags.includes('living')) v = false;
    const shellOn = state.showShell && outside;
    if (tags.includes('shell')) v = v && shellOn;
    if (tags.includes('shell-tree')) v = v && (shellOn || cam.y < H);
    if (state.autoCut && outside && state.mode !== 'walk' && !shellOn) {
      if (tags.includes('ceiling') && cam.y > H) v = false;
      const n = it.userData.normal;
      if (n) {
        const h = it.userData.home, sx = model.root.scale.x;
        if ((cam.x - sx * h.x) * sx * n[0] + (cam.z - h.z) * n[2] > 0.05) v = false;
      }
    }
    if (it.userData.pending) v = false;
    if (it.userData.leaving) v = true;
    it.visible = v;
  }
}

// ---------- UI ----------
function selectTab(id) {
  for (const t of document.querySelectorAll('[role="tab"]')) {
    const on = t.id === id;
    t.setAttribute('aria-selected', String(on));
    $(t.getAttribute('aria-controls')).hidden = !on;
  }
}
for (const t of document.querySelectorAll('[role="tab"]')) t.addEventListener('click', () => selectTab(t.id));
$('btnPanel').addEventListener('click', () => {
  const closed = document.body.classList.toggle('panel-closed');
  const b = $('btnPanel');
  b.textContent = closed ? 'Mostrar panel' : '✕';
  b.setAttribute('aria-label', closed ? 'Mostrar panel' : 'Ocultar panel');
  b.title = b.getAttribute('aria-label');
});
for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => { stopAll(); setView(b.dataset.view); });

$('btnWalk').addEventListener('click', () => {
  if (state.mode === 'walk') { setView('maqueta'); return; }
  stopAll();
  setView('entrada');
});

function chip(id, key, after) {
  const el = $(id);
  el.addEventListener('click', () => {
    state[key] = !state[key];
    el.setAttribute('aria-pressed', String(state[key]));
    after?.();
  });
}
function toggleDims(force) {
  state.showDims = force ?? !state.showDims;
  $('tgDims').setAttribute('aria-pressed', String(state.showDims));
  dimGroup.visible = state.showDims;
  $('labels').style.display = state.showDims ? '' : 'none';
}
$('tgDims').addEventListener('click', () => toggleDims());
function setShell(on) {
  state.showShell = on;
  $('tgShell').setAttribute('aria-pressed', String(on));
}
$('tgShell').addEventListener('click', () => setShell(!state.showShell));
chip('tgItems', 'showItems');
chip('tgLaundry', 'showLaundry');
chip('tgLiving', 'showLiving');
chip('tgCut', 'autoCut');
chip('tgNight', 'night', applyLighting);

$('btnBuild').addEventListener('click', playBuild);
$('btnDemo').addEventListener('click', demolish);
$('btnRestore').addEventListener('click', restore);
$('btnTour').addEventListener('click', playTour);
$('btnOrbit').addEventListener('click', orbitShow);
$('btnDoors').addEventListener('click', () => setDoors(!state.doorsOpen));
$('btnStop').addEventListener('click', () => {
  stopAll();
  if (state.mode === 'tour') setMode('orbit');
  $('timeline').hidden = true;
});

// Campos de medidas
function renderFields() {
  const box = $('fields');
  box.replaceChildren();
  let group = null;
  for (const f of LAYOUT_FIELDS) {
    if (f.group !== group) {
      group = f.group;
      const h = document.createElement('div');
      h.className = 'group-title';
      h.textContent = group;
      box.append(h);
    }
    const row = document.createElement('div');
    row.className = 'field';
    const id = `f-${f.key.replace(/\./g, '-')}`;
    const lab = Object.assign(document.createElement('label'), { htmlFor: id, textContent: f.label });
    const wrap = Object.assign(document.createElement('div'), { className: 'inp' });
    const inp = Object.assign(document.createElement('input'), {
      id, type: 'number', step: '0.01', min: f.min, max: f.max, value: getPath(layout, f.key).toFixed(2), inputMode: 'decimal',
    });
    inp.addEventListener('change', () => {
      const v = parseFloat(inp.value);
      if (!Number.isFinite(v) || v < f.min || v > f.max) {
        status(`${f.label}: use un valor entre ${f.min} y ${f.max} m.`);
        inp.value = getPath(layout, f.key).toFixed(2);
        return;
      }
      setPath(layout, f.key, v);
      saveLayout();
      rebuild();
      status(`${f.label} = ${v.toFixed(2)} m. Modelo actualizado.`);
    });
    wrap.append(inp);
    row.append(lab, wrap);
    box.append(row);
  }
}
function status(msg) { $('status').textContent = msg; }

$('btnReset').addEventListener('click', () => {
  layout = cloneLayout(DEFAULT_LAYOUT);
  saveLayout();
  renderFields();
  rebuild();
  status('Medidas estimadas restablecidas.');
});
$('btnCopy').addEventListener('click', async () => {
  const text = JSON.stringify(layout, null, 2);
  try { await navigator.clipboard.writeText(text); status('Medidas copiadas al portapapeles.'); }
  catch { status('No se pudo copiar. Las medidas están en la consola del navegador.'); console.log(text); }
});

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
if (!inFrame) {
  $('btnGlb').hidden = false;
  $('btnJson').hidden = false;
  $('btnGlb').addEventListener('click', () => {
    status('Exportando…');
    new GLTFExporter().parse(model.root, (glb) => {
      download(new Blob([glb], { type: 'model/gltf-binary' }), 'cocina-lavado.glb');
      status('Descargado cocina-lavado.glb (abre en Blender, SketchUp o cualquier visor 3D).');
    }, (err) => status(`Error al exportar: ${err.message}`), { binary: true });
  });
  $('btnJson').addEventListener('click', () => {
    download(new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' }), 'medidas-cocina-lavado.json');
    status('Descargado medidas-cocina-lavado.json.');
  });
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
});

// ---------- Arranque ----------
renderFields();
rebuild({ keepCamera: true });
controls.target.set(...model.views.maqueta.target);
camera.position.set(...model.views.maqueta.pos);
controls.update();
$('loading').remove();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  stepTweens(dt);
  stepWalk(dt);
  if (state.mode === 'orbit') controls.update();
  updateVisibility();
  renderer.render(scene, camera);
  if (state.showDims) labelRenderer.render(scene, camera);
});

// Arranca con la animación de construcción la primera vez
playBuild();

// Acceso para depurar desde la consola del navegador.
window.__cocina = { THREE, scene, camera, controls, state, get model() { return model; }, get layout() { return layout; } };
