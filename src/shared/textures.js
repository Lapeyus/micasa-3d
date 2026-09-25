// Texturas procedurales (canvas) para no depender de imágenes externas.
// Cada textura declara cuántos metros cubre (`worldSize`) para que las UV en
// metros de las geometrías la repitan a escala real.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function finish(c, worldSize, { color = true, anisotropy = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / worldSize, 1 / worldSize);
  t.anisotropy = anisotropy;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function speckle(ctx, size, r, count, colors, maxR = 1.6) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    ctx.globalAlpha = 0.25 + r() * 0.6;
    ctx.beginPath();
    ctx.arc(r() * size, r() * size, 0.4 + r() * maxR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Piso de barro "provenzal": baldosas cuadradas con bordes en S que encajan entre sí.
export function provenzalTiles({ tile = 0.3, n = 4, base = [176, 84, 58] } = {}) {
  const size = 1024;
  const [c, ctx] = canvas(size);
  const r = rng(7);
  const s = size / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const k = (r() - 0.5) * 26;
      ctx.fillStyle = `rgb(${base[0] + k},${base[1] + k * 0.6},${base[2] + k * 0.45})`;
      ctx.fillRect(i * s, j * s, s, s);
      const g = ctx.createRadialGradient(i * s + s / 2, j * s + s / 2, s * 0.1, i * s + s / 2, j * s + s / 2, s * 0.75);
      g.addColorStop(0, 'rgba(255,220,190,0.10)');
      g.addColorStop(1, 'rgba(60,20,10,0.16)');
      ctx.fillStyle = g;
      ctx.fillRect(i * s, j * s, s, s);
    }
  }
  speckle(ctx, size, r, 5000, ['#7a3521', '#c97a57', '#5a2415', '#d99372'], 1.3);

  const a = s * 0.16;
  const edge = (horizontal, i, j) => {
    const sign = (i + j) % 2 === 0 ? 1 : -1;
    ctx.beginPath();
    if (horizontal) {
      const x0 = i * s, y = j * s;
      ctx.moveTo(x0, y);
      ctx.bezierCurveTo(x0 + s / 3, y + a * sign, x0 + (2 * s) / 3, y - a * sign, x0 + s, y);
    } else {
      const y0 = j * s, x = i * s;
      ctx.moveTo(x, y0);
      ctx.bezierCurveTo(x - a * sign, y0 + s / 3, x + a * sign, y0 + (2 * s) / 3, x, y0 + s);
    }
    ctx.stroke();
  };
  const drawGrid = (style, width) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      if (i < n) edge(true, i, j);
      if (j < n) edge(false, i, j);
    }
  };
  drawGrid('rgba(70,32,20,0.9)', 5);
  drawGrid('rgba(214,170,140,0.35)', 1.5);
  return finish(c, tile * n);
}

// Cielo raso de tablilla machihembrada; las tablas corren a lo largo de V.
export function ceilingBoards({ board = 0.095, n = 8 } = {}) {
  const size = 512;
  const [c, ctx] = canvas(size);
  const r = rng(11);
  const w = size / n;
  for (let i = 0; i < n; i++) {
    const k = (r() - 0.5) * 18;
    ctx.fillStyle = `rgb(${92 + k},${50 + k * 0.6},${32 + k * 0.4})`;
    ctx.fillRect(i * w, 0, w, size);
    for (let g = 0; g < 14; g++) {
      ctx.strokeStyle = `rgba(40,18,10,${0.08 + r() * 0.12})`;
      ctx.lineWidth = 1 + r() * 1.5;
      const x = i * w + r() * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + (r() - 0.5) * 8, size / 3, x + (r() - 0.5) * 8, (2 * size) / 3, x, size);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(20,8,4,0.85)';
    ctx.fillRect(i * w, 0, 3, size);
    ctx.fillStyle = 'rgba(255,210,170,0.10)';
    ctx.fillRect(i * w + 3, 0, 2, size);
  }
  return finish(c, board * n);
}

// Veta de madera (caoba) para muebles, puertas y marcos.
export function woodGrain({ base = [92, 38, 22], seed = 3, world = 0.6 } = {}) {
  const size = 512;
  const [c, ctx] = canvas(size);
  const r = rng(seed);
  ctx.fillStyle = `rgb(${base.join(',')})`;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const x = r() * size;
    const d = r() < 0.5 ? 0 : 1;
    ctx.strokeStyle = d ? `rgba(30,10,4,${0.06 + r() * 0.14})` : `rgba(190,110,70,${0.04 + r() * 0.08})`;
    ctx.lineWidth = 0.6 + r() * 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    const wob = 4 + r() * 10;
    for (let y = 0; y <= size; y += 32) ctx.lineTo(x + Math.sin(y / 70 + i) * wob, y);
    ctx.stroke();
  }
  return finish(c, world);
}

// Azulejo tipo mosaico (salpicadero) de cuadritos de ~2.5 cm en grises/verdes.
export function mosaic({ cell = 0.025, n = 24 } = {}) {
  const size = 512;
  const [c, ctx] = canvas(size);
  const r = rng(5);
  const s = size / n;
  ctx.fillStyle = '#b9b7ad';
  ctx.fillRect(0, 0, size, size);
  const tones = ['#4b5350', '#5d6660', '#3e4744', '#707a72', '#6a6f68', '#2f3735', '#84877e'];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    ctx.fillStyle = tones[Math.floor(r() * tones.length)];
    ctx.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(i * s + 2, j * s + 2, s - 6, 2);
  }
  return finish(c, cell * n);
}

// Cubierta laminada/granito en tonos arena con motas.
export function granite() {
  const size = 512;
  const [c, ctx] = canvas(size);
  const r = rng(9);
  ctx.fillStyle = '#8c7f6a';
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, r, 9000, ['#5b4f3f', '#b3a58c', '#3a332a', '#c9bda6', '#77684f'], 2.2);
  return finish(c, 0.5);
}

// Repello de pared: variación sutil que se multiplica por el color del material.
export function plaster(seed = 1) {
  const size = 256;
  const [c, ctx] = canvas(size);
  const r = rng(seed);
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, r, 1400, ['#ebebeb', '#ffffff', '#e4e4e4'], 2.5);
  return finish(c, 0.8);
}

// Vegetación del jardín que se ve por la ventana.
export function foliage() {
  const size = 1024;
  const [c, ctx] = canvas(size);
  const r = rng(21);
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#dff2d0');
  g.addColorStop(0.5, '#8fbf62');
  g.addColorStop(1, '#4d7a35');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const greens = ['#3f7a2a', '#5f9b35', '#7fb944', '#2f5f22', '#a4cf5c', '#6aa83c'];
  for (let i = 0; i < 520; i++) {
    const x = r() * size, y = r() * size, rad = 18 + r() * 70;
    ctx.fillStyle = greens[Math.floor(r() * greens.length)];
    ctx.globalAlpha = 0.55 + r() * 0.4;
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * (0.5 + r() * 0.4), r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,250,200,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - rad * 0.8, y);
    ctx.lineTo(x + rad * 0.8, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const t = finish(c, 4);
  t.repeat.set(1, 1);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Póster de razas de perro (el marco naranja del lavado): cuadrícula de fichas.
export function posterGrid() {
  const [c, ctx] = canvas(256);
  const r = rng(4);
  ctx.fillStyle = '#f6f3ea';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 6; j++) {
    const x = 18 + i * 118, y = 10 + j * 41;
    ctx.fillStyle = ['#c9a27a', '#8a6a4f', '#d8c3a2', '#5e4a3a'][Math.floor(r() * 4)];
    ctx.fillRect(x, y, 34, 34);
    ctx.fillStyle = '#9b958a';
    ctx.fillRect(x + 42, y + 8, 60, 4);
    ctx.fillRect(x + 42, y + 18, 44, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Pintura colgada en la sala.
export function painting() {
  const [c, ctx] = canvas(256);
  const r = rng(8);
  ctx.fillStyle = '#23305c';
  ctx.fillRect(0, 0, 256, 256);
  const cols = ['#e0a33a', '#c2412d', '#3f8f6b', '#e8d8b0', '#7a3d7a'];
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = cols[Math.floor(r() * cols.length)];
    ctx.beginPath();
    ctx.arc(r() * 256, r() * 256, 6 + r() * 26, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Lámina de zinc ondulada (techo rojo). Las ondas corren a lo largo de V.
export function corrugated({ rib = 0.076, n = 8 } = {}) {
  const size = 256;
  const [c, ctx] = canvas(size);
  const g = ctx.createLinearGradient(0, 0, 0, size / n);
  g.addColorStop(0, '#8e2a22');
  g.addColorStop(0.35, '#c4463a');
  g.addColorStop(0.6, '#b23a30');
  g.addColorStop(1, '#7a231c');
  ctx.fillStyle = g;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(0, (i * size) / n);
    ctx.fillRect(0, 0, size, size / n);
    ctx.restore();
  }
  const r = rng(31);
  speckle(ctx, size, r, 500, ['#6d1f18', '#d0584a'], 1.2);
  return finish(c, rib * n);
}

// Parquet de tacos (dormitorio principal): bloques de 4 tablillas alternando dirección.
export function parquet({ block = 0.2, n = 4 } = {}) {
  const size = 512;
  const [c, ctx] = canvas(size);
  const r = rng(51);
  const s = size / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const horiz = (i + j) % 2 === 0;
    for (let k = 0; k < 4; k++) {
      const t = (r() - 0.5) * 30;
      ctx.fillStyle = `rgb(${120 + t},${62 + t * 0.6},${30 + t * 0.4})`;
      if (horiz) ctx.fillRect(i * s, j * s + (k * s) / 4, s, s / 4);
      else ctx.fillRect(i * s + (k * s) / 4, j * s, s / 4, s);
      ctx.strokeStyle = 'rgba(40,18,8,0.55)';
      ctx.lineWidth = 1.5;
      if (horiz) ctx.strokeRect(i * s, j * s + (k * s) / 4, s, s / 4);
      else ctx.strokeRect(i * s + (k * s) / 4, j * s, s / 4, s);
    }
  }
  for (let g = 0; g < 900; g++) {
    ctx.strokeStyle = `rgba(50,20,8,${0.05 + r() * 0.08})`;
    ctx.beginPath();
    const x = r() * size, y = r() * size;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 20, y + (r() - 0.5) * 20);
    ctx.stroke();
  }
  return finish(c, block * n);
}

// Mosaico hidráulico (corredor del anexo): rosetas en azul, ocre y crema.
export function hydraulic({ tile = 0.2, n = 4 } = {}) {
  const size = 512;
  const [c, ctx] = canvas(size);
  const s = size / n;
  const pal = [['#e9dfc7', '#2f5d8a', '#c98a3a'], ['#efe6d2', '#8a3a2f', '#3f6f5a']];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const [bg, a, b] = pal[(i + j) % 2];
    const x = i * s, y = j * s;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = a;
    for (const [cx, cy] of [[0, 0], [s, 0], [0, s], [s, s]]) {
      ctx.beginPath();
      ctx.arc(x + cx, y + cy, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = b;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      const rad = k % 2 ? s * 0.12 : s * 0.3;
      ctx.lineTo(x + s / 2 + Math.cos(ang) * rad, y + s / 2 + Math.sin(ang) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.strokeRect(x, y, s, s);
  }
  return finish(c, tile * n);
}

// Zacate / césped.
export function grass() {
  const size = 256;
  const [c, ctx] = canvas(size);
  const r = rng(61);
  ctx.fillStyle = '#5f8a3c';
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, r, 5000, ['#4f7a30', '#77a24a', '#3e6526', '#8cb65a'], 1.4);
  return finish(c, 1);
}

// Cerámica clara 40x40 (baños).
export function ceramic({ tile = 0.3, n = 4, base = '#d9d6cc' } = {}) {
  const size = 256;
  const [c, ctx] = canvas(size);
  const r = rng(71);
  const s = size / n;
  ctx.fillStyle = '#b9b5aa';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    ctx.fillStyle = base;
    ctx.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
    ctx.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
    ctx.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
  }
  return finish(c, tile * n);
}
