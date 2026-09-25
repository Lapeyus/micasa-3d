// Núcleo estructural: deriva muros, vanos, pisos y cielos a partir de casa.json.
// No depende de three.js: lo usan igual el visor arquitectónico, el editor de
// planta y el juego. Todas las medidas en metros; planta en (x, z), altura en y.
//
// Reglas:
// - Cada cuarto es un rectángulo [x0, z0, x1, z1] medido a cara interior de muro.
// - Entre dos cuartos separados por un hueco pequeño (≤ MAX_GAP) el muro llena
//   ese hueco: cada cuarto aporta la mitad, con su propia altura y color.
// - Un lado sin vecino es muro exterior de grosor `wallThickness`.
// - Un vano se define sobre el lado de un cuarto y atraviesa el muro completo,
//   incluida la mitad que aporta el cuarto vecino.

export const SIDES = ['S', 'N', 'W', 'E'];
const MAX_GAP = 0.6;
const EPS = 1e-6;

export const OPENING_KINDS = {
  puerta: { label: 'Puerta', door: true, height: 2.1 },
  reja: { label: 'Puerta de reja', door: true, height: 2.1 },
  porton: { label: 'Portón', door: true, height: 2.3 },
  vano: { label: 'Vano sin puerta', door: false, height: 2.1 },
  arco: { label: 'Arco', door: false, height: 2.3 },
  ventana: { label: 'Ventana', window: true, height: 2.1, sill: 0.9 },
};

export function sideLine(rect, side) {
  const [x0, z0, x1, z1] = rect;
  switch (side) {
    case 'S': return { axis: 'x', line: z0, from: x0, to: x1, out: -1 };
    case 'N': return { axis: 'x', line: z1, from: x0, to: x1, out: 1 };
    case 'W': return { axis: 'z', line: x0, from: z0, to: z1, out: -1 };
    case 'E': return { axis: 'z', line: x1, from: z0, to: z1, out: 1 };
    default: throw new Error(`Lado desconocido: ${side}`);
  }
}

const opposite = { S: 'N', N: 'S', W: 'E', E: 'W' };

function subtract(intervals, [a, b]) {
  const out = [];
  for (const [p, q] of intervals) {
    if (b <= p || a >= q) { out.push([p, q]); continue; }
    if (a > p) out.push([p, a]);
    if (b < q) out.push([b, q]);
  }
  return out.filter(([p, q]) => q - p > 0.005);
}

export function roomHeight(casa, room) {
  return room.ceiling ?? casa.defaults.ceiling;
}

export function wallColor(casa, room, side) {
  return room.wallColors?.[side] ?? room.wallColor ?? casa.defaults.wallColor;
}

// Muros como cajas alineadas a los ejes: {x0,x1,z0,z1,y0,y1, room, side, exterior, color}.
export function deriveWalls(casa) {
  const T = casa.defaults.wallThickness;
  const rooms = casa.rooms;
  const pieces = [];

  for (const r of rooms) {
    const h = roomHeight(casa, r);
    for (const side of SIDES) {
      if (r.open?.includes(side)) continue;
      const s = sideLine(r.rect, side);
      let free = [[s.from, s.to]];
      const shared = [];
      for (const q of rooms) {
        if (q === r) continue;
        const o = sideLine(q.rect, opposite[side]);
        if (o.axis !== s.axis) continue;
        const gap = (o.line - s.line) * s.out;
        if (gap < -EPS || gap > MAX_GAP) continue;
        const a = Math.max(s.from, o.from), b = Math.min(s.to, o.to);
        if (b - a < 0.01) continue;
        const qOpen = q.open?.includes(opposite[side]);
        shared.push({ a, b, thick: qOpen ? gap : gap / 2 });
        free = subtract(free, [a, b]);
      }
      const color = wallColor(casa, r, side);
      const push = (a, b, thick, exterior) => {
        if (thick < 0.005) return;
        const p0 = s.out > 0 ? s.line : s.line - thick;
        const p1 = s.out > 0 ? s.line + thick : s.line;
        const box = s.axis === 'x'
          ? { x0: a, x1: b, z0: p0, z1: p1 }
          : { x0: p0, x1: p1, z0: a, z1: b };
        pieces.push({ ...box, y0: 0, y1: h, room: r.id, side, axis: s.axis, exterior, color });
      };
      for (const sh of shared) push(sh.a, sh.b, sh.thick, false);
      for (let [a, b] of free) {
        // cerrar esquinas exteriores
        if (Math.abs(a - s.from) < EPS) a -= T;
        if (Math.abs(b - s.to) < EPS) b += T;
        push(a, b, T, true);
      }
    }
  }

  const openings = resolveOpenings(casa);
  let walls = pieces;
  for (const op of openings) walls = cutOpening(walls, op);
  return { walls, openings };
}

// Vanos resueltos a coordenadas de planta: rango a lo largo del muro y banda perpendicular.
export function resolveOpenings(casa) {
  const byId = Object.fromEntries(casa.rooms.map((r) => [r.id, r]));
  const out = [];
  for (const o of casa.openings) {
    const room = byId[o.room];
    if (!room) continue;
    const kind = OPENING_KINDS[o.kind] ?? OPENING_KINDS.vano;
    const s = sideLine(room.rect, o.side);
    const a = s.from + o.offset;
    const b = a + o.width;
    const sill = o.sill ?? kind.sill ?? 0;
    const top = o.height ?? kind.height ?? casa.defaults.doorHeight;
    out.push({ ...o, axis: s.axis, line: s.line, out: s.out, a, b, sill, top, kindInfo: kind });
  }
  return out;
}

function cutOpening(walls, op) {
  const res = [];
  for (const w of walls) {
    if (w.axis !== op.axis) { res.push(w); continue; }
    const p0 = op.axis === 'x' ? w.z0 : w.x0;
    const p1 = op.axis === 'x' ? w.z1 : w.x1;
    const a0 = op.axis === 'x' ? w.x0 : w.z0;
    const a1 = op.axis === 'x' ? w.x1 : w.z1;
    const near = p0 >= op.line - MAX_GAP - EPS && p1 <= op.line + MAX_GAP + EPS;
    if (!near || op.b <= a0 || op.a >= a1) { res.push(w); continue; }
    const seg = (s0, s1, y0, y1) => {
      if (s1 - s0 < 0.005 || y1 - y0 < 0.005) return;
      res.push(op.axis === 'x'
        ? { ...w, x0: s0, x1: s1, y0, y1 }
        : { ...w, z0: s0, z1: s1, y0, y1 });
    };
    const ca = Math.max(a0, op.a), cb = Math.min(a1, op.b);
    seg(a0, ca, w.y0, w.y1);
    seg(cb, a1, w.y0, w.y1);
    seg(ca, cb, w.y0, Math.min(op.sill, w.y1));
    seg(ca, cb, Math.max(op.top, w.y0), w.y1);
    op.band = op.band
      ? [Math.min(op.band[0], p0), Math.max(op.band[1], p1)]
      : [p0, p1];
  }
  return res;
}

// Rectángulo que ocupa toda la casa (para cámara, techo y terreno).
export function bounds(casa, { outdoor = false } = {}) {
  const list = outdoor ? [...casa.rooms, ...(casa.outdoor ?? [])] : casa.rooms;
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const r of list) {
    b[0] = Math.min(b[0], r.rect[0]);
    b[1] = Math.min(b[1], r.rect[1]);
    b[2] = Math.max(b[2], r.rect[2]);
    b[3] = Math.max(b[3], r.rect[3]);
  }
  return b;
}

// Área útil de cada cuarto en m², para el editor y la ficha técnica.
export function area(rect) {
  return Math.max(0, rect[2] - rect[0]) * Math.max(0, rect[3] - rect[1]);
}

// Revisa problemas comunes: traslapes entre cuartos y vanos fuera de su muro.
export function validate(casa) {
  const issues = [];
  const rs = casa.rooms;
  for (let i = 0; i < rs.length; i++) {
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i].rect, b = rs[j].rect;
      const ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
      const oz = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
      if (ox > 0.01 && oz > 0.01) issues.push(`${rs[i].name} y ${rs[j].name} se traslapan`);
    }
  }
  const byId = Object.fromEntries(rs.map((r) => [r.id, r]));
  for (const o of casa.openings) {
    const r = byId[o.room];
    if (!r) { issues.push(`El vano ${o.id} apunta a un cuarto que no existe (${o.room})`); continue; }
    const s = sideLine(r.rect, o.side);
    if (o.offset < -EPS || s.from + o.offset + o.width > s.to + EPS) {
      issues.push(`El vano ${o.id} se sale del lado ${o.side} de ${r.name}`);
    }
  }
  return issues;
}
