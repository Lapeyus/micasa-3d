// Editor de planta en SVG. Trabaja directamente sobre casa.json:
// arrastrar un cuarto lo mueve, arrastrar un borde lo redimensiona (ajuste a 5 cm),
// los vanos viajan con su cuarto porque se guardan relativos a su lado.
import { deriveWalls, sideLine, roomRects, roomArea, OPENING_KINDS } from '../core/geometry.js';
import { fixtureInfo } from '../core/fixtures.js';

const NS = 'http://www.w3.org/2000/svg';
const SNAP = 0.05;
const snap = (v) => Math.round(v / SNAP) * SNAP;
const fix = (v) => Math.round(v * 1000) / 1000;

const KIND_FILL = {
  cocina: 'var(--k-cocina)', lavado: 'var(--k-lavado)', bano: 'var(--k-bano)', dormitorio: 'var(--k-dorm)',
  sala: 'var(--k-sala)', estudio: 'var(--k-estudio)', oficina: 'var(--k-estudio)', gimnasio: 'var(--k-gim)',
  pasillo: 'var(--k-pasillo)', vestibulo: 'var(--k-pasillo)', bodega: 'var(--k-bodega)',
};

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

export class PlanEditor {
  constructor(svg, { onChange, onSelect, onOpenPano }) {
    this.svg = svg;
    this.onChange = onChange;
    this.onSelect = onSelect;
    this.onOpenPano = onOpenPano;
    this.casa = null;
    this.sel = null; // {type:'room'|'opening'|'pano', id}
    this.view = { x: -2, y: -28, w: 24, h: 36 };
    this.drag = null;
    this.bind();
  }

  setCasa(casa, { fit = false } = {}) {
    this.casa = casa;
    if (fit) this.fit();
    this.render();
  }

  fit() {
    const all = [...this.casa.rooms, ...(this.casa.outdoor ?? [])];
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const r of all) { x0 = Math.min(x0, r.rect[0]); z0 = Math.min(z0, r.rect[1]); x1 = Math.max(x1, r.rect[2]); z1 = Math.max(z1, r.rect[3]); }
    const pad = 1.2;
    const rect = this.svg.getBoundingClientRect();
    const aspect = rect.width / Math.max(rect.height, 1) || 1;
    let w = x1 - x0 + pad * 2, h = z1 - z0 + pad * 2;
    if (w / h < aspect) w = h * aspect; else h = w / aspect;
    this.view = { x: (x0 + x1) / 2 - w / 2, y: -(z0 + z1) / 2 - h / 2, w, h };
  }

  // coordenadas de pantalla → planta (x, z)
  toPlan(e) {
    const r = this.svg.getBoundingClientRect();
    const x = this.view.x + ((e.clientX - r.left) / r.width) * this.view.w;
    const y = this.view.y + ((e.clientY - r.top) / r.height) * this.view.h;
    return [x, -y];
  }

  bind() {
    const s = this.svg;
    s.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [px, pz] = this.toPlan(e);
      const k = Math.exp(e.deltaY * 0.0015);
      const v = this.view;
      const nw = Math.min(Math.max(v.w * k, 3), 200), nh = nw * (v.h / v.w);
      v.x = px - ((px - v.x) * nw) / v.w;
      v.y = -pz - ((-pz - v.y) * nh) / v.h;
      v.w = nw; v.h = nh;
      this.applyView();
    }, { passive: false });

    s.addEventListener('pointerdown', (e) => {
      const t = e.target.closest('[data-kind]');
      const p = this.toPlan(e);
      s.setPointerCapture(e.pointerId);
      if (!t) {
        this.drag = { mode: 'pan', start: [e.clientX, e.clientY], view: { ...this.view } };
        this.select(null);
        return;
      }
      const kind = t.dataset.kind, id = t.dataset.id;
      // Los exteriores cubren mucha área: el primer toque solo los selecciona y
      // arrastrar sigue moviendo la vista; ya seleccionados, arrastrar los mueve.
      if (kind === 'outdoor' && !(this.sel?.type === 'outdoor' && this.sel.id === id)) {
        this.select({ type: 'outdoor', id });
        this.drag = { mode: 'pan', start: [e.clientX, e.clientY], view: { ...this.view } };
        return;
      }
      if (kind === 'room' || kind === 'edge' || kind === 'outdoor') {
        const isOut = kind === 'outdoor' || t.dataset.area === 'outdoor';
        const room = (isOut ? this.casa.outdoor : this.casa.rooms).find((r) => r.id === id);
        this.select({ type: isOut ? 'outdoor' : 'room', id });
        const carry = isOut ? [] : [
          ...(room.parts ?? []).map((rc, i) => ({ obj: room.parts, key: i, rect: [...rc] })),
          ...(this.casa.fixtures ?? []).filter((f) => f.room === room.id).map((f) => ({ obj: f, key: 'rect', rect: [...f.rect] })),
        ];
        const pins = isOut ? [] : (this.casa.panoramas ?? []).filter((q) => q.area === room.id).map((q) => ({ q, at: [...q.at] }));
        this.drag = { mode: kind === 'edge' ? 'edge' : 'move', side: t.dataset.side, room, start: p, rect: [...room.rect], carry, pins, moved: false };
      } else if (kind === 'fixture') {
        const f = this.casa.fixtures.find((q) => q.id === id);
        this.select({ type: 'fixture', id });
        this.drag = { mode: 'fixture', f, start: p, rect: [...f.rect], moved: false };
      } else if (kind === 'opening') {
        this.select({ type: 'opening', id });
        const op = this.casa.openings.find((o) => o.id === id);
        this.drag = { mode: 'opening', op, start: p, offset: op.offset, moved: false };
      } else if (kind === 'pano') {
        const pano = this.casa.panoramas.find((q) => q.id === id);
        this.select({ type: 'pano', id });
        this.drag = { mode: 'pano', pano, start: p, at: [...pano.at], moved: false, t0: performance.now() };
      }
    });

    s.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d) return;
      if (d.mode === 'pan') {
        const r = s.getBoundingClientRect();
        this.view.x = d.view.x - ((e.clientX - d.start[0]) / r.width) * d.view.w;
        this.view.y = d.view.y - ((e.clientY - d.start[1]) / r.height) * d.view.h;
        this.applyView();
        return;
      }
      const [px, pz] = this.toPlan(e);
      const dx = px - d.start[0], dz = pz - d.start[1];
      if (Math.abs(dx) + Math.abs(dz) > 0.02) d.moved = true;
      if (!d.moved) return;
      if (d.mode === 'move') {
        const [x0, z0, x1, z1] = d.rect;
        const sx = snap(x0 + dx) - x0, sz = snap(z0 + dz) - z0;
        d.room.rect = [x0 + sx, z0 + sz, x1 + sx, z1 + sz].map(fix);
        // las partes, empotrados y puntos de foto del cuarto viajan con él
        for (const c of d.carry) c.obj[c.key] = [c.rect[0] + sx, c.rect[1] + sz, c.rect[2] + sx, c.rect[3] + sz].map(fix);
        for (const pn of d.pins) pn.q.at = [fix(pn.at[0] + sx), fix(pn.at[1] + sz)];
      } else if (d.mode === 'fixture') {
        const [x0, z0, x1, z1] = d.rect;
        const sx = snap(x0 + dx) - x0, sz = snap(z0 + dz) - z0;
        d.f.rect = [x0 + sx, z0 + sz, x1 + sx, z1 + sz].map(fix);
      } else if (d.mode === 'edge') {
        const r = [...d.rect];
        if (d.side === 'W') r[0] = Math.min(snap(r[0] + dx), r[2] - 0.5);
        if (d.side === 'E') r[2] = Math.max(snap(r[2] + dx), r[0] + 0.5);
        if (d.side === 'S') r[1] = Math.min(snap(r[1] + dz), r[3] - 0.5);
        if (d.side === 'N') r[3] = Math.max(snap(r[3] + dz), r[1] + 0.5);
        d.room.rect = r.map(fix);
      } else if (d.mode === 'opening') {
        const room = this.casa.rooms.find((r) => r.id === d.op.room);
        const s2 = sideLine(roomRects(room)[d.op.part ?? 0] ?? room.rect, d.op.side);
        const delta = s2.axis === 'x' ? dx : dz;
        d.op.offset = fix(Math.min(Math.max(snap(d.offset + delta), 0), s2.to - s2.from - d.op.width));
      } else if (d.mode === 'pano') {
        d.pano.at = [fix(snap(d.at[0] + dx)), fix(snap(d.at[1] + dz))];
      }
      this.render();
    });

    s.addEventListener('pointerup', () => {
      const d = this.drag;
      this.drag = null;
      if (!d) return;
      if (d.mode === 'pano' && !d.moved && performance.now() - d.t0 < 400) this.onOpenPano?.(d.pano.id);
      if (d.moved && d.mode !== 'pan') this.onChange?.();
    });
  }

  select(sel) {
    this.sel = sel;
    this.render();
    this.onSelect?.(sel);
  }

  applyView() {
    const v = this.view;
    this.svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    // grosor de trazos y tamaño de texto independientes del zoom
    const px = v.w / Math.max(this.svg.clientWidth, 1);
    this.svg.style.setProperty('--px', px);
  }

  render() {
    const s = this.svg;
    if (!this.casa) return;
    s.replaceChildren();
    this.applyView();
    const px = this.view.w / Math.max(s.clientWidth, 1);
    const Y = (z) => -z;

    // cuadrícula de 1 m
    const grid = el('g', { class: 'grid' }, s);
    const v = this.view;
    for (let x = Math.floor(v.x); x <= v.x + v.w; x++) el('line', { x1: x, x2: x, y1: v.y, y2: v.y + v.h }, grid);
    for (let y = Math.floor(v.y); y <= v.y + v.h; y++) el('line', { x1: v.x, x2: v.x + v.w, y1: y, y2: y }, grid);

    const outdoor = el('g', { class: 'outdoor' }, s);
    for (const o of this.casa.outdoor ?? []) {
      const [x0, z0, x1, z1] = o.rect;
      const selected = this.sel?.type === 'outdoor' && this.sel.id === o.id;
      el('rect', {
        x: x0, y: Y(z1), width: x1 - x0, height: z1 - z0,
        class: `surface-${o.surface}${o.roof ? ' roofed' : ''}${selected ? ' sel' : ''}`,
        'data-kind': 'outdoor', 'data-id': o.id,
      }, outdoor);
      if (o.roof) {
        const t = el('text', { x: (x0 + x1) / 2, y: Y((z0 + z1) / 2), class: 'olabel', 'font-size': 11 * px }, outdoor);
        t.textContent = o.name;
      }
    }

    const rooms = el('g', {}, s);
    for (const r of this.casa.rooms) for (const [x0, z0, x1, z1] of roomRects(r)) {
      const selected = this.sel?.type === 'room' && this.sel.id === r.id;
      el('rect', {
        x: x0, y: Y(z1), width: x1 - x0, height: z1 - z0,
        fill: KIND_FILL[r.kind] ?? 'var(--k-pasillo)',
        class: `room${selected ? ' sel' : ''} conf-${r.confidence ?? 'media'}`,
        'data-kind': 'room', 'data-id': r.id,
      }, rooms);
    }

    const { walls, openings } = deriveWalls(this.casa);
    const wg = el('g', { class: 'walls' }, s);
    for (const w of walls) {
      if (w.y0 > 0.01) continue; // solo lo que toca el piso (dinteles no se dibujan en planta)
      el('rect', { x: w.x0, y: Y(w.z1), width: w.x1 - w.x0, height: w.z1 - w.z0, class: w.exterior ? 'ext' : '' }, wg);
    }

    const og = el('g', { class: 'openings' }, s);
    for (const op of openings) {
      const band = op.band ?? [op.line - 0.075, op.line + 0.075];
      const selected = this.sel?.type === 'opening' && this.sel.id === op.id;
      const g = el('g', { class: `op op-${op.kind}${selected ? ' sel' : ''}`, 'data-kind': 'opening', 'data-id': op.id }, og);
      const [a, b] = [op.a, op.b];
      const [p0, p1] = band;
      const R = (ax0, ax1, q0, q1, cls) => (op.axis === 'x'
        ? el('rect', { x: ax0, y: Y(q1), width: ax1 - ax0, height: q1 - q0, class: cls }, g)
        : el('rect', { x: q0, y: Y(ax1), width: q1 - q0, height: ax1 - ax0, class: cls }, g));
      R(a, b, p0 - 0.04, p1 + 0.04, 'hit');
      if (op.kindInfo.window) {
        R(a, b, p0, p1, 'win');
        const m = (p0 + p1) / 2;
        R(a, b, m - 0.008, m + 0.008, 'glass');
      } else {
        R(a, b, p0, p1, 'gap');
        if (op.kindInfo.door) {
          // arco de giro de la hoja hacia el cuarto dueño
          const inward = -op.out;
          const edge = inward > 0 ? p1 : p0;
          const L = op.kind === 'porton' ? (b - a) / 2 : b - a;
          const hinge = [a];
          if (op.kind === 'porton') hinge.push(b);
          for (const hx of hinge) {
            const dirA = hx === a ? 1 : -1;
            const P = (along, perp) => (op.axis === 'x' ? [along, Y(perp)] : [perp, Y(along)]);
            const [hx0, hy0] = P(hx, edge);
            const [ex, ey] = P(hx + dirA * L, edge);
            const [ox, oy] = P(hx, edge + inward * L);
            el('line', { x1: hx0, y1: hy0, x2: ox, y2: oy, class: 'leaf' }, g);
            el('path', { d: `M ${ex} ${ey} A ${L} ${L} 0 0 ${sweep(op, dirA, inward)} ${ox} ${oy}`, class: 'swing' }, g);
          }
        }
      }
    }

    // empotrados y muebles
    const fg = el('g', { class: 'fixtures' }, s);
    for (const f of this.casa.fixtures ?? []) {
      const [x0, z0, x1, z1] = f.rect;
      const info = fixtureInfo(f.kind);
      const selected = this.sel?.type === 'fixture' && this.sel.id === f.id;
      const g = el('g', { class: `fx fx-${info.layer}${selected ? ' sel' : ''}`, 'data-kind': 'fixture', 'data-id': f.id }, fg);
      if (f.kind === 'arbol') {
        el('circle', { cx: (x0 + x1) / 2, cy: Y((z0 + z1) / 2), r: Math.min(x1 - x0, z1 - z0) / 2, class: 'tree' }, g);
        el('title', {}, g).textContent = info.label;
        continue;
      }
      el('rect', { x: x0, y: Y(z1), width: x1 - x0, height: z1 - z0 }, g);
      // marca del frente
      const fr = f.front ?? 'S';
      const [ax, ay, bx, by] = fr === 'S' ? [x0, Y(z0), x1, Y(z0)] : fr === 'N' ? [x0, Y(z1), x1, Y(z1)] : fr === 'W' ? [x0, Y(z0), x0, Y(z1)] : [x1, Y(z0), x1, Y(z1)];
      el('line', { x1: ax, y1: ay, x2: bx, y2: by, class: 'front' }, g);
      const t = el('title', {}, g);
      t.textContent = info.label;
    }

    // rótulos
    const labels = el('g', { class: 'labels' }, s);
    for (const r of this.casa.rooms) {
      const [x0, z0, x1, z1] = r.rect;
      const w = x1 - x0, d = z1 - z0;
      const fs = Math.min(12 * px, Math.min(w, d) / 6);
      const t = el('text', { x: (x0 + x1) / 2, y: Y((z0 + z1) / 2) - fs * 0.2, 'font-size': fs, class: 'rname' }, labels);
      t.textContent = r.name;
      const t2 = el('text', { x: (x0 + x1) / 2, y: Y((z0 + z1) / 2) + fs * 1.1, 'font-size': fs * 0.85, class: 'rdim' }, labels);
      t2.textContent = `${w.toFixed(2)} × ${d.toFixed(2)} m${r.parts?.length ? ' + partes' : ''} · ${roomArea(r).toFixed(1)} m²`;
    }

    // asas para redimensionar el cuarto seleccionado
    if (this.sel?.type === 'room' || this.sel?.type === 'outdoor') {
      const list = this.sel.type === 'room' ? this.casa.rooms : this.casa.outdoor;
      const r = list.find((q) => q.id === this.sel.id);
      if (r) {
        const [x0, z0, x1, z1] = r.rect;
        const hg = el('g', { class: 'handles' }, s);
        const hw = 10 * px;
        const area = this.sel.type === 'outdoor' ? 'outdoor' : 'room';
        const H = (side, x, y, w, h) => el('rect', { x, y, width: w, height: h, 'data-kind': 'edge', 'data-area': area, 'data-id': r.id, 'data-side': side, class: `edge edge-${side}` }, hg);
        H('W', x0 - hw / 2, Y(z1), hw, z1 - z0);
        H('E', x1 - hw / 2, Y(z1), hw, z1 - z0);
        H('N', x0, Y(z1) - hw / 2, x1 - x0, hw);
        H('S', x0, Y(z0) - hw / 2, x1 - x0, hw);
      }
    }

    // panorámicas
    const pg = el('g', { class: 'panos' }, s);
    for (const p of this.casa.panoramas ?? []) {
      const selected = this.sel?.type === 'pano' && this.sel.id === p.id;
      const g = el('g', { class: `pano${selected ? ' sel' : ''}`, 'data-kind': 'pano', 'data-id': p.id }, pg);
      el('circle', { cx: p.at[0], cy: Y(p.at[1]), r: 7 * px }, g);
      const t = el('text', { x: p.at[0], y: Y(p.at[1]) + 2.6 * px, 'font-size': 7.5 * px }, g);
      t.textContent = p.id.replace('p', '');
      const title = el('title', {}, g);
      title.textContent = `${p.name} (clic para ver)`;
    }
  }
}

function sweep(op, dirA, inward) {
  // bandera de barrido del arco en coordenadas SVG (y invertida)
  const cross = dirA * inward * (op.axis === 'x' ? 1 : -1);
  return cross > 0 ? 0 : 1;
}

export function newOpening(room, side, kind) {
  const s = sideLine(room.rect, side);
  const info = OPENING_KINDS[kind];
  const width = info.window ? 1.0 : kind === 'porton' ? 2.4 : 0.8;
  return {
    id: `${room.id}-${kind}-${Math.random().toString(36).slice(2, 6)}`,
    room: room.id, side, kind,
    offset: fix(Math.max(0, (s.to - s.from - width) / 2)),
    width,
    ...(info.window ? { sill: 0.9, height: 2.1 } : {}),
  };
}
