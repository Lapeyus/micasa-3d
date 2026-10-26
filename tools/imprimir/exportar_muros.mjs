// Vuelca muros (ya con vanos cortados), celdas de piso y vanos de casa.json a JSON,
// usando el mismo núcleo que el visor para que la maqueta impresa coincida con la app.
import { readFileSync } from 'node:fs';
import { deriveWalls, cells, roomHeight } from '../../src/core/geometry.js';

const casa = JSON.parse(readFileSync(process.argv[2] ?? 'src/core/casa.default.json', 'utf8'));
const { walls, openings } = deriveWalls(casa);
const celdas = cells(casa).map((c) => ({ room: c.room.id, rect: c.rect, height: roomHeight(casa, c.room) }));
process.stdout.write(JSON.stringify({
  walls: walls.map(({ x0, x1, z0, z1, y0, y1, room, exterior }) => ({ x0, x1, z0, z1, y0, y1, room, exterior })),
  openings: openings.map(({ id, room, kind, axis, line, a, b, sill, top, band }) => ({ id, room, kind, axis, line, a, b, sill, top, band })),
  cells: celdas,
  roofs: casa.roofs,
  outdoor: casa.outdoor,
  fixtures: casa.fixtures,
  defaults: casa.defaults,
}));
