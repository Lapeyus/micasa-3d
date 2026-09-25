// Modelo paramétrico de la cocina + pasillo de lavado.
// Todo se genera desde `layout` (ver layout.js); cambiar una medida y reconstruir
// regenera la geometría completa.
import * as THREE from 'three';
import * as TX from './textures.js';

export const PHASES = [
  'Piso',
  'Paredes',
  'Puertas y ventana',
  'Cielo raso',
  'Muebles bajos',
  'Muebles aéreos',
  'Electrodomésticos',
  'Detalles',
];

let MATS = null;

export function materials() {
  if (MATS) return MATS;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const plasterMap = TX.plaster(1);
  const mahogany = TX.woodGrain({ base: [88, 36, 22], seed: 3 });
  MATS = {
    floor: std({ map: TX.provenzalTiles(), roughness: 0.42, metalness: 0 }),
    floorLiving: std({ map: TX.provenzalTiles({ base: [150, 66, 44] }), roughness: 0.35 }),
    plaster: std({ color: 0xeceae2, map: plasterMap, roughness: 0.93 }),
    plasterGreen: std({ color: 0xcfdcae, map: plasterMap, roughness: 0.9 }),
    plasterPink: std({ color: 0xf1e3e0, map: plasterMap, roughness: 0.92 }),
    ceiling: std({ map: TX.ceilingBoards(), roughness: 0.6 }),
    ceilingLight: std({ map: TX.ceilingBoards(), color: 0xd9a27c, roughness: 0.6 }),
    cabinet: std({ map: mahogany, roughness: 0.55 }),
    cabinetDark: std({ map: TX.woodGrain({ base: [70, 26, 16], seed: 12 }), roughness: 0.4 }),
    cabinetLight: std({ map: TX.woodGrain({ base: [132, 66, 34], seed: 6 }), roughness: 0.6 }),
    plywood: std({ map: TX.woodGrain({ base: [176, 140, 92], seed: 14 }), roughness: 0.75 }),
    laundryWood: std({ map: TX.woodGrain({ base: [104, 56, 30], seed: 18 }), roughness: 0.6 }),
    doorWood: std({ map: TX.woodGrain({ base: [74, 28, 16], seed: 22, world: 1.2 }), roughness: 0.22 }),
    trim: std({ map: TX.woodGrain({ base: [58, 24, 14], seed: 30 }), roughness: 0.4 }),
    granite: std({ map: TX.granite(), roughness: 0.35 }),
    mosaic: std({ map: TX.mosaic(), roughness: 0.3 }),
    stainless: std({ color: 0xc8cacb, metalness: 0.85, roughness: 0.32 }),
    blackGloss: std({ color: 0x0c0c0d, roughness: 0.12, metalness: 0.1 }),
    blackMatte: std({ color: 0x1b1b1c, roughness: 0.55 }),
    enamel: std({ color: 0xf1f1ec, roughness: 0.3 }),
    iron: std({ color: 0x1c1c1c, roughness: 0.6, metalness: 0.4 }),
    frame: std({ color: 0xe6dfcc, roughness: 0.55 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xdff0f2, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false,
    }),
    ring: std({ color: 0x7c7c80, roughness: 0.4 }),
    white: std({ color: 0xf5f5f2, roughness: 0.6 }),
    towel: std({ color: 0xf2efe6, roughness: 0.95 }),
    teal: std({ color: 0x74d3c8, roughness: 0.35, transparent: true, opacity: 0.9 }),
    tealSolid: std({ color: 0x4fb8a4, roughness: 0.5 }),
    blue: std({ color: 0x3d6fc2, roughness: 0.5 }),
    grey: std({ color: 0x8e9194, roughness: 0.6 }),
    fabric: std({ color: 0x2b2e35, roughness: 1 }),
    red: std({ color: 0xc8392b, roughness: 0.6 }),
    orange: std({ color: 0xe0561f, roughness: 0.5 }),
    yellow: std({ color: 0xe8c53a, roughness: 0.6 }),
    green: std({ color: 0x6aa84f, roughness: 0.6 }),
    screen: std({ color: 0x111317, roughness: 0.2, emissive: 0x1a2330, emissiveIntensity: 0.6 }),
    bulb: std({ color: 0xffffff, emissive: 0xfff1d0, emissiveIntensity: 0.2 }),
    foliage: new THREE.MeshBasicMaterial({ map: TX.foliage(), color: 0xcfe0c0 }),
    bush: std({ color: 0x4d8a34, roughness: 0.9 }),
    grass: std({ color: 0x6d8f4a, roughness: 1 }),
    poster: std({ map: TX.posterGrid(), roughness: 0.8 }),
    painting: std({ map: TX.painting(), roughness: 0.8 }),
    paper: std({ color: 0xf7f5ee, roughness: 0.9 }),
    zinc: std({ map: TX.corrugated(), roughness: 0.45, metalness: 0.35, side: THREE.DoubleSide }),
    eave: std({ map: TX.woodGrain({ base: [110, 62, 34], seed: 40 }), roughness: 0.6 }),
    bark: std({ color: 0x4a3526, roughness: 1 }),
    leaves: std({ color: 0x3f7a2c, roughness: 0.95 }),
    leaves2: std({ color: 0x5b9a38, roughness: 0.95 }),
  };
  return MATS;
}

// UV planas en metros según la orientación de cada cara, para que las texturas
// queden a escala real y continuas entre piezas vecinas.
function worldUV(geo, offset) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + offset.x, y = p.getY(i) + offset.y, z = p.getZ(i) + offset.z;
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, x, z);
    else if (ax >= az) uv.setXY(i, z, y);
    else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true;
}

function B(parent, x0, x1, y0, y1, z0, z1, mat, opts = {}) {
  const w = Math.max(x1 - x0, 0.001), h = Math.max(y1 - y0, 0.001), d = Math.max(z1 - z0, 0.001);
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const pos = new THREE.Vector3((x0 + x1) / 2, y0, (z0 + z1) / 2);
  worldUV(g, pos);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(pos);
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function cyl(parent, x, y, z, r, h, mat, { rTop = r, seg = 24, axis = 'y', open = false } = {}) {
  const g = new THREE.CylinderGeometry(rTop, r, h, seg, 1, open);
  const m = new THREE.Mesh(g, mat);
  if (axis === 'y') m.position.set(x, y + h / 2, z);
  else {
    m.position.set(x, y, z);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    else m.rotation.x = Math.PI / 2;
  }
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Materiales por cara de una caja: orden px, nx, py, ny, pz, nz.
function faces(base, o = {}) {
  return ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map((k) => o[k] || base);
}

// Pared recta con vanos. axis 'z': corre a lo largo de z con x ∈ [t0,t1].
// axis 'x': corre a lo largo de x con z ∈ [t0,t1].
function wallRun(parent, axis, from, to, t0, t1, y1, openings, mat) {
  const piece = (a, b, ya, yb) => {
    if (b - a < 0.002 || yb - ya < 0.002) return;
    if (axis === 'z') B(parent, t0, t1, ya, yb, a, b, mat);
    else B(parent, a, b, ya, yb, t0, t1, mat);
  };
  let cur = from;
  for (const o of [...openings].sort((p, q) => p.a - q.a)) {
    piece(cur, o.a, 0, y1);
    piece(o.a, o.b, 0, o.bottom);
    piece(o.a, o.b, o.top, y1);
    cur = o.b;
  }
  piece(cur, to, 0, y1);
}

// Marco de madera alrededor de un vano (ambas caras de la pared).
function casing(parent, axis, a, b, h, t0, t1, mat, w = 0.07) {
  const e = 0.018;
  if (axis === 'x') {
    B(parent, a - w, a, 0, h + w, t0 - e, t1 + e, mat);
    B(parent, b, b + w, 0, h + w, t0 - e, t1 + e, mat);
    B(parent, a - w, b + w, h, h + w, t0 - e, t1 + e, mat);
  } else {
    B(parent, t0 - e, t1 + e, 0, h + w, a - w, a, mat);
    B(parent, t0 - e, t1 + e, 0, h + w, b, b + w, mat);
    B(parent, t0 - e, t1 + e, h, h + w, a - w, b + w, mat);
  }
}

// Hoja de puerta con bisagra en el origen del pivote; cerrada apunta a +x local.
function doorLeaf(parent, width, height, M) {
  const pivot = new THREE.Group();
  parent.add(pivot);
  B(pivot, 0.01, width - 0.01, 0.01, height - 0.01, -0.02, 0.02, M.doorWood);
  const knob = new THREE.SphereGeometry(0.028, 16, 12);
  for (const s of [-1, 1]) {
    const k = new THREE.Mesh(knob, M.stainless);
    k.position.set(width - 0.08, 0.98, s * 0.05);
    k.castShadow = true;
    pivot.add(k);
  }
  return pivot;
}

class Builder {
  constructor(root) {
    this.root = root;
    this.items = [];
  }
  item(name, phase, anim, tags = [], extra = {}) {
    const g = new THREE.Group();
    g.name = name;
    g.userData = { name, phase, anim, tags, ...extra };
    this.root.add(g);
    this.items.push(g);
    return g;
  }
  // Mueve el origen de cada grupo a la base de su volumen (para animar "crecer" y "caer").
  finalize() {
    const box = new THREE.Box3();
    const c = new THREE.Vector3();
    for (const g of this.items) {
      box.setFromObject(g);
      if (box.isEmpty()) continue;
      box.getCenter(c);
      const base = new THREE.Vector3(c.x, box.min.y, c.z);
      for (const ch of g.children) ch.position.sub(base);
      g.position.copy(base);
      g.userData.home = base.clone();
      g.userData.size = box.getSize(new THREE.Vector3());
    }
  }
}

export function buildModel(layout) {
  const M = materials();
  const root = new THREE.Group();
  root.name = 'espacio';
  const b = new Builder(root);

  const H = layout.ceilingHeight;
  const T = layout.wallThickness;
  const W = layout.kitchen.width;
  const K = layout.kitchen.length;
  const lx0 = layout.laundry.xStart;
  const lx1 = layout.laundry.xEnd;
  const lz1 = -T;
  const lz0 = -T - layout.laundry.length;
  const dL = layout.doors.kitchenLaundry;
  const dS = layout.doors.kitchenLiving;
  const dE = layout.doors.laundryExterior;
  const win = layout.window;
  const CH = layout.counter.height;
  const CD = layout.counter.depth;
  const cx0 = W - CD;
  const zEnd = Math.min(layout.counter.zEnd, K);
  const U = layout.upperCabinets;
  const ub = U.bottom;
  const ut = U.bottom + U.height;
  const liv = { x0: -1.2, x1: 4.2, z0: K + T, z1: K + T + 3.4 };

  // ---------- Piso ----------
  {
    const g = b.item('Piso de la cocina', 0, 'spread', ['floor']);
    B(g, -T, W + T, -0.06, 0, -T, K + T, M.floor, { cast: false });
    const l = b.item('Piso del lavado', 0, 'spread', ['floor', 'laundry']);
    B(l, lx0 - T, lx1 + T, -0.06, 0, lz0 - T, lz1, M.floor, { cast: false });
    const s = b.item('Piso de la sala', 0, 'spread', ['floor', 'living']);
    B(s, liv.x0, liv.x1, -0.06, 0, liv.z0, liv.z1, M.floorLiving, { cast: false });
  }

  // ---------- Paredes ----------
  {
    const green = b.item('Pared verde', 1, 'grow', ['wall'], { normal: [-1, 0, 0] });
    B(green, -T, 0, 0, H, -T, K + T, faces(M.plaster, { px: M.plasterGreen }));
    const pil = b.item('Columna', 1, 'grow', ['wall']);
    B(pil, 0, 0.14, 0, H, 0, 0.1, M.plaster);

    const ww = b.item('Pared de la ventana', 1, 'grow', ['wall'], { normal: [1, 0, 0] });
    wallRun(ww, 'z', -T, K + T, W, W + T, H,
      [{ a: win.zStart, b: win.zStart + win.width, bottom: win.sill, top: win.top }], M.plaster);

    const endL = b.item('Muro cocina–lavado', 1, 'grow', ['wall']);
    wallRun(endL, 'x', Math.min(-T, lx0 - T), Math.max(W + T, lx1 + T), -T, 0, H,
      [{ a: dL.x, b: dL.x + dL.width, bottom: 0, top: dL.height }], M.plaster);

    const endS = b.item('Muro cocina–sala', 1, 'grow', ['wall'], { normal: [0, 0, 1] });
    wallRun(endS, 'x', -T, W + T, K, K + T, H,
      [{ a: dS.x, b: dS.x + dS.width, bottom: 0, top: dS.height }], M.plaster);

    const lw = b.item('Pared izquierda del lavado', 1, 'grow', ['wall', 'laundry'], { normal: [-1, 0, 0] });
    B(lw, lx0 - T, lx0, 0, H, lz0 - T, lz1, M.plaster);
    const rw = b.item('Pared derecha del lavado', 1, 'grow', ['wall', 'laundry'], { normal: [1, 0, 0] });
    B(rw, lx1, lx1 + T, 0, H, lz0 - T, lz1, M.plaster);
    const ew = b.item('Muro exterior del lavado', 1, 'grow', ['wall', 'laundry'], { normal: [0, 0, -1] });
    wallRun(ew, 'x', lx0 - T, lx1 + T, lz0 - T, lz0, H,
      [{ a: dE.x, b: dE.x + dE.width, bottom: 0, top: dE.height }], M.plaster);

    // Sala (solo referencia de contexto)
    const sl = b.item('Sala: pared izquierda', 1, 'grow', ['wall', 'living'], { normal: [-1, 0, 0] });
    B(sl, liv.x0 - T, liv.x0, 0, H, K + T, liv.z1 + T, M.plasterPink);
    const sr = b.item('Sala: pared derecha', 1, 'grow', ['wall', 'living'], { normal: [1, 0, 0] });
    B(sr, liv.x1, liv.x1 + T, 0, H, K + T, liv.z1 + T, M.plasterPink);
    const sf = b.item('Sala: pared del fondo', 1, 'grow', ['wall', 'living'], { normal: [0, 0, 1] });
    B(sf, liv.x0 - T, liv.x1 + T, 0, H, liv.z1, liv.z1 + T, M.plaster);
    const sk = b.item('Sala: muro hacia cocina', 1, 'grow', ['wall', 'living'], { normal: [0, 0, 1] });
    B(sk, liv.x0, -T, 0, H, K, K + T, M.plaster);
    B(sk, W + T, liv.x1, 0, H, K, K + T, M.plaster);
  }

  // ---------- Puertas y ventana ----------
  const doors = {};
  {
    const g = b.item('Ventana con reja', 2, 'drop', ['window']);
    const z0 = win.zStart, z1 = win.zStart + win.width, y0 = win.sill, y1 = win.top;
    const f = 0.045;
    B(g, W - 0.04, W + T, y0 - 0.03, y0, z0 - 0.02, z1 + 0.02, M.frame);          // repisa
    B(g, W, W + T, y1, y1 + 0.02, z0, z1, M.frame);                               // dintel
    B(g, W, W + T, y0, y1, z0, z0 + 0.02, M.frame);
    B(g, W, W + T, y0, y1, z1 - 0.02, z1, M.frame);
    const gx0 = W + T * 0.45, gx1 = gx0 + 0.04;
    B(g, gx0, gx1, y0, y0 + f, z0, z1, M.frame);
    B(g, gx0, gx1, y1 - f, y1, z0, z1, M.frame);
    B(g, gx0, gx1, y0, y1, z0, z0 + f, M.frame);
    B(g, gx0, gx1, y0, y1, z1 - f, z1, M.frame);
    const tr = y0 + 0.32;                                                         // travesaño de las celosías
    B(g, gx0, gx1, tr, tr + 0.035, z0, z1, M.frame);
    B(g, gx0, gx1, y0, tr, (z0 + z1) / 2 - 0.02, (z0 + z1) / 2 + 0.02, M.frame);
    const glass = B(g, gx0 + 0.015, gx0 + 0.021, y0, y1, z0, z1, M.glass, { cast: false });
    glass.renderOrder = 2;
    // reja de hierro por fuera
    const rx0 = W + T + 0.02, rx1 = rx0 + 0.016;
    const cols = Math.max(2, Math.round(win.width / 0.2));
    const rows = Math.max(2, Math.round((y1 - y0) / 0.24));
    for (let i = 0; i <= cols; i++) {
      const z = z0 + (i / cols) * (z1 - z0);
      B(g, rx0, rx1, y0 - 0.02, y1 + 0.02, z - 0.008, z + 0.008, M.iron);
    }
    for (let j = 0; j <= rows; j++) {
      const y = y0 + (j / rows) * (y1 - y0);
      B(g, rx0, rx1, y - 0.008, y + 0.008, z0 - 0.02, z1 + 0.02, M.iron);
    }
    // varilla de cortina
    cyl(g, W - 0.07, y1 + 0.13, (z0 + z1) / 2, 0.009, win.width + 0.3, M.stainless, { axis: 'z' });

    const c1 = b.item('Marco puerta lavado', 2, 'drop', ['door']);
    casing(c1, 'x', dL.x, dL.x + dL.width, dL.height, -T, 0, M.trim);
    const c2 = b.item('Marco puerta sala', 2, 'drop', ['door'], { normal: [0, 0, 1] });
    casing(c2, 'x', dS.x, dS.x + dS.width, dS.height, K, K + T, M.trim);
    const c3 = b.item('Marco puerta exterior', 2, 'drop', ['door', 'laundry'], { normal: [0, 0, -1] });
    casing(c3, 'x', dE.x, dE.x + dE.width, dE.height, lz0 - T, lz0, M.trim);

    const l1 = b.item('Puerta cocina–lavado', 2, 'drop', ['door']);
    const p1 = doorLeaf(l1, dL.width, dL.height, M);
    p1.position.set(dL.x, 0, 0.025);
    p1.userData.open = -Math.PI * 0.93;
    p1.rotation.y = p1.userData.open;
    doors.laundry = p1;

    const l2 = b.item('Puerta exterior', 2, 'drop', ['door', 'laundry']);
    const p2 = doorLeaf(l2, dE.width, dE.height, M);
    p2.position.set(dE.x, 0, lz0 + 0.025);
    p2.userData.open = -Math.PI * 0.5;
    p2.rotation.y = p2.userData.open;
    doors.exterior = p2;
  }

  // ---------- Cielo raso ----------
  const lamps = [];
  {
    const g = b.item('Cielo raso cocina', 3, 'drop', ['ceiling']);
    B(g, -T, W + T, H, H + 0.04, -T, K + T, M.ceiling);
    const l = b.item('Cielo raso lavado', 3, 'drop', ['ceiling', 'laundry']);
    B(l, lx0 - T, lx1 + T, H, H + 0.04, lz0 - T, lz1, M.ceiling);
    const s = b.item('Cielo raso sala', 3, 'drop', ['ceiling', 'living']);
    B(s, liv.x0 - T, liv.x1 + T, H, H + 0.04, K, liv.z1 + T, M.ceilingLight);

    const cr = b.item('Cornisa', 3, 'drop', ['ceiling']);
    const c = 0.05;
    B(cr, 0, c, H - c, H, 0.1, K, M.trim);
    B(cr, W - c, W, H - c, H, 0, K, M.trim);
    B(cr, 0.14, W, H - c, H, 0, c, M.trim);
    B(cr, 0, W, H - c, H, K - c, K, M.trim);

    const fix = b.item('Lámparas', 3, 'drop', ['ceiling']);
    const spots = [[W / 2, K * 0.3], [W / 2, K * 0.75], [(lx0 + lx1) / 2, (lz0 + lz1) / 2]];
    for (const [x, z] of spots) {
      cyl(fix, x, H - 0.05, z, 0.05, 0.05, M.white);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 14), M.bulb);
      bulb.position.set(x, H - 0.09, z);
      fix.add(bulb);
      lamps.push(new THREE.Vector3(x, H - 0.14, z));
    }
  }

  // ---------- Muebles bajos (cocina) ----------
  {
    const g = b.item('Mueble bajo con fregadero', 4, 'drop', ['kitchen']);
    // la carcasa baja bajo el fregadero para dejar espacio a la tina
    const s0 = layout.sink.zStart, s1 = s0 + layout.sink.width;
    B(g, cx0 + 0.03, W, 0.1, CH - 0.04, 0, s0, M.cabinet);
    B(g, cx0 + 0.03, W, 0.1, CH - 0.24, s0, s1, M.cabinet);
    B(g, cx0 + 0.03, W, 0.1, CH - 0.04, s1, zEnd, M.cabinet);
    B(g, cx0 + 0.08, W, 0, 0.1, 0, zEnd, M.blackMatte);
    const n = Math.max(1, Math.round(zEnd / 0.46));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * zEnd, c = ((i + 1) / n) * zEnd;
      B(g, cx0, cx0 + 0.03, 0.12, CH - 0.07, a + 0.004, c - 0.004, M.cabinetDark);
      B(g, cx0 - 0.008, cx0, 0.2, CH - 0.15, a + 0.06, c - 0.06, M.cabinetDark);
      const kz = i % 2 === 0 ? c - 0.05 : a + 0.05;
      const k = cyl(g, cx0 - 0.02, CH - 0.14, kz, 0.012, 0.02, M.stainless, { axis: 'x' });
      k.position.x = cx0 - 0.02;
    }
  }
  {
    const g = b.item('Cubierta', 4, 'drop', ['kitchen']);
    const s0 = layout.sink.zStart, s1 = s0 + layout.sink.width;
    const bx0 = cx0 + 0.07, bx1 = W - 0.1;
    const y0 = CH - 0.035;
    B(g, cx0 - 0.025, W, y0, CH, 0, s0, M.granite);
    B(g, cx0 - 0.025, W, y0, CH, s1, zEnd + 0.02, M.granite);
    B(g, cx0 - 0.025, bx0, y0, CH, s0, s1, M.granite);
    B(g, bx1, W, y0, CH, s0, s1, M.granite);
    // salpicadero de mosaico
    const m = b.item('Salpicadero de mosaico', 4, 'grow', ['kitchen']);
    const wz0 = win.zStart, wz1 = win.zStart + win.width;
    const bxs = W - 0.008;
    const seg = (a, c, y1) => { if (c - a > 0.01) B(m, bxs, W, CH, y1, a, c, M.mosaic, { cast: false }); };
    seg(0, Math.min(wz0, zEnd), ub);
    seg(Math.max(wz1, 0), zEnd, ub);
    seg(Math.max(wz0, 0), Math.min(wz1, zEnd), win.sill - 0.03);
    B(m, cx0, W, CH, ub, 0, 0.008, M.mosaic, { cast: false });
  }
  {
    const g = b.item('Fregadero', 4, 'drop', ['kitchen']);
    const s0 = layout.sink.zStart, s1 = s0 + layout.sink.width;
    const bx0 = cx0 + 0.07, bx1 = W - 0.1, t = 0.008, y0 = CH - 0.21;
    B(g, bx0, bx1, y0, y0 + t, s0, s1, M.stainless);
    B(g, bx0, bx0 + t, y0, CH, s0, s1, M.stainless);
    B(g, bx1 - t, bx1, y0, CH, s0, s1, M.stainless);
    B(g, bx0, bx1, y0, CH, s0, s0 + t, M.stainless);
    B(g, bx0, bx1, y0, CH, s1 - t, s1, M.stainless);
    B(g, bx0 - 0.02, bx1 + 0.02, CH, CH + 0.004, s0 - 0.02, s0, M.stainless);
    B(g, bx0 - 0.02, bx1 + 0.02, CH, CH + 0.004, s1, s1 + 0.02, M.stainless);
    const fz = (s0 + s1) / 2;
    cyl(g, W - 0.06, CH, fz, 0.022, 0.08, M.stainless);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.014, 10, 24, Math.PI), M.blue);
    arc.position.set(W - 0.18, CH + 0.08, fz);
    arc.rotation.y = 0;
    g.add(arc);
  }

  // ---------- Muebles aéreos ----------
  const upper = (g, x0, x1, z0, z1, facing, nDoors, mat, doorMat, slats = false) => {
    B(g, x0, x1, ub, ut, z0, z1, mat);
    const along = facing === '-x' ? [z0, z1] : [x0, x1];
    for (let i = 0; i < nDoors; i++) {
      const a = along[0] + ((along[1] - along[0]) * i) / nDoors;
      const c = along[0] + ((along[1] - along[0]) * (i + 1)) / nDoors;
      if (facing === '-x') {
        B(g, x0 - 0.02, x0, ub + 0.01, ut - 0.01, a + 0.004, c - 0.004, doorMat);
        B(g, x0 - 0.028, x0 - 0.02, ub + 0.08, ut - 0.08, a + 0.05, c - 0.05, doorMat);
      } else {
        B(g, a + 0.004, c - 0.004, ub + 0.01, ut - 0.01, z1, z1 + 0.02, doorMat);
        if (slats) {
          const ns = 6;
          for (let s = 1; s < ns; s++) {
            const x = a + 0.05 + ((c - a - 0.1) * s) / ns;
            B(g, x - 0.004, x + 0.004, ub + 0.07, ut - 0.07, z1 + 0.02, z1 + 0.026, M.trim, { cast: false });
          }
          B(g, a + 0.04, c - 0.04, ub + 0.06, ub + 0.07, z1 + 0.02, z1 + 0.028, M.trim, { cast: false });
          B(g, a + 0.04, c - 0.04, ut - 0.07, ut - 0.06, z1 + 0.02, z1 + 0.028, M.trim, { cast: false });
        }
      }
    }
  };
  {
    const ux0 = W - U.depth;
    const e = b.item('Aéreo de esquina (tablillas)', 5, 'drop', ['kitchen']);
    upper(e, W - 0.74, W, 0, U.depth, '+z', 2, M.cabinetLight, M.cabinetLight, true);

    const wz0 = win.zStart, wz1 = win.zStart + win.width;
    if (wz0 - 0.05 - U.depth > 0.25) {
      const d = b.item('Aéreo junto a la ventana', 5, 'drop', ['kitchen']);
      upper(d, ux0, W, U.depth, wz0 - 0.05, '-x', 1, M.cabinetDark, M.cabinetDark);
    }
    const r0 = Math.max(wz1 + 0.05, U.depth);
    if (zEnd - r0 > 0.3) {
      const r = b.item('Aéreos del lado derecho', 5, 'drop', ['kitchen']);
      const ply = Math.min(0.52, zEnd - r0);
      upper(r, ux0, W, r0, r0 + ply, '-x', 1, M.plywood, M.plywood);
      if (zEnd - (r0 + ply) > 0.25) {
        const rest = zEnd - (r0 + ply);
        upper(r, ux0, W, r0 + ply, zEnd, '-x', Math.max(1, Math.round(rest / 0.4)), M.cabinet, M.cabinetDark);
      }
    }
  }

  // ---------- Electrodomésticos ----------
  const st = layout.stove;
  {
    const g = b.item('Cocina eléctrica', 6, 'drop', ['kitchen', 'appliance']);
    const z0 = st.zStart, z1 = st.zStart + st.width, sd = st.depth, sh = st.height;
    B(g, 0.02, sd - 0.02, 0.02, sh - 0.03, z0 + 0.01, z1 - 0.01, M.blackMatte);
    B(g, 0.02, sd, 0.02, sh - 0.03, z0, z0 + 0.012, M.stainless);
    B(g, 0.02, sd, 0.02, sh - 0.03, z1 - 0.012, z1, M.stainless);
    B(g, 0.01, sd, sh - 0.03, sh, z0, z1, M.blackGloss);
    B(g, 0.01, 0.09, sh, sh + 0.17, z0, z1, M.stainless);
    B(g, 0.089, 0.092, sh + 0.08, sh + 0.12, z0 + st.width * 0.55, z0 + st.width * 0.75, M.blackGloss, { cast: false });
    B(g, sd - 0.02, sd, 0.12, sh - 0.2, z0 + 0.015, z1 - 0.015, M.blackGloss);
    B(g, sd, sd + 0.004, 0.3, sh - 0.33, z0 + 0.12, z1 - 0.12, M.screen, { cast: false });
    B(g, sd - 0.02, sd, sh - 0.19, sh - 0.04, z0 + 0.015, z1 - 0.015, M.stainless);
    B(g, sd - 0.02, sd, 0.03, 0.11, z0 + 0.015, z1 - 0.015, M.blackMatte);
    cyl(g, sd + 0.05, sh - 0.23, (z0 + z1) / 2, 0.012, st.width - 0.12, M.stainless, { axis: 'z' });
    for (let i = 0; i < 5; i++) {
      const z = z0 + 0.1 + (i * (st.width - 0.2)) / 4;
      cyl(g, sd + 0.012, sh - 0.115, z, 0.022, 0.03, M.blackGloss, { axis: 'x' });
    }
    const ringG = (r) => new THREE.RingGeometry(r - 0.006, r, 48);
    const burners = [[0.22, 0.2, 0.1], [0.22, 0.56, 0.08], [0.5, 0.2, 0.08], [0.5, 0.56, 0.11]];
    for (const [bx, bz, r] of burners) {
      const ring = new THREE.Mesh(ringG(r), M.ring);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(bx * (sd / 0.68), sh + 0.001, z0 + bz * (st.width / 0.76));
      g.add(ring);
    }
    // toalla colgada de la manija
    B(g, sd + 0.04, sd + 0.07, sh - 0.55, sh - 0.2, z1 - 0.3, z1 - 0.1, M.towel);
  }
  const fr = layout.fridge;
  {
    const g = b.item('Refrigeradora', 6, 'drop', ['kitchen', 'appliance']);
    const z0 = fr.zStart, z1 = fr.zStart + fr.width, fd = fr.depth, fh = fr.height;
    const split = 0.62;
    B(g, 0.02, fd - 0.05, 0.02, fh, z0, z1, M.stainless);
    B(g, fd - 0.05, fd, split + 0.01, fh, z0 + 0.004, z1 - 0.004, M.stainless);
    B(g, fd - 0.05, fd, 0.03, split - 0.01, z0 + 0.004, z1 - 0.004, M.stainless);
    B(g, fd - 0.05, fd - 0.04, split - 0.01, split + 0.01, z0, z1, M.blackMatte, { cast: false });
    B(g, fd - 0.05, fd, 0, 0.03, z0 + 0.03, z1 - 0.03, M.blackMatte);
    cyl(g, fd + 0.03, split + 0.35, z1 - 0.05, 0.011, 0.5, M.stainless);
    cyl(g, fd + 0.03, split - 0.07, (z0 + z1) / 2, 0.011, fr.width - 0.16, M.stainless, { axis: 'z' });
  }
  {
    const g = b.item('Listón de madera tras la cocina', 4, 'grow', ['kitchen']);
    B(g, 0, 0.018, st.height - 0.02, st.height + 0.22, 0.12, fr.zStart, M.trim);
  }

  // ---------- Lavado ----------
  const lf = layout.laundryFit;
  {
    const wa = lf.washer;
    const g = b.item('Lavadora', 6, 'drop', ['laundry', 'appliance']);
    const x1 = lx1 - 0.03, x0 = x1 - wa.depth, z0 = wa.zStart, z1 = wa.zStart + wa.width;
    B(g, x0, x1, 0.02, wa.height - 0.05, z0, z1, M.enamel);
    B(g, x0 - 0.005, x1 - 0.14, wa.height - 0.05, wa.height - 0.03, z0 + 0.01, z1 - 0.01, M.enamel);
    B(g, x1 - 0.14, x1, wa.height - 0.05, wa.height + 0.12, z0, z1, M.enamel);
    B(g, x1 - 0.141, x1 - 0.139, wa.height + 0.02, wa.height + 0.08, z0 + 0.2, z1 - 0.2, M.screen, { cast: false });
    B(g, x0, x0 + 0.004, 0.02, 0.1, z0 + 0.05, z1 - 0.05, M.grey, { cast: false });
    // ropa encima
    B(g, x0 + 0.08, x1 - 0.2, wa.height - 0.03, wa.height + 0.04, z0 + 0.1, z1 - 0.12, M.fabric);
  }
  {
    const c = lf.counter;
    const g = b.item('Mueble de madera del lavado', 4, 'drop', ['laundry']);
    B(g, c.xStart, lx1, 0, c.height - 0.03, lz1 - c.depth, lz1, M.laundryWood);
    B(g, c.xStart - 0.02, lx1, c.height - 0.03, c.height, lz1 - c.depth - 0.02, lz1, M.laundryWood);
    B(g, c.xStart + 0.02, lx1 - 0.02, 0.06, c.height - 0.08, lz1 - c.depth - 0.006, lz1 - c.depth, M.cabinetLight);

    const s = b.item('Repisas del lavado', 5, 'drop', ['laundry']);
    for (const y of lf.shelves) {
      B(s, c.xStart, lx1 - 0.34, y, y + 0.025, lz1 - 0.24, lz1, M.laundryWood);
      for (const x of [c.xStart + 0.08, lx1 - 0.42]) B(s, x, x + 0.02, y - 0.12, y, lz1 - 0.2, lz1, M.iron);
    }
    const hc = b.item('Gabinete alto del lavado', 5, 'drop', ['laundry']);
    B(hc, lx1 - 0.32, lx1, 1.68, 2.3, lz1 - 0.6, lz1 - 0.02, M.cabinetDark);
    B(hc, lx1 - 0.34, lx1 - 0.32, 1.7, 2.28, lz1 - 0.58, lz1 - 0.04, M.cabinetDark);
  }

  // ---------- Detalles ----------
  {
    const rand = mulberry(42);
    const bottle = (g, x, y, z, s = 1) => {
      const mats = [M.white, M.green, M.orange, M.blue, M.yellow, M.red, M.tealSolid];
      const m = mats[Math.floor(rand() * mats.length)];
      const h = (0.12 + rand() * 0.16) * s;
      if (rand() < 0.35) B(g, x - 0.035, x + 0.035, y, y + h, z - 0.03, z + 0.03, m);
      else cyl(g, x, y, z, 0.03 + rand() * 0.02, h, m, { rTop: 0.02 + rand() * 0.02, seg: 14 });
    };

    const shelf = b.item('Frascos y productos', 7, 'drop', ['laundry', 'items']);
    const c = lf.counter;
    for (const y of [...lf.shelves.map((v) => v + 0.025), c.height]) {
      for (let x = c.xStart + 0.07; x < lx1 - 0.4; x += 0.07 + rand() * 0.06) bottle(shelf, x, y, lz1 - 0.12 - rand() * 0.06);
    }
    const pet = b.item('Comedero y canasta', 7, 'drop', ['laundry', 'items']);
    const px = c.xStart + 0.25, pz = lz1 - c.depth - 0.3;
    B(pet, px - 0.2, px + 0.2, 0.14, 0.17, pz - 0.14, pz + 0.14, M.tealSolid);
    for (const dx of [-0.18, 0.18]) for (const dz of [-0.12, 0.12]) B(pet, px + dx - 0.015, px + dx + 0.015, 0, 0.14, pz + dz - 0.015, pz + dz + 0.015, M.tealSolid);
    for (const dx of [-0.1, 0.1]) cyl(pet, px + dx, 0.17, pz, 0.08, 0.05, M.stainless, { rTop: 0.1 });
    cyl(pet, px - 0.1, 0, pz - 0.45, 0.1, 0.07, M.plasterPink, { rTop: 0.12 });
    const wa = lf.washer;
    cyl(pet, lx1 - wa.depth - 0.28, 0, wa.zStart + wa.width + 0.1, 0.22, 0.42, M.blue, { rTop: 0.25, open: true });
    B(pet, lx1 - 0.4, lx1 - 0.04, 0, 0.62, lz1 - c.depth - 0.45, lz1 - c.depth - 0.08, M.grey);

    const post = b.item('Póster', 7, 'drop', ['laundry', 'items']);
    B(post, lx0, lx0 + 0.025, 1.0, 1.92, lz1 - 0.95, lz1 - 0.25, M.orange);
    B(post, lx0 + 0.025, lx0 + 0.03, 1.03, 1.89, lz1 - 0.92, lz1 - 0.28, M.poster, { cast: false });

    const k = b.item('Objetos sobre la cubierta', 7, 'drop', ['kitchen', 'items']);
    const wz1 = win.zStart + win.width;
    const rack0 = 0.12, rack1 = Math.min(win.zStart + 0.2, layout.sink.zStart - 0.02);
    if (rack1 - rack0 > 0.25) {
      B(k, W - 0.46, W - 0.06, CH, CH + 0.12, rack0, rack1, M.iron);
      for (let z = rack0 + 0.05; z < rack1 - 0.03; z += 0.035) {
        const p = cyl(k, W - 0.3, CH + 0.2, z, 0.12, 0.012, rand() < 0.5 ? M.white : M.grey, { axis: 'z' });
        p.rotation.z = 0.2;
      }
      cyl(k, W - 0.15, CH + 0.12, rack0 + 0.1, 0.06, 0.14, M.stainless);
    }
    cyl(k, cx0 + 0.18, CH, layout.sink.zStart - 0.05, 0.075, 0.26, M.teal, { rTop: 0.06 });
    cyl(k, cx0 + 0.25, CH, layout.sink.zStart + layout.sink.width + 0.1, 0.06, 0.15, M.plasterPink, { rTop: 0.07 });
    const cb = B(k, W - 0.06, W - 0.04, CH, CH + 0.36, layout.sink.zStart + 0.1, layout.sink.zStart + 0.35, M.plywood);
    cb.rotation.z = 0.12;
    // cafetera
    const cz = wz1 + 0.3;
    if (cz + 0.3 < zEnd) {
      B(k, W - 0.28, W - 0.08, CH, CH + 0.36, cz - 0.11, cz + 0.11, M.blackMatte);
      cyl(k, W - 0.25, CH, cz, 0.07, 0.22, M.stainless);
      // horno tostador / freidora
      const tz = cz + 0.55;
      if (tz + 0.3 < zEnd) {
        B(k, W - 0.46, W - 0.06, CH, CH + 0.3, tz - 0.25, tz + 0.25, M.stainless);
        B(k, W - 0.462, W - 0.46, CH + 0.05, CH + 0.25, tz - 0.2, tz + 0.12, M.screen, { cast: false });
      }
      const rz = tz + 0.55;
      if (rz + 0.15 < zEnd) {
        cyl(k, W - 0.24, CH, rz, 0.13, 0.26, M.white);
        cyl(k, cx0 + 0.18, CH, rz + 0.1, 0.11, 0.08, M.blue, { rTop: 0.14 });
      }
      cyl(k, W - 0.14, CH, zEnd - 0.18, 0.055, 0.28, M.paper);
    }
    // encima de los aéreos
    const top = b.item('Ollas sobre los aéreos', 7, 'drop', ['kitchen', 'items']);
    const r0 = Math.max(wz1 + 0.05, U.depth);
    for (let z = r0 + 0.2; z < zEnd - 0.15; z += 0.38 + rand() * 0.15) {
      if (rand() < 0.5) cyl(top, W - 0.17, ut, z, 0.12, 0.22, M.stainless, { rTop: 0.11 });
      else B(top, W - 0.3, W - 0.03, ut, ut + 0.12, z - 0.15, z + 0.15, rand() < 0.5 ? M.tealSolid : M.blue);
    }
    cyl(top, W - 0.4, ut, U.depth / 2, 0.08, 0.25, M.blackMatte);
    // refrigeradora: imanes y caja de cereal
    const fz0 = fr.zStart, fz1 = fr.zStart + fr.width;
    B(top, 0.15, 0.45, fr.height, fr.height + 0.3, fz0 + 0.08, fz0 + 0.3, M.red);
    cyl(top, 0.35, fr.height, fz0 + 0.45, 0.04, 0.16, M.green);
    B(top, 0.3, 0.46, fr.height, fr.height + 0.12, fz1 - 0.2, fz1 - 0.06, M.yellow);
    for (let i = 0; i < 9; i++) {
      const y = 1.0 + rand() * 0.65, z = fz0 + 0.08 + rand() * (fr.width - 0.2);
      const big = rand() < 0.35;
      B(top, fr.depth, fr.depth + 0.004, y, y + (big ? 0.2 : 0.05), z, z + (big ? 0.14 : 0.05), big ? M.paper : [M.red, M.blue, M.yellow, M.green][i % 4], { cast: false });
    }
    for (let i = 0; i < 8; i++) {
      const y = 0.8 + rand() * 0.9, x = 0.12 + rand() * (fr.depth - 0.25);
      B(top, x, x + 0.05, y, y + 0.06, fz1, fz1 + 0.004, [M.red, M.blue, M.yellow, M.green, M.orange][i % 5], { cast: false });
    }
    // canasta de frutas
    const fb = b.item('Canasta de frutas', 7, 'drop', ['kitchen', 'items']);
    const fbz = st.zStart + st.width + 0.02;
    const basket = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 8, 24), M.iron);
    basket.rotation.x = Math.PI / 2;
    basket.position.set(0.16, st.height + 0.28, fbz);
    fb.add(basket);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), i % 3 ? M.green : M.yellow);
      s.position.set(0.12 + (i % 3) * 0.04, st.height + 0.29, fbz - 0.05 + Math.floor(i / 3) * 0.07);
      s.castShadow = true;
      fb.add(s);
    }
    // basurero junto a la puerta de la sala
    const tb = b.item('Basurero', 7, 'drop', ['kitchen', 'items']);
    if (K - zEnd > 0.25) cyl(tb, W - 0.25, 0, Math.min(zEnd + 0.18, K - 0.18), 0.15, 0.5, M.white, { rTop: 0.17 });

    // sala: tele, mueble, cuadro
    const sv = b.item('Sala: TV y mueble', 7, 'drop', ['living', 'items']);
    const tvx = dS.x + dS.width / 2 + 0.1, tvz = liv.z1 - 0.25;
    B(sv, tvx - 0.55, tvx + 0.55, 0, 0.03, tvz - 0.2, tvz + 0.2, M.iron);
    B(sv, tvx - 0.55, tvx + 0.55, 0.25, 0.27, tvz - 0.2, tvz + 0.2, M.iron);
    B(sv, tvx - 0.55, tvx + 0.55, 0.5, 0.52, tvz - 0.2, tvz + 0.2, M.iron);
    for (const dx of [-0.53, 0.53]) B(sv, tvx + dx - 0.015, tvx + dx + 0.015, 0, 0.52, tvz - 0.02, tvz + 0.02, M.iron);
    B(sv, tvx - 0.62, tvx + 0.62, 0.62, 1.34, tvz - 0.03, tvz + 0.01, M.screen);
    B(sv, tvx - 0.25, tvx + 0.25, 1.62, 1.95, liv.z1 - 0.03, liv.z1, M.painting);
  }

  // ---------- Techo y exterior (vista de la casa desde afuera) ----------
  {
    const pitch = THREE.MathUtils.degToRad(18);
    const eave = 0.6;
    const wx0 = Math.min(-T, lx0 - T), wx1 = Math.max(W + T, lx1 + T);
    const rx0 = wx0 - eave, rx1 = wx1 + eave;
    const half = (rx1 - rx0) / 2;
    const rise = half * Math.tan(pitch);
    const slope = half / Math.cos(pitch);
    const yEave = H + 0.12 - eave * Math.tan(pitch);
    const rz0 = lz0 - T - eave, rz1 = K + T;
    const roof = b.item('Techo de dos aguas (ala trasera)', 3, 'drop', ['shell']);
    for (const side of [-1, 1]) {
      const cxp = side < 0 ? rx0 + half / 2 : rx1 - half / 2;
      const m = B(roof, cxp - slope / 2, cxp + slope / 2, 0, 0.02, rz0, rz1, M.zinc);
      m.position.y = yEave + rise / 2;
      m.rotation.z = side < 0 ? pitch : -pitch;
    }
    // aleros: tapichel bajo el voladizo y tabla de cenefa
    B(roof, rx0, wx0, yEave - 0.03, yEave, rz0, rz1, M.eave);
    B(roof, wx1, rx1, yEave - 0.03, yEave, rz0, rz1, M.eave);
    B(roof, rx0 - 0.03, rx0, yEave - 0.16, yEave + 0.02, rz0, rz1, M.eave);
    B(roof, rx1, rx1 + 0.03, yEave - 0.16, yEave + 0.02, rz0, rz1, M.eave);
    B(roof, wx0, wx1, yEave - 0.03, yEave, rz0, lz0 - T, M.eave);
    // culata (triángulo de pared) en el extremo del lavado
    const tri = new THREE.Shape();
    tri.moveTo(wx0, H);
    tri.lineTo(wx1, H);
    tri.lineTo((wx0 + wx1) / 2, H + 0.12 + ((wx1 - wx0) / 2) * Math.tan(pitch));
    tri.closePath();
    const tg = new THREE.ExtrudeGeometry(tri, { depth: T, bevelEnabled: false });
    const gable = new THREE.Mesh(tg, M.plaster);
    gable.position.z = lz0 - T;
    gable.castShadow = gable.receiveShadow = true;
    roof.add(gable);

    // Casa principal: volumen simplificado con techo de cuatro aguas
    const hx0 = liv.x0 - 2.6, hx1 = liv.x1 + 2.2, hz0 = K + T, hz1 = K + T + 9.5;
    const house = b.item('Casa principal (volumen)', 1, 'grow', ['shell']);
    B(house, hx0, hx1, 0, H, hz0, hz1, M.plaster);
    const hr = b.item('Techo de cuatro aguas (casa principal)', 3, 'drop', ['shell']);
    const e2 = 0.7;
    const ax0 = hx0 - e2, ax1 = hx1 + e2, az0 = hz0 - e2, az1 = hz1 + e2;
    const hw = (ax1 - ax0) / 2;
    const hy = H + 0.1 - e2 * Math.tan(pitch);
    const top = hy + hw * Math.tan(pitch);
    const inset = Math.min(hw, (az1 - az0) / 2 - 0.01);
    const cxm = (ax0 + ax1) / 2;
    const P = {
      a: [ax0, hy, az0], b: [ax1, hy, az0], c: [ax1, hy, az1], d: [ax0, hy, az1],
      r0: [cxm, top, az0 + inset], r1: [cxm, top, az1 - inset],
    };
    const tris = [
      [P.a, P.r0, P.b], [P.b, P.r0, P.r1], [P.b, P.r1, P.c],
      [P.c, P.r1, P.d], [P.d, P.r1, P.r0], [P.d, P.r0, P.a],
    ];
    const pos = [], uv = [];
    for (const t of tris) for (const v of t) { pos.push(...v); uv.push(v[0], v[2]); }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    hg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    hg.computeVertexNormals();
    const hm = new THREE.Mesh(hg, M.zinc);
    hm.castShadow = hm.receiveShadow = true;
    hr.add(hm);
    B(hr, ax0, ax1, hy - 0.03, hy, az0, az1, M.eave);

    // Árbol junto a la ventana (el de la vista satelital)
    const tree = b.item('Árbol del patio', 7, 'grow', ['shell-tree']);
    const tx = W + T + 3.4, tz = (lz0 + K) / 2;
    cyl(tree, tx, 0, tz, 0.24, 3.0, M.bark, { rTop: 0.16, seg: 12 });
    const rt = mulberry(77);
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 + rt() * 0.7, 1), i % 2 ? M.leaves : M.leaves2);
      s.position.set(tx + (rt() - 0.5) * 2.6, 3.2 + rt() * 1.8, tz + (rt() - 0.5) * 3.0);
      s.castShadow = true;
      tree.add(s);
    }
  }

  // ---------- Exterior (siempre visible) ----------
  const env = new THREE.Group();
  env.name = 'exterior';
  {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), M.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(1.5, -0.07, K / 2);
    ground.receiveShadow = true;
    env.add(ground);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(K + 3, 4.6), M.foliage);
    wall.rotation.y = -Math.PI / 2;
    wall.position.set(W + T + 2.6, 2.2, K / 2);
    wall.name = 'fondo-jardin';
    env.add(wall);
    const r = mulberry(9);
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + r() * 0.5, 1), M.bush);
      s.position.set(W + T + 0.9 + r() * 1.4, 0.3 + r() * 2.2, win.zStart - 0.8 + r() * (win.width + 1.6));
      s.castShadow = true;
      env.add(s);
    }
  }
  root.add(env);

  b.finalize();

  // Cotas para verificar con cinta métrica.
  const dims = [
    { a: [0, 0.03, K - 0.35], b: [W, 0.03, K - 0.35], label: `Ancho cocina ${fmt(W)}` },
    { a: [-0.02, 0.03, 0], b: [-0.02, 0.03, K], label: `Largo cocina ${fmt(K)}`, offset: [0.25, 0, 0] },
    { a: [st.depth, 0.03, st.zStart + st.width / 2], b: [cx0 - 0.025, 0.03, st.zStart + st.width / 2], label: `Pasillo ${fmt(cx0 - 0.025 - st.depth)}` },
    { a: [0.05, 0, K - 0.05], b: [0.05, H, K - 0.05], label: `Alto ${fmt(H)}` },
    { a: [W - 0.02, win.top + 0.05, win.zStart], b: [W - 0.02, win.top + 0.05, win.zStart + win.width], label: `Ventana ${fmt(win.width)}` },
    { a: [cx0 - 0.05, 0, zEnd - 0.05], b: [cx0 - 0.05, CH, zEnd - 0.05], label: `Mueble ${fmt(CH)}` },
    { a: [lx0, 0.03, lz0 + 0.3], b: [lx1, 0.03, lz0 + 0.3], label: `Ancho lavado ${fmt(lx1 - lx0)}` },
    { a: [lx0 + 0.02, 0.03, lz0], b: [lx0 + 0.02, 0.03, lz1], label: `Largo lavado ${fmt(lz1 - lz0)}` },
    { a: [dL.x, dL.height + 0.1, -T / 2], b: [dL.x + dL.width, dL.height + 0.1, -T / 2], label: `Puerta ${fmt(dL.width)}` },
  ];

  const eye = 1.58;
  const views = {
    maqueta: { pos: [-3.6, 6.8, K + 3.2], target: [1.4, 0.4, (lz0 + K) / 2], orbit: true },
    planta: { pos: [(lx0 + W) / 2, 11, (lz0 + K) / 2 + 0.01], target: [(lx0 + W) / 2, 0, (lz0 + K) / 2], orbit: true },
    exterior: { pos: [dE.x + dE.width / 2, eye, lz0 - 0.35], target: [dE.x + 0.6, 1.25, 0.5] },
    entrada: { pos: [dL.x + dL.width / 2 + 0.05, eye, -0.55], target: [dL.x + 0.2, 1.1, K] },
    fregadero: { pos: [0.95, eye + 0.05, layout.sink.zStart + 0.1], target: [W, 1.3, layout.sink.zStart + 0.5] },
    hacialavado: { pos: [1.35, eye, Math.min(2.8, K - 0.5)], target: [dL.x + dL.width / 2, 1.1, lz0] },
    desdesala: { pos: [dS.x + dS.width / 2, eye, K + 1.3], target: [dS.x + 0.3, 1.2, 0] },
    fachada: { pos: [-8.5, 6, lz0 - 6.5], target: [W / 2, 1.2, (lz0 + K) / 2 + 1.5], orbit: true, shell: true },
    aerea: { pos: [(lx0 + W) / 2 + 0.5, 26, (lz0 + K) / 2 + 3.01], target: [(lx0 + W) / 2 + 0.5, 0, (lz0 + K) / 2 + 3], orbit: true, shell: true },
  };

  const tour = [
    [dE.x + dE.width / 2, eye, lz0 - 1.2],
    [dE.x + dE.width / 2, eye, lz0 + 0.4],
    [dL.x + dL.width / 2 + 0.1, eye, lz1 - 0.5],
    [dL.x + dL.width / 2, eye, 0.4],
    [(st.depth + cx0) / 2, eye, K * 0.45],
    [(st.depth + cx0) / 2 + 0.05, eye, K - 0.5],
    [dS.x + dS.width / 2, eye, K + 0.8],
  ];

  const walk = [
    { x0: 0.25, x1: W - 0.25, z0: 0.25, z1: K - 0.25 },
    { x0: lx0 + 0.25, x1: lx1 - 0.25, z0: lz0 + 0.25, z1: lz1 - 0.25 },
    { x0: dL.x + 0.15, x1: dL.x + dL.width - 0.15, z0: lz1 - 0.3, z1: 0.3 },
    { x0: dS.x + 0.15, x1: dS.x + dS.width - 0.15, z0: K - 0.3, z1: K + T + 0.3 },
    { x0: liv.x0 + 0.25, x1: liv.x1 - 0.25, z0: liv.z0 + 0.25, z1: liv.z1 - 0.25 },
    { x0: dE.x + 0.15, x1: dE.x + dE.width - 0.15, z0: lz0 - 3, z1: lz0 + 0.3 },
  ];

  // Las medidas usan x creciendo hacia la ventana, pero en coordenadas de three.js
  // (mano derecha) eso deja la pared verde a la derecha al mirar hacia la sala.
  // Se refleja el modelo completo en x para que coincida con las fotos, y se
  // reflejan igual los puntos de cámara, cotas y áreas transitables.
  root.scale.x = -1;
  const mx = (p) => [-p[0], p[1], p[2]];
  for (const d of dims) { d.a = mx(d.a); d.b = mx(d.b); }
  for (const v of Object.values(views)) { v.pos = mx(v.pos); v.target = mx(v.target); }
  const walkW = walk.map((r) => ({ x0: -r.x1, x1: -r.x0, z0: r.z0, z1: r.z1 }));
  for (const l of lamps) l.x = -l.x;

  return {
    root, env, backdrop: env.getObjectByName('fondo-jardin'), items: b.items, doors, lamps, dims, views,
    tour: tour.map(mx), walk: walkW,
    windowSide: -1,
    sink: new THREE.Vector3(-W, 1.2, layout.sink.zStart + 0.4),
    sunTarget: new THREE.Vector3(-W / 2, 0, K / 2),
  };
}

function fmt(m) {
  return `${m.toFixed(2)} m`;
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function disposeModel(model) {
  model.root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}
