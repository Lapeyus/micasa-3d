// Visualización arquitectónica: convierte la estructura derivada (geometry.js) en
// mallas de three.js con materiales realistas. No guarda estado propio: cada
// llamada a buildHouse() produce un grupo nuevo a partir de casa.json.
import * as THREE from 'three';
import * as TX from '../shared/textures.js';
import { deriveWalls, roomHeight, bounds, roomRects } from '../core/geometry.js';
import { fixtureInfo } from '../core/fixtures.js';

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
    granite: std({ map: TX.granite(), roughness: 0.35 }),
    cabinet: std({ map: TX.woodGrain({ base: [88, 36, 22], seed: 3 }), roughness: 0.5 }),
    louver: std({ map: TX.woodGrain({ base: [62, 28, 16], seed: 9 }), roughness: 0.45 }),
    lightWood: std({ map: TX.woodGrain({ base: [150, 104, 60], seed: 15 }), roughness: 0.6 }),
    white: std({ color: 0xf2f1ec, roughness: 0.4 }),
    porcelain: std({ color: 0xf7f7f4, roughness: 0.15 }),
    stainless: std({ color: 0xc8cacb, metalness: 0.85, roughness: 0.3 }),
    black: std({ color: 0x151516, roughness: 0.25 }),
    concrete: std({ color: 0xb9b5ab, roughness: 0.95 }),
    mattress: std({ color: 0xe9e4d8, roughness: 0.9 }),
    fabric: std({ color: 0x5b6068, roughness: 0.95 }),
    fabricTeal: std({ color: 0x2f8f8f, roughness: 0.95 }),
    tray: std({ color: 0xe9ecea, roughness: 0.3 }),
    books: [0x8a2b2b, 0x2b4a8a, 0xd9b84a, 0x3f7a4f, 0xe8e2d0, 0x5a3a6a].map((c) => std({ color: c, roughness: 0.8 })),
    screen: std({ color: 0x0e1014, roughness: 0.2, emissive: 0x141b24, emissiveIntensity: 0.5 }),
    bark: std({ color: 0x4d3a2a, roughness: 1 }),
    leaves: [0x3f7a2c, 0x4f8c34, 0x2f6624].map((c) => std({ color: c, roughness: 0.95 })),
    mosaicTop: std({ map: TX.hydraulic(), roughness: 0.4 }),
    ivy: std({ color: 0x3d6b2a, roughness: 1 }),
    ivy2: std({ color: 0x4f7f33, roughness: 1 }),
    tile: std({ color: 0x9c4a2e, roughness: 0.8 }),
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
  for (const k of ['floors', 'walls', 'openings', 'ceilings', 'outdoor', 'markers', 'empotrados', 'muebles', 'exterior']) {
    layers[k] = new THREE.Group();
    layers[k].name = k;
    root.add(layers[k]);
  }
  const { walls, openings } = deriveWalls(casa);
  const colliders = [];

  // Pisos y cielos por cuarto
  for (const r of casa.rooms) for (const [x0, z0, x1, z1] of roomRects(r)) {
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

  // Empotrados y muebles
  for (const f of casa.fixtures ?? []) {
    const info = fixtureInfo(f.kind);
    const g = new THREE.Group();
    g.userData = { fixture: f.id, name: info.label };
    buildFixture(g, f, info, m);
    layers[info.layer].add(g);
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

// Marco local de un elemento: u a lo largo del frente, v hacia adentro desde el frente.
function localFrame(f) {
  const [x0, z0, x1, z1] = f.rect;
  const front = f.front ?? 'S';
  const W = front === 'S' || front === 'N' ? x1 - x0 : z1 - z0;
  const D = front === 'S' || front === 'N' ? z1 - z0 : x1 - x0;
  const rect = (u0, u1, v0, v1) => {
    switch (front) {
      case 'S': return [x0 + u0, z0 + v0, x0 + u1, z0 + v1];
      case 'N': return [x1 - u1, z1 - v1, x1 - u0, z1 - v0];
      case 'W': return [x0 + v0, z1 - u1, x0 + v1, z1 - u0];
      default: return [x1 - v1, z0 + u0, x1 - v0, z0 + u1];
    }
  };
  return { W, D, rect };
}

function buildFixture(g, f, info, m) {
  const { W, D, rect } = localFrame(f);
  const H = f.height ?? info.height;
  const Y0 = f.y0 ?? info.y0 ?? 0;
  const B = (u0, u1, v0, v1, y0, y1, mat, opts) => {
    const [a, b, c, d] = rect(u0, u1, v0, v1);
    return box(g, a, c, Y0 + y0, Y0 + y1, b, d, mat, opts);
  };
  const doors = (n, y0, y1, mat, louver = false) => {
    for (let i = 0; i < n; i++) {
      const u0 = (W * i) / n + 0.005, u1 = (W * (i + 1)) / n - 0.005;
      B(u0, u1, -0.02, 0, y0, y1, mat);
      if (louver) for (let y = y0 + 0.08; y < y1 - 0.05; y += 0.055) B(u0 + 0.04, u1 - 0.04, -0.028, -0.02, y, y + 0.02, m.louver, { cast: false });
    }
  };
  const n = Math.max(1, Math.round(W / 0.5));
  switch (f.kind) {
    case 'closet':
      B(0, W, 0, D, 0, H, m.louver);
      doors(n, 0.02, H - 0.02, m.louver, true);
      break;
    case 'alacena':
      B(0, W, 0, D, 0, H, m.white);
      for (let y = 0.4; y < H - 0.2; y += 0.4) B(0.02, W - 0.02, 0.02, D - 0.02, y, y + 0.02, m.stainless, { cast: false });
      break;
    case 'mueble':
      B(0, W, 0.06, D, 0.1, H - 0.04, m.cabinet);
      B(0, W, 0.1, D, 0, 0.1, m.black);
      B(0, W, -0.02, D, H - 0.04, H, m.granite);
      doors(n, 0.12, H - 0.08, m.cabinet);
      break;
    case 'aereo':
      B(0, W, 0, D, 0, H, m.cabinet);
      doors(n, 0.01, H - 0.01, m.cabinet);
      break;
    case 'repisa':
      for (const y of [0, 0.36]) B(0, W, 0, D, y, y + 0.025, m.lightWood);
      break;
    case 'ducha': {
      B(0, W, 0, D, 0, 0.06, m.tray);
      const gl = B(0, W, 0, 0.01, 0.06, H, m.glassPane ?? (m.glassPane = new THREE.MeshPhysicalMaterial({ color: 0xcfe3e6, roughness: 0.1, transparent: true, opacity: 0.35, depthWrite: false })), { cast: false });
      gl.renderOrder = 2;
      B(0, 0.03, 0, 0.03, 0.06, H, m.stainless);
      B(W - 0.03, W, 0, 0.03, 0.06, H, m.stainless);
      break;
    }
    case 'inodoro':
      B(W / 2 - 0.19, W / 2 + 0.19, 0.2, D, 0, 0.4, m.porcelain);
      B(W / 2 - 0.2, W / 2 + 0.2, D - 0.2, D, 0.4, H, m.porcelain);
      break;
    case 'lavatorio':
      B(W / 2 - 0.1, W / 2 + 0.1, D - 0.25, D - 0.05, 0, H - 0.15, m.porcelain);
      B(0, W, 0, D, H - 0.15, H, m.porcelain);
      break;
    case 'pila':
      B(0, W, 0, D, 0, H - 0.05, m.concrete);
      B(0, W, 0, 0.06, H - 0.05, H, m.concrete);
      B(0, W, D - 0.06, D, H - 0.05, H + 0.25, m.concrete);
      break;
    case 'cama':
    case 'camarote': {
      const levels = f.kind === 'camarote' ? [0, 1.1] : [0];
      for (const y of levels) {
        B(0, W, 0, D, y + 0.15, y + 0.35, m.cabinet);
        B(0.03, W - 0.03, 0.03, D - 0.05, y + 0.35, y + 0.55, m.mattress);
      }
      B(0, W, D - 0.06, D, 0, f.kind === 'camarote' ? H : 1.0, m.cabinet);
      if (f.kind === 'camarote') for (const u of [0, W - 0.06]) B(u, u + 0.06, 0, 0.06, 0, H, m.cabinet);
      break;
    }
    case 'sofa':
      B(0, W, 0, D, 0.1, 0.45, f.color === 'teal' ? m.fabricTeal : m.fabric);
      B(0, W, D - 0.22, D, 0.45, H, f.color === 'teal' ? m.fabricTeal : m.fabric);
      for (const u of [0, W - 0.18]) B(u, u + 0.18, 0, D, 0.45, 0.65, f.color === 'teal' ? m.fabricTeal : m.fabric);
      break;
    case 'mesa':
    case 'escritorio':
      B(0, W, 0, D, H - 0.04, H, f.kind === 'mesa' ? m.cabinet : m.lightWood);
      for (const [u, v] of [[0.04, 0.04], [W - 0.08, 0.04], [0.04, D - 0.08], [W - 0.08, D - 0.08]]) B(u, u + 0.04, v, v + 0.04, 0, H - 0.04, m.black);
      if (f.kind === 'escritorio') B(W * 0.2, W * 0.8, D - 0.12, D - 0.08, H, H + 0.4, m.screen);
      break;
    case 'librero': {
      B(0, W, 0.02, D, 0, H, m.lightWood);
      let k = 0;
      for (let y = 0.05; y < H - 0.3; y += 0.36) {
        for (let u = 0.03; u < W - 0.06; u += 0.05 + (k % 3) * 0.01) B(u, u + 0.04, 0, D - 0.04, y, y + 0.24 + (k % 2) * 0.04, m.books[k++ % m.books.length], { cast: false });
      }
      break;
    }
    case 'tv':
      B(0, W, 0, D, 0, 0.5, m.black);
      B(W * 0.1, W * 0.9, D / 2 - 0.03, D / 2 + 0.03, 0.55, H, m.screen);
      break;
    case 'refri':
      B(0, W, 0, D, 0, H, m.stainless);
      B(W - 0.07, W - 0.05, -0.05, 0, 0.7, 1.3, m.stainless);
      break;
    case 'cocina':
      B(0, W, 0, D, 0, H - 0.03, m.black);
      B(0, W, 0, D, H - 0.03, H, m.black);
      B(0, W, D - 0.08, D, H, H + 0.18, m.stainless);
      break;
    case 'lavadora':
      B(0, W, 0, D, 0, H, m.white);
      B(0, W, D - 0.14, D, H, H + 0.14, m.white);
      break;
    case 'gimnasio':
      B(0, 0.08, D / 2 - 0.04, D / 2 + 0.04, 0, H, m.black);
      B(W - 0.08, W, D / 2 - 0.04, D / 2 + 0.04, 0, H, m.black);
      B(0, W, D / 2 - 0.04, D / 2 + 0.04, H - 0.08, H, m.black);
      B(0.1, W - 0.1, 0, D, 0.35, 0.45, m.fabric);
      break;
    case 'muro':
      B(0, W, 0, D, 0, H, m.exterior);
      break;
    case 'arbol': {
      const cu = W / 2, cv = D / 2, r = Math.min(W, D) / 2;
      B(cu - 0.18, cu + 0.18, cv - 0.18, cv + 0.18, 0, H * 0.5, m.bark);
      let k = 0;
      for (const [du, dv, dy, rr] of [[0, 0, 0.72, 0.55], [0.35, 0.2, 0.62, 0.42], [-0.35, -0.25, 0.64, 0.45], [0.1, -0.4, 0.8, 0.38], [-0.2, 0.4, 0.84, 0.36]]) {
        const sph = new THREE.Mesh(new THREE.IcosahedronGeometry(r * rr * 1.5, 1), m.leaves[k++ % m.leaves.length]);
        const [a, b, c, d] = rect(cu + du * r - 0.01, cu + du * r + 0.01, cv + dv * r - 0.01, cv + dv * r + 0.01);
        sph.position.set((a + c) / 2, H * dy, (b + d) / 2);
        sph.castShadow = true;
        g.add(sph);
      }
      break;
    }
    case 'mesa_concreto': {
      const cu = W / 2, cv = D / 2;
      B(cu - 0.12, cu + 0.12, cv - 0.12, cv + 0.12, 0, H - 0.06, m.concrete);
      B(cu - 0.5, cu + 0.5, cv - 0.5, cv + 0.5, H - 0.06, H, m.mosaicTop);
      for (const [du, dv, along] of [[0, -0.85, 'u'], [0, 0.85, 'u'], [-0.85, 0, 'v'], [0.85, 0, 'v']]) {
        const hw = along === 'u' ? [0.5, 0.15] : [0.15, 0.5];
        B(cu + du - hw[0], cu + du + hw[0], cv + dv - hw[1], cv + dv + hw[1], 0.38, 0.45, m.mosaicTop);
        B(cu + du - 0.08, cu + du + 0.08, cv + dv - 0.08, cv + dv + 0.08, 0, 0.38, m.concrete);
      }
      break;
    }
    case 'fuente': {
      const cu = W / 2, cv = D / 2;
      B(cu - W / 2, cu + W / 2, cv - D / 2, cv + D / 2, 0, 0.35, m.white);
      B(cu - 0.12, cu + 0.12, cv - 0.12, cv + 0.12, 0.35, H, m.white);
      B(cu - 0.35, cu + 0.35, cv - 0.35, cv + 0.35, H * 0.6, H * 0.6 + 0.08, m.white);
      break;
    }
    case 'tapia': {
      B(0, W, 0, D, 0, H, m.exterior);
      if (f.style === 'teja') B(-0.02, W + 0.02, -0.08, D + 0.08, H, H + 0.08, m.tile);
      else B(-0.01, W + 0.01, -0.03, D + 0.03, H, H + 0.05, m.exterior);
      if (f.style === 'enredadera') {
        // parches de hiedra en ambas caras, de alto irregular
        let k = 0;
        for (let u = 0; u < W - 0.05; u += 0.9) {
          const top = H * (0.55 + ((k * 37) % 40) / 100);
          const mat = k++ % 2 ? m.ivy : m.ivy2;
          B(u, Math.min(W, u + 0.95), -0.06, 0, 0, top, mat, { cast: false });
          B(u, Math.min(W, u + 0.95), D, D + 0.06, 0, top * 0.9, mat, { cast: false });
        }
      }
      break;
    }
    case 'verja': {
      const base = 0.9;
      B(0, W, 0, D, 0, base, m.exterior);
      B(-0.01, W + 0.01, -0.02, D + 0.02, base, base + 0.05, m.exterior);
      const mid = D / 2;
      for (let u = 0.06; u < W; u += 0.13) B(u - 0.01, u + 0.01, mid - 0.01, mid + 0.01, base, H, m.iron, { cast: false });
      for (const y of [base + 0.12, H - 0.08]) B(0, W, mid - 0.015, mid + 0.015, y, y + 0.03, m.iron);
      for (let u = 0; u <= W; u += 2.4) B(Math.max(0, u - 0.04), Math.min(W, u + 0.04), mid - 0.04, mid + 0.04, base, H + 0.1, m.iron);
      break;
    }
    case 'porton_reja': {
      const mid = D / 2;
      for (const u of [0, W - 0.06]) B(u, u + 0.06, mid - 0.03, mid + 0.03, 0, H + 0.1, m.iron);
      for (let u = 0.1; u < W - 0.05; u += 0.11) B(u - 0.01, u + 0.01, mid - 0.01, mid + 0.01, 0.05, H, m.iron, { cast: false });
      for (const y of [0.05, H / 2, H - 0.06]) B(0, W, mid - 0.02, mid + 0.02, y, y + 0.04, m.iron);
      break;
    }
    default:
      B(0, W, 0, D, 0, H, m.white);
  }
}

export function disposeHouse(h) {
  h.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}
