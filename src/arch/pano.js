// Visor de panorámicas cilíndricas (modo Panorama del Pixel).
// La foto se proyecta dentro de un cilindro y la cámara gira desde el centro.
// Arco horizontal = ancho / f, con f ≈ alto de la imagen (campo vertical ~53°);
// si la foto da más de una vuelta se recorta a 360°.
import * as THREE from 'three';

export const PANO_DIR = 'panoramas-web/';

export class PanoViewer {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
    this.yaw = 0;
    this.pitch = 0;
    this.mesh = null;
    this.active = false;
    this.halfV = 0.46;
    this.maxFov = 50;
    this.loader = new THREE.TextureLoader();
    this.bind();
  }

  bind() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    let drag = null;
    el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const k = this.camera.fov / el.clientHeight * (Math.PI / 180);
      this.yaw += (e.clientX - drag.x) * k;
      this.pitch = this.clampPitch(this.pitch + (e.clientY - drag.y) * k);
      drag = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerup', () => { drag = null; });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.fov = THREE.MathUtils.clamp(this.camera.fov + e.deltaY * 0.03, 25, this.maxFov);
      this.camera.updateProjectionMatrix();
      this.pitch = this.clampPitch(this.pitch);
    }, { passive: false });
  }

  // No dejar ver más allá del borde superior o inferior de la foto.
  clampPitch(p) {
    const lim = Math.max(0, this.halfV - THREE.MathUtils.degToRad(this.camera.fov / 2));
    return THREE.MathUtils.clamp(p, -lim, lim);
  }

  // Devuelve una promesa que falla si la imagen no está disponible en esta copia.
  open(pano) {
    this.active = true;
    return new Promise((resolve, reject) => {
      this.loader.load(PANO_DIR + pano.file, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        const { width: W, height: H } = tex.image;
        const f = pano.focal ? pano.focal * (W / (pano.sourceWidth ?? W)) : H;
        let arc = W / f;
        if (arc > Math.PI * 2) {
          tex.repeat.x = (Math.PI * 2) / arc;
          arc = Math.PI * 2;
        }
        const R = 5;
        const height = (H / f) * R;
        if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.map?.dispose(); this.mesh.material.dispose(); }
        const geo = new THREE.CylinderGeometry(R, R, height, 128, 1, true, Math.PI - arc / 2, arc);
        const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.scale.x = -1; // ver la imagen sin espejo desde adentro
        this.scene.add(this.mesh);
        this.halfV = Math.atan(H / (2 * f));
        // campo vertical de la cámara ajustado a lo que cubre la foto (sin franjas negras)
        this.maxFov = Math.min(80, THREE.MathUtils.radToDeg(this.halfV * 2) * 0.97);
        this.yaw = 0;
        this.pitch = 0;
        this.camera.fov = this.maxFov;
        this.camera.updateProjectionMatrix();
        resolve({ arcDeg: Math.round((arc * 180) / Math.PI) });
      }, undefined, () => reject(new Error('no-image')));
    });
  }

  close() { this.active = false; }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    if (!this.active || !this.mesh) return;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(-this.pitch, -this.yaw, 0);
    this.renderer.render(this.scene, this.camera);
  }
}
