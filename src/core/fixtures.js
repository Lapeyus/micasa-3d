// Catálogo de empotrados y muebles. Cada elemento de casa.fixtures se guarda así:
//   { id, room, kind, rect: [x0, z0, x1, z1], front: 'S'|'N'|'W'|'E', height?, y0? }
// `front` es el lado por donde se abre o se usa (puertas del closet, frente del mueble).
// Los empotrados son parte de la estructura (no se mueven en una remodelación simple);
// los muebles viven en su propia capa para poder ocultarlos o cambiarlos.

export const FIXTURE_KINDS = {
  closet: { label: 'Closet de celosía', layer: 'empotrados', height: 2.3, depth: 0.6 },
  alacena: { label: 'Alacena', layer: 'empotrados', height: 2.2, depth: 0.5 },
  mueble: { label: 'Mueble bajo con cubierta', layer: 'empotrados', height: 0.9, depth: 0.6 },
  aereo: { label: 'Mueble aéreo', layer: 'empotrados', height: 0.72, y0: 1.45, depth: 0.33 },
  repisa: { label: 'Repisas', layer: 'empotrados', height: 0.03, y0: 1.4, depth: 0.25 },
  ducha: { label: 'Ducha con mampara', layer: 'empotrados', height: 2.0, depth: 0.9 },
  inodoro: { label: 'Inodoro', layer: 'empotrados', height: 0.78, depth: 0.7 },
  lavatorio: { label: 'Lavatorio', layer: 'empotrados', height: 0.85, depth: 0.45 },
  pila: { label: 'Pila de lavar', layer: 'empotrados', height: 0.9, depth: 0.6 },
  cama: { label: 'Cama', layer: 'muebles', height: 0.55, depth: 1.95 },
  camarote: { label: 'Camarote', layer: 'muebles', height: 1.6, depth: 1.95 },
  sofa: { label: 'Sofá', layer: 'muebles', height: 0.85, depth: 0.9 },
  mesa: { label: 'Mesa', layer: 'muebles', height: 0.76, depth: 0.9 },
  escritorio: { label: 'Escritorio', layer: 'muebles', height: 0.76, depth: 0.7 },
  librero: { label: 'Librero', layer: 'muebles', height: 1.9, depth: 0.35 },
  tv: { label: 'Televisor y mueble', layer: 'muebles', height: 1.3, depth: 0.45 },
  refri: { label: 'Refrigeradora', layer: 'muebles', height: 1.78, depth: 0.72 },
  cocina: { label: 'Cocina eléctrica', layer: 'muebles', height: 0.92, depth: 0.68 },
  lavadora: { label: 'Lavadora', layer: 'muebles', height: 1.02, depth: 0.68 },
  gimnasio: { label: 'Máquina de ejercicio', layer: 'muebles', height: 2.0, depth: 1.2 },
  muro: { label: 'Muro suelto', layer: 'empotrados', height: 2.0, depth: 0.15 },
  arbol: { label: 'Árbol', layer: 'exterior', height: 6, depth: 4 },
  mesa_concreto: { label: 'Mesa de concreto con bancas', layer: 'exterior', height: 0.75, depth: 2.2 },
  fuente: { label: 'Fuente', layer: 'exterior', height: 1.6, depth: 1.2 },
  tapia: { label: 'Tapia', layer: 'exterior', height: 2.4, depth: 0.15 },
  verja: { label: 'Muro bajo con verja', layer: 'exterior', height: 2.0, depth: 0.2 },
  porton_reja: { label: 'Portón de reja', layer: 'exterior', height: 2.0, depth: 0.1 },
};

// Estilos de tapia: 'liso', 'teja' (remate de teja de barro), 'enredadera' (cubierta de hiedra).
export const WALL_STYLES = [['liso', 'Repello liso'], ['teja', 'Con remate de teja'], ['enredadera', 'Con enredadera']];

export function fixtureInfo(kind) {
  return FIXTURE_KINDS[kind] ?? { label: kind, layer: 'muebles', height: 1, depth: 0.6 };
}
