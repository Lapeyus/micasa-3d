// Pruebas del núcleo estructural (src/core/geometry.js y src/core/fixtures.js).
// Lógica pura, sin navegador ni three.js. Correr con: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SIDES, OPENING_KINDS, sideLine, roomRects, roomArea, roomHeight, wallColor,
  deriveWalls, resolveOpenings, bounds, area, validate,
} from '../src/core/geometry.js';
import { FIXTURE_KINDS, fixtureInfo } from '../src/core/fixtures.js';

const DEFAULT = JSON.parse(readFileSync(new URL('../src/core/casa.default.json', import.meta.url)));

// Casa mínima de dos cuartos separados por un hueco de 0.15 m (un muro compartido).
function dosCuartos(extra = {}) {
  return {
    version: 1,
    defaults: { wallThickness: 0.15, ceiling: 2.5, doorHeight: 2.1, wallColor: '#ffffff' },
    rooms: [
      { id: 'a', name: 'A', rect: [0, 0, 3, 4] },
      { id: 'b', name: 'B', rect: [3.15, 0, 6, 4], ceiling: 2.8 },
    ],
    openings: [],
    ...extra,
  };
}

test('sideLine describe cada lado del rectángulo', () => {
  const r = [1, 2, 4, 6];
  assert.deepEqual(sideLine(r, 'S'), { axis: 'x', line: 2, from: 1, to: 4, out: -1 });
  assert.deepEqual(sideLine(r, 'N'), { axis: 'x', line: 6, from: 1, to: 4, out: 1 });
  assert.deepEqual(sideLine(r, 'W'), { axis: 'z', line: 1, from: 2, to: 6, out: -1 });
  assert.deepEqual(sideLine(r, 'E'), { axis: 'z', line: 4, from: 2, to: 6, out: 1 });
  assert.throws(() => sideLine(r, 'X'), /Lado desconocido/);
  assert.deepEqual(SIDES, ['S', 'N', 'W', 'E']);
});

test('area, roomArea y roomRects suman las partes de un cuarto en L', () => {
  assert.equal(area([0, 0, 2, 3]), 6);
  assert.equal(area([2, 0, 1, 3]), 0); // rectángulo invertido no da área negativa
  const enL = { rect: [0, 0, 2, 2], parts: [[2, 0, 3, 1]] };
  assert.equal(roomRects(enL).length, 2);
  assert.equal(roomArea(enL), 5);
});

test('altura y color del cuarto caen a los valores por defecto', () => {
  const c = dosCuartos();
  assert.equal(roomHeight(c, c.rooms[0]), 2.5);
  assert.equal(roomHeight(c, c.rooms[1]), 2.8);
  const r = { wallColor: '#111111', wallColors: { E: '#222222' } };
  assert.equal(wallColor(c, r, 'E'), '#222222');
  assert.equal(wallColor(c, r, 'W'), '#111111');
  assert.equal(wallColor(c, {}, 'S'), '#ffffff');
});

test('deriveWalls: el muro compartido lo aportan ambos cuartos por mitades', () => {
  const { walls } = deriveWalls(dosCuartos());
  const compartidos = walls.filter((w) => !w.exterior);
  assert.equal(compartidos.length, 2);
  const deA = compartidos.find((w) => w.room === 'a');
  const deB = compartidos.find((w) => w.room === 'b');
  assert.equal(deA.side, 'E');
  assert.equal(deB.side, 'W');
  assert.ok(Math.abs((deA.x1 - deA.x0) - 0.075) < 1e-9, 'cada mitad mide 0.075 m');
  assert.ok(Math.abs(deA.x1 - deB.x0) < 1e-9, 'las mitades se tocan');
  assert.equal(deA.y1, 2.5);
  assert.equal(deB.y1, 2.8, 'cada mitad usa la altura de su cuarto');
});

test('deriveWalls: los lados sin vecino son muros exteriores con esquinas cerradas', () => {
  const { walls } = deriveWalls(dosCuartos());
  const ext = walls.filter((w) => w.exterior);
  assert.equal(ext.length, 6); // 3 lados libres por cuarto
  const sur = ext.find((w) => w.room === 'a' && w.side === 'S');
  assert.equal(sur.z1 - sur.z0, 0.15);
  assert.equal(sur.x0, -0.15, 'se extiende el grosor del muro en la esquina');
});

test('deriveWalls: entre partes del mismo cuarto no hay muro', () => {
  const c = dosCuartos();
  c.rooms = [{ id: 'l', name: 'L', rect: [0, 0, 2, 2], parts: [[2, 0, 3, 2]] }];
  const { walls } = deriveWalls(c);
  assert.equal(walls.filter((w) => !w.exterior).length, 0);
  assert.ok(!walls.some((w) => w.side === 'E' && Math.abs(w.x0 - 2) < 1e-9 && w.z0 >= 0 && w.z1 <= 2));
});

test('un lado listado en `open` no genera muro', () => {
  const c = dosCuartos();
  c.rooms[0].open = ['S'];
  const { walls } = deriveWalls(c);
  assert.ok(!walls.some((w) => w.room === 'a' && w.side === 'S'));
});

test('resolveOpenings: puertas llegan al piso, ventanas tienen repisa', () => {
  const c = dosCuartos({
    openings: [
      { id: 'p', room: 'a', side: 'E', kind: 'puerta', offset: 1, width: 0.9 },
      { id: 'v', room: 'a', side: 'S', kind: 'ventana', offset: 0.5, width: 1.2 },
      { id: 'x', room: 'a', side: 'W', kind: 'desconocido', offset: 0, width: 1 },
      { id: 'h', room: 'no-existe', side: 'S', kind: 'puerta', offset: 0, width: 1 },
    ],
  });
  const ops = resolveOpenings(c);
  assert.equal(ops.length, 3, 'un vano de un cuarto inexistente se omite');
  const [p, v, x] = ops;
  assert.deepEqual([p.a, p.b, p.sill, p.top], [1, 1.9, 0, 2.1]);
  assert.equal(v.sill, 0.9);
  assert.equal(v.top, 2.1);
  assert.equal(x.kindInfo, OPENING_KINDS.vano, 'un tipo desconocido se trata como vano');
});

test('deriveWalls corta el vano en ambas mitades del muro compartido', () => {
  const c = dosCuartos({ openings: [{ id: 'p', room: 'a', side: 'E', kind: 'puerta', offset: 1, width: 0.9 }] });
  const { walls, openings } = deriveWalls(c);
  const compartidos = walls.filter((w) => !w.exterior);
  // por cada mitad: tramo antes, tramo después y dintel sobre la puerta
  assert.equal(compartidos.length, 6);
  const dinteles = compartidos.filter((w) => w.z0 === 1 && w.z1 === 1.9);
  assert.equal(dinteles.length, 2);
  for (const d of dinteles) assert.equal(d.y0, 2.1);
  assert.ok(Math.abs(openings[0].band[0] - 3) < 1e-9 && Math.abs(openings[0].band[1] - 3.15) < 1e-9,
    'la banda del vano cubre el muro completo');
});

test('bounds cubre cuartos y, opcionalmente, exteriores', () => {
  const c = dosCuartos({ outdoor: [{ id: 'j', name: 'J', rect: [-2, -3, 1, 0], surface: 'zacate' }] });
  assert.deepEqual(bounds(c), [0, 0, 6, 4]);
  assert.deepEqual(bounds(c, { outdoor: true }), [-2, -3, 6, 4]);
});

test('validate detecta traslapes y vanos fuera de su muro', () => {
  const c = dosCuartos({
    openings: [
      { id: 'largo', room: 'a', side: 'S', kind: 'ventana', offset: 2.5, width: 1 },
      { id: 'huerfano', room: 'zz', side: 'S', kind: 'puerta', offset: 0, width: 1 },
    ],
  });
  c.rooms.push({ id: 'c', name: 'C', rect: [2, 1, 4, 3] });
  const issues = validate(c);
  assert.ok(issues.some((t) => /A y C se traslapan/.test(t)));
  assert.ok(issues.some((t) => /largo se sale del lado S de A/.test(t)));
  assert.ok(issues.some((t) => /huerfano apunta a un cuarto que no existe/.test(t)));
  assert.deepEqual(validate(dosCuartos()), []);
});

test('fixtureInfo devuelve el catálogo o un valor por defecto', () => {
  assert.equal(fixtureInfo('cama'), FIXTURE_KINDS.cama);
  assert.deepEqual(fixtureInfo('nave-espacial'), { label: 'nave-espacial', layer: 'muebles', height: 1, depth: 0.6 });
  for (const k of Object.values(FIXTURE_KINDS)) assert.ok(['empotrados', 'muebles', 'exterior'].includes(k.layer));
});

test('el borrador casa.default.json valida sin problemas y usa tipos conocidos', () => {
  assert.deepEqual(validate(DEFAULT), []);
  const { walls, openings } = deriveWalls(DEFAULT);
  assert.ok(walls.length > 0);
  assert.equal(openings.length, DEFAULT.openings.length);
  for (const o of DEFAULT.openings) assert.ok(o.kind in OPENING_KINDS, `tipo de vano desconocido: ${o.kind}`);
  for (const f of DEFAULT.fixtures) assert.ok(f.kind in FIXTURE_KINDS, `tipo de mueble desconocido: ${f.kind}`);
  for (const o of DEFAULT.openings) assert.ok(SIDES.includes(o.side));
});
