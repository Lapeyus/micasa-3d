import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildHouse, disposeHouse } from './arch/scene3d.js';
import { PlanEditor, newOpening } from './arch/plan.js';
import { PanoViewer } from './arch/pano.js';
import { validate, bounds, OPENING_KINDS, SIDES } from './core/geometry.js';

const STORE = 'casa-json-v1';
const $ = (id) => document.getElementById(id);
const inFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();
const clone = (o) => JSON.parse(JSON.stringify(o));

const DEFAULT = await fetch('./src/core/casa.default.json').then((r) => r.json());
let casa = load();
const undo = [];

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return JSON.parse(raw);
  } catch { /* sin almacenamiento */ }
  return clone(DEFAULT);
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(casa)); } catch { /* ignorar */ }
}
function checkpoint() {
  undo.push(JSON.stringify(casa));
  if (undo.length > 80) undo.shift();
}
function changed({ rebuild3d = true } = {}) {
  save();
  showIssues();
  if (rebuild3d) dirty3d = true;
  if (mode === '3d' && dirty3d) rebuild();
}

// ---------- Modo ----------
let mode = 'plan';
function setMode(m) {
  mode = m;
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-selected', String(b.dataset.mode === m));
  $('plan').hidden = m !== 'plan';
  $('stage3d').hidden = m !== '3d';
  for (const p of document.querySelectorAll('[data-pane]')) p.hidden = p.dataset.pane !== m;
  if (m === '3d') { resize3d(); if (dirty3d) rebuild(); }
  if (m === 'plan') { plan.render(); }
  if (m === 'panos') renderPanoList();
}
for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));

// ---------- Planta ----------
const plan = new PlanEditor($('plan'), {
  onChange: () => { changed(); renderInspector(); },
  onSelect: () => renderInspector(),
  onOpenPano: (id) => openPano(id),
});
$('plan').addEventListener('pointerdown', () => checkpoint(), { capture: true });

function field(label, value, onInput, { type = 'number', step = '0.05', options = null, id } = {}) {
  const row = document.createElement('label');
  row.className = 'f';
  const span = document.createElement('span');
  span.textContent = label;
  let input;
  if (options) {
    input = document.createElement('select');
    for (const [v, t] of options) input.append(new Option(t, v, false, v === value));
  } else {
    input = document.createElement('input');
    input.type = type;
    if (type === 'number') { input.step = step; input.inputMode = 'decimal'; }
    input.value = value ?? '';
  }
  if (id) input.id = id;
  input.addEventListener('change', () => {
    checkpoint();
    const v = type === 'number' && !options ? parseFloat(input.value) : input.value;
    if (type === 'number' && !options && !Number.isFinite(v)) return;
    onInput(v);
    changed();
    plan.render();
    renderInspector();
  });
  row.append(span, input);
  return row;
}

const KINDS = [['sala', 'Sala'], ['cocina', 'Cocina'], ['dormitorio', 'Dormitorio'], ['bano', 'Baño'], ['lavado', 'Lavado'], ['estudio', 'Estudio'], ['oficina', 'Oficina'], ['pasillo', 'Pasillo'], ['vestibulo', 'Vestíbulo'], ['gimnasio', 'Gimnasio'], ['bodega', 'Bodega']];
const FLOORS = [['provenzal', 'Barro provenzal'], ['parquet', 'Parquet'], ['hidraulico', 'Mosaico hidráulico'], ['ceramica', 'Cerámica'], ['cemento', 'Cemento']];
const CEILS = [['tablilla', 'Tablilla de madera'], ['vigas', 'Blanco con vigas'], ['blanco', 'Blanco liso']];
const SIDE_NAMES = { S: 'Frente (S)', N: 'Fondo (N)', W: 'Izquierda (O)', E: 'Derecha (E)' };

function renderInspector() {
  const box = $('inspector');
  box.replaceChildren();
  const sel = plan.sel;
  const h = (t) => { const e = document.createElement('h3'); e.textContent = t; box.append(e); };
  if (!sel) {
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = 'Toque un cuarto para editarlo. Arrastre para moverlo, arrastre sus bordes para cambiar medidas. Las puertas se deslizan por su muro. Rueda o pellizco para acercar.';
    box.append(p);
    return;
  }
  if (sel.type === 'room') {
    const r = casa.rooms.find((q) => q.id === sel.id);
    if (!r) return;
    h(r.name);
    const [x0, z0, x1, z1] = r.rect;
    box.append(
      field('Nombre', r.name, (v) => { r.name = v; }, { type: 'text' }),
      field('Tipo', r.kind, (v) => { r.kind = v; }, { options: KINDS }),
      grid2(
        field('Ancho (m)', (x1 - x0).toFixed(2), (v) => { r.rect[2] = +(r.rect[0] + Math.max(0.5, v)).toFixed(3); }),
        field('Fondo (m)', (z1 - z0).toFixed(2), (v) => { r.rect[3] = +(r.rect[1] + Math.max(0.5, v)).toFixed(3); }),
        field('Posición x', x0.toFixed(2), (v) => { const w = r.rect[2] - r.rect[0]; r.rect[0] = v; r.rect[2] = +(v + w).toFixed(3); }),
        field('Posición z', z0.toFixed(2), (v) => { const d = r.rect[3] - r.rect[1]; r.rect[1] = v; r.rect[3] = +(v + d).toFixed(3); }),
      ),
      field('Altura del cielo (m)', (r.ceiling ?? casa.defaults.ceiling).toFixed(2), (v) => { r.ceiling = v; }),
      field('Piso', r.floor ?? casa.defaults.floor, (v) => { r.floor = v; }, { options: FLOORS }),
      field('Cielo raso', r.ceilingFinish ?? casa.defaults.ceilingFinish, (v) => { r.ceilingFinish = v; }, { options: CEILS }),
      field('Color de paredes', r.wallColor ?? casa.defaults.wallColor, (v) => { r.wallColor = v; }, { type: 'color' }),
    );
    h('Puertas y ventanas');
    const ops = casa.openings.filter((o) => o.room === r.id);
    for (const o of ops) box.append(openingRow(o));
    const add = document.createElement('div');
    add.className = 'row';
    const sideSel = document.createElement('select');
    sideSel.id = 'addSide';
    for (const s of SIDES) sideSel.append(new Option(SIDE_NAMES[s], s));
    const kindSel = document.createElement('select');
    kindSel.id = 'addKind';
    for (const [k, v] of Object.entries(OPENING_KINDS)) kindSel.append(new Option(v.label, k));
    const btn = button('Agregar', () => {
      checkpoint();
      casa.openings.push(newOpening(r, sideSel.value, kindSel.value));
      changed(); plan.render(); renderInspector();
    });
    add.append(sideSel, kindSel, btn);
    box.append(add);
    const actions = document.createElement('div');
    actions.className = 'row';
    actions.append(
      button('Duplicar cuarto', () => {
        checkpoint();
        const c = clone(r);
        c.id = `${r.id}-${Math.random().toString(36).slice(2, 5)}`;
        c.name = `${r.name} (copia)`;
        const w = r.rect[2] - r.rect[0];
        c.rect = [r.rect[2] + 0.15, r.rect[1], r.rect[2] + 0.15 + w, r.rect[3]];
        casa.rooms.push(c);
        changed(); plan.select({ type: 'room', id: c.id });
      }),
      button('Eliminar cuarto', () => {
        checkpoint();
        casa.rooms = casa.rooms.filter((q) => q !== r);
        casa.openings = casa.openings.filter((o) => o.room !== r.id);
        changed(); plan.select(null);
      }, 'danger'),
    );
    box.append(actions);
  } else if (sel.type === 'opening') {
    const o = casa.openings.find((q) => q.id === sel.id);
    if (!o) return;
    h(OPENING_KINDS[o.kind]?.label ?? 'Vano');
    box.append(openingRow(o, true));
  } else if (sel.type === 'pano') {
    const p = casa.panoramas.find((q) => q.id === sel.id);
    if (!p) return;
    h(p.name);
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = 'Arrastre el punto al lugar exacto donde tomó la foto. Así la vista 3D y la foto quedan alineadas.';
    box.append(note, button('Ver panorámica', () => openPano(p.id), 'primary'));
  }
}

function openingRow(o, full = false) {
  const wrap = document.createElement('div');
  wrap.className = 'oprow';
  const info = OPENING_KINDS[o.kind] ?? OPENING_KINDS.vano;
  const title = document.createElement('div');
  title.className = 'optitle';
  title.textContent = `${info.label} · ${SIDE_NAMES[o.side]}`;
  wrap.append(title);
  wrap.append(grid2(
    field('Tipo', o.kind, (v) => { o.kind = v; }, { options: Object.entries(OPENING_KINDS).map(([k, v]) => [k, v.label]) }),
    field('Lado', o.side, (v) => { o.side = v; }, { options: SIDES.map((s) => [s, SIDE_NAMES[s]]) }),
    field('Desde la esquina (m)', o.offset.toFixed(2), (v) => { o.offset = v; }),
    field('Ancho (m)', o.width.toFixed(2), (v) => { o.width = v; }),
    field('Alto (m)', (o.height ?? info.height).toFixed(2), (v) => { o.height = v; }),
    ...(info.window ? [field('Repisa (m)', (o.sill ?? info.sill).toFixed(2), (v) => { o.sill = v; })] : []),
  ));
  const del = button('Quitar', () => {
    checkpoint();
    casa.openings = casa.openings.filter((q) => q !== o);
    changed(); plan.select(full ? null : plan.sel);
  }, 'danger small');
  wrap.append(del);
  return wrap;
}

function grid2(...children) {
  const g = document.createElement('div');
  g.className = 'g2';
  g.append(...children);
  return g;
}
function button(text, onClick, cls = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn ${cls}`;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

$('btnAddRoom').addEventListener('click', () => {
  checkpoint();
  const v = plan.view;
  const cx = +(v.x + v.w / 2).toFixed(2), cz = +(-(v.y + v.h / 2)).toFixed(2);
  const id = `cuarto-${Math.random().toString(36).slice(2, 6)}`;
  casa.rooms.push({ id, name: 'Cuarto nuevo', kind: 'dormitorio', rect: [cx - 1.5, cz - 1.5, cx + 1.5, cz + 1.5] });
  changed();
  plan.select({ type: 'room', id });
});
$('btnFit').addEventListener('click', () => { plan.fit(); plan.render(); });
$('btnUndo').addEventListener('click', doUndo);
addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); doUndo(); }
});
function doUndo() {
  const s = undo.pop();
  if (!s) return;
  casa = JSON.parse(s);
  plan.setCasa(casa);
  changed();
  renderInspector();
}

function showIssues() {
  const list = validate(casa);
  const box = $('issues');
  box.replaceChildren();
  box.hidden = list.length === 0;
  for (const t of list) {
    const li = document.createElement('li');
    li.textContent = t;
    box.append(li);
  }
}

// ---------- Datos ----------
$('btnCopyJson').addEventListener('click', async () => {
  const text = JSON.stringify(casa, null, 2);
  try { await navigator.clipboard.writeText(text); status('casa.json copiado al portapapeles.'); }
  catch { status('No se pudo copiar; revise la consola del navegador.'); console.log(text); }
});
$('btnReset').addEventListener('click', () => {
  if (!$('btnReset').dataset.armed) {
    $('btnReset').dataset.armed = '1';
    $('btnReset').textContent = 'Confirmar: volver al borrador';
    setTimeout(() => { delete $('btnReset').dataset.armed; $('btnReset').textContent = 'Volver al borrador'; }, 4000);
    return;
  }
  checkpoint();
  casa = clone(DEFAULT);
  plan.setCasa(casa, { fit: true });
  changed();
  renderInspector();
  status('Planta restablecida al borrador. Deshacer la recupera.');
});
$('fileImport').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.rooms)) throw new Error('no tiene "rooms"');
    checkpoint();
    casa = data;
    plan.setCasa(casa, { fit: true });
    changed();
    status(`Importado ${f.name}.`);
  } catch (err) { status(`No se pudo importar: ${err.message}.`); }
});
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
if (!inFrame) {
  $('btnDownloadJson').hidden = false;
  $('btnGlb').hidden = false;
  $('btnDownloadJson').addEventListener('click', () => download(new Blob([JSON.stringify(casa, null, 2)], { type: 'application/json' }), 'casa.json'));
  $('btnGlb').addEventListener('click', () => {
    if (dirty3d) rebuild();
    new GLTFExporter().parse(house.root, (glb) => download(new Blob([glb], { type: 'model/gltf-binary' }), 'casa.glb'), (e) => status(e.message), { binary: true });
  });
}
function status(t) { $('status').textContent = t; }

// ---------- 3D ----------
const stage = $('stage3d');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
stage.appendChild(renderer.domElement);
const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels3d';
stage.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd3dde3);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 400);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
scene.add(new THREE.HemisphereLight(0xeef3ff, 0x7a5a40, 1.0));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

let house = null;
let dirty3d = true;
const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 99);
const state3d = { ceilings: 'auto', outdoor: true, markers: true, labels: true, cut: 0, walk: false };

function rebuild() {
  if (house) { scene.remove(house.root); disposeHouse(house); }
  house = buildHouse(casa);
  scene.add(house.root);
  dirty3d = false;
  const b = bounds(casa, { outdoor: true });
  const cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2, span = Math.max(b[2] - b[0], b[3] - b[1]);
  Object.assign(sun.shadow.camera, { left: -span * 0.75, right: span * 0.75, top: span * 0.75, bottom: -span * 0.75, near: 1, far: span * 3 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.target.position.set(cx, 0, -cz);
  sun.position.set(cx - span * 0.4, span * 0.9, -cz + span * 0.6);
  // rótulos por cuarto
  for (const r of casa.rooms) {
    const d = document.createElement('div');
    d.className = 'rlabel';
    d.textContent = r.name;
    const o = new CSS2DObject(d);
    o.position.set((r.rect[0] + r.rect[2]) / 2, 0.3, (r.rect[1] + r.rect[3]) / 2);
    o.userData.label = true;
    house.layers.floors.add(o);
  }
  // recortar muros y todo lo alto con el plano de sección
  house.root.traverse((o) => {
    if (o.material) for (const m of [].concat(o.material)) m.clippingPlanes = [cutPlane];
  });
  apply3d();
}

function apply3d() {
  if (!house) return;
  cutPlane.constant = state3d.cut > 0 && !state3d.walk ? state3d.cut : 99;
  house.layers.outdoor.visible = state3d.outdoor;
  house.layers.markers.visible = state3d.markers;
  labelRenderer.domElement.hidden = !state3d.labels || state3d.walk;
}

function frame(view) {
  const b = bounds(casa, { outdoor: false });
  const cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2, span = Math.max(b[2] - b[0], b[3] - b[1]);
  controls.target.set(cx, 0, -cz);
  if (view === 'planta') camera.position.set(cx, span * 1.45, -cz + 0.01);
  else camera.position.set(cx - span * 0.55, span * 0.85, -cz + span * 0.75);
  controls.update();
}

for (const b of document.querySelectorAll('[data-view3d]')) b.addEventListener('click', () => {
  setWalk(false);
  const v = b.dataset.view3d;
  if (v === 'seccion') { state3d.cut = 1.3; $('cut').value = 1.3; frame('maqueta'); }
  else if (v === 'planta') { state3d.cut = 1.3; $('cut').value = 1.3; frame('planta'); }
  else { state3d.cut = 0; $('cut').value = 0; frame('maqueta'); }
  updateCutLabel();
  apply3d();
});
$('cut').addEventListener('input', () => { state3d.cut = parseFloat($('cut').value); updateCutLabel(); apply3d(); });
function updateCutLabel() { $('cutVal').textContent = state3d.cut > 0 ? `${state3d.cut.toFixed(2)} m` : 'sin corte'; }
for (const [id, key] of [['t3Outdoor', 'outdoor'], ['t3Markers', 'markers'], ['t3Labels', 'labels']]) {
  $(id).addEventListener('click', () => {
    state3d[key] = !state3d[key];
    $(id).setAttribute('aria-pressed', String(state3d[key]));
    apply3d();
  });
}

// Caminar dentro de la casa
const walk = { yaw: 0, pitch: 0, keys: new Set() };
$('btnWalk').addEventListener('click', () => setWalk(!state3d.walk));
function setWalk(on) {
  state3d.walk = on;
  controls.enabled = !on;
  $('btnWalk').setAttribute('aria-pressed', String(on));
  $('walkHint').hidden = !on;
  if (on) {
    const start = casa.panoramas.find((p) => p.area === 'vestibulo')?.at ?? [casa.rooms[0].rect[0] + 1, casa.rooms[0].rect[1] + 1];
    camera.position.set(start[0], 1.6, -start[1]);
    walk.yaw = 0; // mirando hacia el fondo de la casa
    walk.pitch = 0;
  }
  apply3d();
}
addEventListener('keydown', (e) => { if (!(e.target instanceof HTMLInputElement)) walk.keys.add(e.code); });
addEventListener('keyup', (e) => walk.keys.delete(e.code));
addEventListener('blur', () => walk.keys.clear());
function blocked(x, wz) {
  const r = 0.22;
  const z = -wz; // de mundo a planta
  return house.colliders.some(([x0, z0, x1, z1, y0]) => y0 < 1 && x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r);
}
function stepWalk(dt) {
  if (!state3d.walk || !house) return;
  const k = walk.keys;
  let f = 0, s = 0;
  if (k.has('KeyW') || k.has('ArrowUp')) f++;
  if (k.has('KeyS') || k.has('ArrowDown')) f--;
  if (k.has('KeyD')) s++;
  if (k.has('KeyA')) s--;
  if (k.has('ArrowLeft')) walk.yaw += dt * 1.8;
  if (k.has('ArrowRight')) walk.yaw -= dt * 1.8;
  const sp = 1.6 * dt;
  const fx = -Math.sin(walk.yaw), fz = -Math.cos(walk.yaw);
  const dx = (fx * f - fz * s) * sp, dz = (fz * f + fx * s) * sp;
  const p = camera.position;
  if (!blocked(p.x + dx, p.z)) p.x += dx;
  if (!blocked(p.x, p.z + dz)) p.z += dz;
  camera.rotation.order = 'YXZ';
  camera.rotation.set(walk.pitch, walk.yaw, 0);
}
let lookDrag = null;
renderer.domElement.addEventListener('pointerdown', (e) => { if (state3d.walk) lookDrag = [e.clientX, e.clientY]; downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!lookDrag) return;
  walk.yaw += (e.clientX - lookDrag[0]) * 0.004;
  walk.pitch = THREE.MathUtils.clamp(walk.pitch + (e.clientY - lookDrag[1]) * 0.0035, -1.2, 1.2);
  lookDrag = [e.clientX, e.clientY];
});
renderer.domElement.addEventListener('pointerup', (e) => {
  lookDrag = null;
  if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 5) pick(e);
});
let downAt = null;
const ray = new THREE.Raycaster();
function pick(e) {
  if (!house || !state3d.markers) return;
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObjects(house.markers, true)[0];
  if (hit?.object.userData.pano) openPano(hit.object.userData.pano);
}

function resize3d() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', () => { resize3d(); pano.resize(); if (mode === 'plan') plan.render(); });

// ---------- Panorámicas ----------
const pano = new PanoViewer($('panoStage'));
async function openPano(id) {
  const p = casa.panoramas.find((q) => q.id === id);
  if (!p) return;
  $('panoOverlay').hidden = false;
  $('panoTitle').textContent = p.name;
  $('panoMsg').hidden = true;
  pano.resize();
  try {
    await pano.open(p);
    pano.resize();
  } catch {
    $('panoMsg').hidden = false;
  }
}
$('panoClose').addEventListener('click', () => { $('panoOverlay').hidden = true; pano.close(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('panoOverlay').hidden) $('panoClose').click(); });

function renderPanoList() {
  const box = $('panoList');
  box.replaceChildren();
  const names = Object.fromEntries([...casa.rooms, ...(casa.outdoor ?? [])].map((r) => [r.id, r.name]));
  for (const p of casa.panoramas) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'panoItem';
    b.innerHTML = `<span class="pid">${p.id.replace('p', '')}</span><span><strong></strong><small></small></span>`;
    b.querySelector('strong').textContent = p.name;
    b.querySelector('small').textContent = names[p.area] ?? p.area;
    b.addEventListener('click', () => openPano(p.id));
    box.append(b);
  }
}

// ---------- Bucle ----------
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (mode === '3d' && house) {
    stepWalk(dt);
    if (!state3d.walk) controls.update();
    const above = camera.position.y > 2.4 && !state3d.walk;
    house.layers.ceilings.visible = !above;
    for (const o of house.layers.outdoor.children) if (o.userData.roof) o.visible = !above || state3d.cut === 0;
    renderer.render(scene, camera);
    if (!labelRenderer.domElement.hidden) labelRenderer.render(scene, camera);
  }
  if (!$('panoOverlay').hidden) pano.render();
});

// ---------- Arranque ----------
plan.setCasa(casa, { fit: true });
renderInspector();
showIssues();
setMode(location.hash === '#3d' ? '3d' : 'plan');
requestAnimationFrame(() => { plan.fit(); plan.render(); frame('maqueta'); });
window.__casa = { get casa() { return casa; }, scene, camera, controls, plan };
