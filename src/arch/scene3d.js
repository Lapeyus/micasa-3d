// Visualización arquitectónica: convierte la estructura derivada (geometry.js) en
// mallas de three.js con materiales realistas. No guarda estado propio: cada
// llamada a buildHouse() produce un grupo nuevo a partir de casa.json.
import * as THREE from 'three';
import * as TX from '../shared/textures.js';
import { deriveWalls, roomHeight, bounds } from '../core/geometry.js';

let M = null;
const wallMats = new Map();

function mats() {
  if (M) return M;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  M = {
    plasterMap: TX.plaster(1),
    floors: {
      provenzal: std({ map: TX.provenzalTiles(), roughness: 0.45 }),
      parquet: std({ map: TX.parquet(), roughness: 0.5 }),
      hidraulico: std({ map: TX.hydraulic(), roughness: 0.4 }),
      ceramica: std({ map: TX.ceramic(), roughness: 0.3 }),
      cemento: std({ color: 0xa8a49a, roughness: 0.9 }),
      zacate: std({ map: TX.grass(), roughness: 1 }),
    },
    ceilings: {
      tablilla: std({ map: TX.ceilingBoards(), roughness: 0.6 }),
      blanco: std({ color: 0xf2f1ec, roughness: 0.95 }),
      vigas: std({ color: 0xf2f1ec, roughness: 0.95 }),
    },
    beam: std({ map: TX.woodGrain({ base: [60, 32, 20], seed: 44 }), roughness: 0.6 }),
    exterior: std({ color: 0xf4f3ee, map: TX.plaster(2), roughness: 0.95 }),
    trim: std({ map: TX.woodGrain({ base: [58, 24, 14], seed: 30 }), roughness: 0.4 }),
    door: std({ map: TX.woodGrain({ base: [74, 28, 16], seed: 22, world: 1.2 }), roughness: 0.25 }),
    iron: std({ color: 0x1c1c1c, roughness: 0.55, metalness: 0.5 }),
    frame: std({ color: 0x4a2a1a, roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdff0f2, roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false }),
    brick: std({ color: 0xa4553a, roughness: 0.85 }),
    zinc: std({ map: TX.corrugated(), roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide }),
    marker: std({ color: 0xe27b56, emissive: 0x7a2a10, emissiveIntensity: 0.6, roughness: 0.4 }),
    markerRing: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
  };
  return M;
}

function wallMat(color) {
  if (!wallMats.has(color)) {
    wallMats.set(color, new THREE.MeshStandardMaterial({ color, map: mats().plasterMap, roughness: 0.92 }));
  }
  return wallMats.get(color);
}

// UV planas en metros según la orientación de cada cara (texturas a escala real).
function worldUV(geo, off) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + off.x, y = p.getY(i) + off.y, z = p.getZ(i) + off.z;
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, x, z);
    else if (ax >= az) uv.setXY(i, z, y);
    else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true;
}

function box(parent, x0, x1, y0, y1, z0, z1, mat, { cast = true, receive = true } = {}) {
  const w = Math.max(x1 - x0, 0.002), h = Math.max(y1 - y0, 0.002), d = Math.max(z1 - z0, 0.002);
  const g = new THREE.BoxGeometry(w, h, d);
  const pos = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  worldUV(g, pos);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(pos);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

// Cara exterior blanca para muros de fachada; el resto con el color del cuarto.
function wallFaces(w) {
  const inner = wallMat(w.color);
  if (!w.exterior) return inner;
  const ext = mats().exterior;
  const f = [inner, inner, inner, inner, inner, inner]; // px nx py ny pz nz
  const out = { N: 4, S: 5, E: 0, W: 1 }[w.side];
  f[out] = ext;
  return f;
}

export function buildHouse(casa) {
  const m = mats();
  const root = new THREE.Group();
  root.name = 'casa';
  const layers = {};
  for (const k of ['floors', 'walls', 'openings', 'ceilings', 'outdoor', 'markers']) {
    layers[k] = new THREE.Group();
    layers[k].name = k;
    root.add(layers[k]);
  }
  const { walls, openings } = deriveWalls(casa);
  const colliders = [];

  // Pisos y cielos por cuarto
  for (const r of casa.rooms) {
    const [x0, z0, x1, z1] = r.rect;
    const h = roomHeight(casa, r);
    const floor = m.floors[r.floor ?? casa.defaults.floor] ?? m.floors.provenzal;
    const f = box(layers.floors, x0, x1, -0.05, 0, z0, z1, floor, { cast: false });
    f.userData = { room: r.id, name: r.name };
    const finish = r.ceilingFinish ?? casa.defaults.ceilingFinish;
    const c = box(layers.ceilings, x0 - 0.08, x1 + 0.08, h, h + 0.04, z0 - 0.08, z1 + 0.08, m.ceilings[finish] ?? m.ceilings.blanco);
    c.userData = { room: r.id, name: r.name };
    if (finish === 'vigas') {
      const along = x1 - x0 > z1 - z0 ? 'x' : 'z';
      const span = along === 'x' ? [x0, x1] : [z0, z1];
      for (let t = span[0] + 0.9; t < span[1] - 0.3; t += 1.1) {
        if (along === 'x') box(layers.ceilings, t - 0.06, t + 0.06, h - 0.16, h, z0, z1, m.beam);
        else box(layers.ceilings, x0, x1, h - 0.16, h, t - 0.06, t + 0.06, m.beam);
      }
    }
  }

  // Muros
  for (const w of walls) {
    const mesh = box(layers.walls, w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, wallFaces(w));
    mesh.userData = { room: w.room, side: w.side, wall: true };
    colliders.push([w.x0, w.z0, w.x1, w.z1, w.y0]);
  }

  // Vanos: marcos, hojas y ventanas
  for (const op of openings) buildOpening(layers.openings, op, m);

  // Exteriores: jardines, corredores techados
  for (const o of casa.outdoor ?? []) {
    const [x0, z0, x1, z1] = o.rect;
    const surf = m.floors[o.surface] ?? m.floors.zacate;
    const y = o.surface === 'zacate' ? -0.03 : -0.01;
    const g = box(layers.outdoor, x0, x1, y - 0.04, y, z0, z1, surf, { cast: false });
    g.userData = { outdoor: o.id, name: o.name };
    if (o.roof) {
      const top = 2.55;
      for (const [cx, cz] of [[x0 + 0.15, z0 + 0.15], [x1 - 0.15, z0 + 0.15], [x0 + 0.15, z1 - 0.15], [x1 - 0.15, z1 - 0.15]]) {
        box(layers.outdoor, cx - 0.15, cx + 0.15, 0, top, cz - 0.15, cz + 0.15, m.brick);
      }
      const roof = box(layers.outdoor, x0 - 0.3, x1 + 0.3, top, top + 0.02, z0 - 0.3, z1 + 0.3, m.zinc);
      roof.userData.roof = true;
    }
  }
  const b = bounds(casa, { outdoor: true });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(b[2] - b[0] + 30, b[3] - b[1] + 30), new THREE.MeshStandardMaterial({ color: 0x6e8a55, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((b[0] + b[2]) / 2, -0.08, (b[1] + b[3]) / 2);
  ground.receiveShadow = true;
  layers.outdoor.add(ground);

  // Marcadores de panorámicas
  const markers = [];
  const ringGeo = new THREE.RingGeometry(0.22, 0.3, 32);
  const sphereGeo = new THREE.SphereGeometry(0.14, 20, 14);
  for (const p of casa.panoramas ?? []) {
    const g = new THREE.Group();
    g.position.set(p.at[0], 0, p.at[1]);
    const s = new THREE.Mesh(sphereGeo, m.marker);
    s.position.y = 1.1;
    const ring = new THREE.Mesh(ringGeo, m.markerRing);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    g.add(s, ring);
    g.userData = { pano: p.id, name: p.name };
    s.userData = g.userData;
    layers.markers.add(g);
    markers.push(g);
  }

  // En planta x crece a la derecha vista desde la calle y z hacia el fondo.
  // three.js es de mano derecha: se invierte z para que la casa no quede en espejo.
  // Todo lo que sale de aquí en coordenadas de mundo usa worldZ = -z.
  root.scale.z = -1;
  return { root, layers, colliders, markers, openings, walls };
}

function buildOpening(parent, op, m) {
  const band = op.band ?? [op.line - 0.075, op.line + 0.075];
  const p0 = band[0], p1 = band[1];
  const place = (a0, a1, y0, y1, q0, q1, mat, opts) => (op.axis === 'x'
    ? box(parent, a0, a1, y0, y1, q0, q1, mat, opts)
    : box(parent, q0, q1, y0, y1, a0, a1, mat, opts));
  const k = op.kindInfo;
  const tw = 0.06; // ancho del marco
  const e = 0.015;

  if (k.window) {
    place(op.a, op.b, op.sill - 0.03, op.sill, p0 - 0.04, p1 + 0.03, m.frame);
    place(op.a, op.b, op.top, op.top + 0.04, p0 - e, p1 + e, m.frame);
    place(op.a - 0.04, op.a, op.sill, op.top, p0 - e, p1 + e, m.frame);
    place(op.b, op.b + 0.04, op.sill, op.top, p0 - e, p1 + e, m.frame);
    const mid = (p0 + p1) / 2;
    const mullions = Math.max(1, Math.round((op.b - op.a) / 0.5));
    for (let i = 1; i < mullions; i++) {
      const t = op.a + ((op.b - op.a) * i) / mullions;
      place(t - 0.02, t + 0.02, op.sill, op.top, mid - 0.02, mid + 0.02, m.frame);
    }
    const tr = op.sill + (op.top - op.sill) * 0.62;
    place(op.a, op.b, tr - 0.02, tr + 0.02, mid - 0.02, mid + 0.02, m.frame);
    const g = place(op.a, op.b, op.sill, op.top, mid - 0.003, mid + 0.003, m.glass, { cast: false });
    g.renderOrder = 2;
    if (op.reja) {
      const outer = op.out > 0 ? p1 + 0.03 : p0 - 0.03;
      const cols = Math.max(2, Math.round((op.b - op.a) / 0.14));
      for (let i = 0; i <= cols; i++) {
        const t = op.a + ((op.b - op.a) * i) / cols;
        place(t - 0.008, t + 0.008, op.sill, op.top, outer - 0.008, outer + 0.008, m.iron);
      }
      for (const y of [op.sill + 0.05, (op.sill + op.top) / 2, op.top - 0.05]) {
        place(op.a, op.b, y - 0.01, y + 0.01, outer - 0.008, outer + 0.008, m.iron);
      }
    }
    return;
  }

  // Marco de madera en ambas caras (puertas, arcos y vanos)
  place(op.a - tw, op.a, 0, op.top + tw, p0 - e, p1 + e, m.trim);
  place(op.b, op.b + tw, 0, op.top + tw, p0 - e, p1 + e, m.trim);
  place(op.a - tw, op.b + tw, op.top, op.top + tw, p0 - e, p1 + e, m.trim);
  if (!k.door) return;

  // Hoja(s) abierta(s) ~75° hacia el cuarto dueño del vano
  const leaves = op.kind === 'porton' ? [[op.a, op.b - (op.b - op.a) / 2, 1], [op.b, op.a + (op.b - op.a) / 2, -1]] : [[op.a, op.b, 1]];
  const openAng = THREE.MathUtils.degToRad(op.openDeg ?? 75);
  for (const [hinge, end, dir] of leaves) {
    const len = Math.abs(end - hinge) - 0.01;
    const pivot = new THREE.Group();
    const inward = -op.out; // hacia dentro del cuarto dueño
    const edge = inward > 0 ? p1 : p0;
    if (op.axis === 'x') pivot.position.set(hinge, 0, edge);
    else pivot.position.set(edge, 0, hinge);
    const leafMat = op.kind === 'reja' ? m.iron : m.door;
    const leaf = new THREE.Group();
    if (op.kind === 'reja') {
      for (let t = 0.03; t < len; t += 0.11) box(leaf, t - 0.008, t + 0.008, 0.02, op.top - 0.02, -0.008, 0.008, leafMat);
      for (const y of [0.05, op.top / 2, op.top - 0.05]) box(leaf, 0, len, y - 0.015, y + 0.015, -0.01, 0.01, leafMat);
    } else {
      box(leaf, 0, len, 0.01, op.top - 0.01, -0.02, 0.02, leafMat);
      if (op.glass) box(leaf, 0.15, len - 0.15, 0.9, op.top - 0.25, -0.022, 0.022, m.glass, { cast: false });
    }
    pivot.add(leaf);
    // la hoja corre a lo largo del eje del muro; se gira sobre la bisagra hacia el cuarto
    let base = op.axis === 'x' ? 0 : -Math.PI / 2;
    if (dir < 0) base += Math.PI;
    const swing = openAng * inward * dir * (op.axis === 'x' ? -1 : 1);
    pivot.rotation.y = base + swing;
    pivot.userData = { door: op.id, closed: base, open: base + swing };
    parent.add(pivot);
  }
}

export function disposeHouse(h) {
  h.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}
