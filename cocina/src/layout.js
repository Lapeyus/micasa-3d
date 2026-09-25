// Medidas del espacio, en metros.
// Sistema de coordenadas:
//   x = ancho de la cocina (0 = cara interior de la pared verde, crece hacia la pared de la ventana)
//   y = altura (0 = piso)
//   z = largo (0 = cara de cocina del muro compartido con el lavado, crece hacia la sala;
//       valores negativos quedan dentro del pasillo de lavado)
//
// Valores ESTIMADOS a partir de las fotos (sin cinta métrica). Reemplazarlos por
// medidas reales hace que el modelo sea exacto: todo se recalcula desde aquí.

export const DEFAULT_LAYOUT = {
  ceilingHeight: 2.55,
  wallThickness: 0.15,

  kitchen: {
    width: 2.55,   // pared verde → pared de la ventana
    length: 4.2,   // muro del lavado → muro de la sala
  },

  laundry: {
    xStart: 0.7,   // pared izquierda (la del póster), vista desde la puerta exterior
    xEnd: 3.05,    // pared derecha (lado lavadora)
    length: 2.9,   // del muro de la cocina a la puerta exterior
  },

  doors: {
    kitchenLaundry: { x: 0.95, width: 0.8, height: 2.1 },  // x = jamba del lado de la pared verde
    kitchenLiving: { x: 1.0, width: 0.92, height: 2.1 },
    laundryExterior: { x: 0.95, width: 0.85, height: 2.1 },
  },

  window: { zStart: 0.8, width: 1.35, sill: 0.98, top: 2.2 },

  counter: { depth: 0.6, height: 0.9, zEnd: 3.9 },
  sink: { zStart: 1.15, width: 0.78 },

  stove: { zStart: 0.16, width: 0.76, depth: 0.68, height: 0.92 },
  fridge: { zStart: 1.0, width: 0.72, depth: 0.72, height: 1.78 },

  upperCabinets: { bottom: 1.48, height: 0.72, depth: 0.33 },

  laundryFit: {
    washer: { zStart: -2.35, width: 0.64, depth: 0.68, height: 1.02 },
    counter: { xStart: 1.95, depth: 0.55, height: 0.95 },
    shelves: [1.42, 1.78],
  },
};

export const LAYOUT_FIELDS = [
  { group: 'General', key: 'ceilingHeight', label: 'Altura de cielo raso', min: 2.2, max: 3.5 },
  { group: 'Cocina', key: 'kitchen.width', label: 'Ancho interior', min: 1.8, max: 4 },
  { group: 'Cocina', key: 'kitchen.length', label: 'Largo interior', min: 2.5, max: 7 },
  { group: 'Cocina', key: 'counter.height', label: 'Altura del mueble', min: 0.8, max: 1 },
  { group: 'Cocina', key: 'counter.depth', label: 'Fondo del mueble', min: 0.45, max: 0.75 },
  { group: 'Cocina', key: 'counter.zEnd', label: 'Fin del mueble (desde muro lavado)', min: 1.5, max: 7 },
  { group: 'Cocina', key: 'window.zStart', label: 'Ventana: inicio', min: 0.2, max: 5 },
  { group: 'Cocina', key: 'window.width', label: 'Ventana: ancho', min: 0.5, max: 3 },
  { group: 'Cocina', key: 'window.sill', label: 'Ventana: altura de repisa', min: 0.8, max: 1.3 },
  { group: 'Cocina', key: 'sink.zStart', label: 'Fregadero: inicio', min: 0.2, max: 5 },
  { group: 'Cocina', key: 'stove.zStart', label: 'Cocina eléctrica: inicio', min: 0, max: 5 },
  { group: 'Cocina', key: 'fridge.zStart', label: 'Refrigeradora: inicio', min: 0, max: 6 },
  { group: 'Puertas', key: 'doors.kitchenLaundry.x', label: 'Puerta lavado: jamba', min: 0.2, max: 3 },
  { group: 'Puertas', key: 'doors.kitchenLaundry.width', label: 'Puerta lavado: ancho', min: 0.6, max: 1.2 },
  { group: 'Puertas', key: 'doors.kitchenLiving.x', label: 'Puerta sala: jamba', min: 0.2, max: 3 },
  { group: 'Puertas', key: 'doors.kitchenLiving.width', label: 'Puerta sala: ancho', min: 0.6, max: 1.5 },
  { group: 'Lavado', key: 'laundry.length', label: 'Largo del pasillo', min: 1.5, max: 6 },
  { group: 'Lavado', key: 'laundry.xStart', label: 'Pared izquierda (x)', min: -1, max: 1.5 },
  { group: 'Lavado', key: 'laundry.xEnd', label: 'Pared derecha (x)', min: 2, max: 5 },
  { group: 'Lavado', key: 'laundryFit.washer.zStart', label: 'Lavadora: posición', min: -6, max: -0.8 },
];

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => o[k], obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], obj)[last] = value;
}

export function cloneLayout(l) {
  return JSON.parse(JSON.stringify(l));
}
