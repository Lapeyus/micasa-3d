"""Render arquitectónico de la casa con Blender Cycles.

Uso (desde la raíz del proyecto):
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
      -P tools/render/render_casa.py -- [--shots fachada,aerea] [--samples 256] [--res 1920x1080] [--preview]

Entrada: assets/modelo/casa.glb (se exporta desde la app, pestaña 3D) y src/core/casa.default.json.
Salida: assets/renders/<toma>.png

Coordenadas: el GLB llega en metros; en Blender X = x de planta (derecha vista desde la calle),
Y = z de planta (hacia el fondo del lote) y Z = altura.
"""
import argparse
import json
import math
import pathlib
import sys

import addon_utils
import bpy
import mathutils

ROOT = pathlib.Path(__file__).resolve().parents[2]
GLB = ROOT / 'assets/modelo/casa.glb'
CASA = ROOT / 'src/core/casa.default.json'
OUT = ROOT / 'assets/renders'

# Tomas: posición de cámara, punto al que mira, lente (mm), exposición y si es interior.
SHOTS = {
    'fachada': dict(loc=(8.6, -15.5, 2.4), target=(8.6, -1.5, 2.1), lens=24, exposure=-0.2),
    'aerea': dict(loc=(-13.0, -21.0, 21.0), target=(10.0, 8.0, 0.0), lens=30, exposure=-0.2),
    'maqueta': dict(loc=(-7.0, -15.0, 25.0), target=(10.0, 9.0, 0.0), lens=30, exposure=0.2, cutaway=True),
    'patio': dict(loc=(6.0, 20.3, 1.65), target=(12.0, 13.5, 2.0), lens=18, exposure=-0.2),
    'sala': dict(loc=(12.0, 4.85, 1.45), target=(6.0, -0.5, 1.15), lens=17, exposure=2.4, interior=True),
    'cocina': dict(loc=(11.05, 10.9, 1.55), target=(10.9, 14.6, 1.2), lens=15, exposure=1.2, interior=True),
    'estudio': dict(loc=(6.9, 10.1, 1.45), target=(4.2, 6.0, 1.1), lens=16, exposure=1.8, interior=True),
}


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--shots', default=','.join(SHOTS))
    p.add_argument('--samples', type=int, default=256)
    p.add_argument('--res', default='1920x1080')
    p.add_argument('--preview', action='store_true')
    return p.parse_args(argv)


def setup_cycles(samples, preview):
    addon_utils.enable('cycles', default_set=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        prefs.refresh_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e:  # sin GPU compatible: CPU
        print('Aviso: sin GPU Metal, se usa CPU:', e)
    c = sc.cycles
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02 if preview else 0.008
    c.use_denoising = True
    try:
        c.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    c.max_bounces = 10
    c.diffuse_bounces = 4
    c.glossy_bounces = 4
    c.transmission_bounces = 8
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.blur_glossy = 1.0
    sc.render.use_persistent_data = True
    vs = sc.view_settings
    try:
        vs.view_transform = 'AgX'
        vs.look = 'AgX - Medium High Contrast'
    except Exception:
        vs.view_transform = 'Filmic'


def principled(mat):
    if not mat or not mat.use_nodes:
        return None
    return next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)


def set_input(bsdf, names, value):
    for n in names:
        if n in bsdf.inputs:
            bsdf.inputs[n].default_value = value
            return


def add_bump(mat, strength):
    """Relieve a partir de la misma textura de color (repello, juntas del piso)."""
    nt = mat.node_tree
    bsdf = principled(mat)
    link = next((l for l in nt.links if l.to_node == bsdf and l.to_socket.name == 'Base Color'), None)
    if not link or link.from_node.type != 'TEX_IMAGE':
        return
    bw = nt.nodes.new('ShaderNodeRGBToBW')
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = strength
    bump.inputs['Distance'].default_value = 0.02
    nt.links.new(link.from_node.outputs['Color'], bw.inputs['Color'])
    nt.links.new(bw.outputs['Val'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])


def add_bevel(mat, radius=0.008):
    """Aristas levemente redondeadas en el sombreado: quita el aspecto de maqueta digital."""
    nt = mat.node_tree
    bsdf = principled(mat)
    bev = nt.nodes.new('ShaderNodeBevel')
    bev.inputs['Radius'].default_value = radius
    bump_link = next((l for l in nt.links if l.to_node == bsdf and l.to_socket.name == 'Normal'), None)
    if bump_link:  # encadenar: bisel -> relieve -> BSDF
        nt.links.new(bev.outputs['Normal'], bump_link.from_node.inputs['Normal'])
    else:
        nt.links.new(bev.outputs['Normal'], bsdf.inputs['Normal'])


def tune_materials():
    for mat in bpy.data.materials:
        b = principled(mat)
        if not b:
            continue
        name = mat.name.split('.')[0]
        if name in ('glass', 'glassPane'):
            set_input(b, ['Base Color'], (0.92, 0.96, 0.97, 1))
            set_input(b, ['Transmission Weight', 'Transmission'], 1.0)
            set_input(b, ['Roughness'], 0.02)
            set_input(b, ['IOR'], 1.45)
            set_input(b, ['Alpha'], 1.0)
            if name == 'glassPane':
                set_input(b, ['Roughness'], 0.25)
        elif name == 'stainless':
            set_input(b, ['Metallic'], 1.0)
            set_input(b, ['Roughness'], 0.22)
        elif name in ('iron',):
            set_input(b, ['Metallic'], 0.7)
            set_input(b, ['Roughness'], 0.45)
        elif name == 'zinc':
            # rojo teja sólido; la textura web solo aporta el relieve de la ondulación
            add_bump(mat, 0.35)
            nt = mat.node_tree
            for l in list(nt.links):
                if l.to_node == b and l.to_socket.name == 'Base Color':
                    nt.links.remove(l)
            set_input(b, ['Base Color'], (0.36, 0.045, 0.035, 1))
            set_input(b, ['Metallic'], 0.2)
            set_input(b, ['Roughness'], 0.42)
        elif name.startswith('pared-') or name == 'exterior':
            set_input(b, ['Roughness'], 0.9)
            add_bump(mat, 0.12)
        elif name == 'floors-zacate':
            grass(mat)
        elif name.startswith('floors-'):
            rough = {'floors-ceramica': 0.18, 'floors-provenzal': 0.32, 'floors-parquet': 0.35, 'floors-hidraulico': 0.3}.get(name, 0.9)
            set_input(b, ['Roughness'], rough)
            add_bump(mat, 0.25 if name != 'floors-zacate' else 0.6)
        elif name in ('door', 'trim', 'cabinet', 'louver', 'frame', 'eave', 'beam'):
            set_input(b, ['Roughness'], 0.38)
            add_bump(mat, 0.05)
        elif name == 'porcelain':
            set_input(b, ['Roughness'], 0.06)
        elif name.startswith('leaves') or name.startswith('ivy'):
            set_input(b, ['Roughness'], 0.7)
            set_input(b, ['Subsurface Weight', 'Subsurface'], 0.15)
        elif name == 'Material_32':  # terreno
            grass(mat)
        elif name == 'rug':
            set_input(b, ['Roughness'], 1.0)
            nt = mat.node_tree
            for l in list(nt.links):
                if l.to_node == b and l.to_socket.name == 'Base Color':
                    nt.links.remove(l)
            set_input(b, ['Base Color'], (0.55, 0.5, 0.42, 1))
        if name not in ('glass', 'glassPane', 'rug') and not name.startswith(('leaves', 'floors-zacate', 'Material_32')):
            add_bevel(mat)


def grass(mat):
    """Pasto con manchas de verde claro y oscuro y relieve fino."""
    nt = mat.node_tree
    b = principled(mat)
    for l in list(nt.links):
        if l.to_node == b and l.to_socket.name in ('Base Color', 'Normal'):
            nt.links.remove(l)
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 0.6
    noise.inputs['Detail'].default_value = 8
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.035, 0.075, 0.018, 1)
    ramp.color_ramp.elements[1].color = (0.11, 0.2, 0.045, 1)
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    fine = nt.nodes.new('ShaderNodeTexNoise')
    fine.inputs['Scale'].default_value = 180
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.6
    nt.links.new(fine.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    set_input(b, ['Roughness'], 0.95)
    set_input(b, ['Specular IOR Level', 'Specular'], 0.2)


def material(name, color, rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = principled(m)
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    return m


def plane(name, x0, y0, x1, y1, z, mat):
    bpy.ops.mesh.primitive_plane_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, z))
    o = bpy.context.active_object
    o.name = name
    o.scale = (x1 - x0, y1 - y0, 1)
    o.data.materials.append(mat)
    return o


def organic_trees(casa):
    """Reemplaza los árboles esquemáticos del GLB por troncos cónicos y copas irregulares."""
    bark = material('corteza', (0.16, 0.11, 0.07), 0.95)
    leaf_mats = [material(f'hojas-{i}', c, 0.65) for i, c in enumerate([(0.08, 0.2, 0.04), (0.12, 0.26, 0.05), (0.06, 0.16, 0.035)])]
    for lm in leaf_mats:
        b = principled(lm)
        set_input(b, ['Subsurface Weight', 'Subsurface'], 0.25)
    for f in casa.get('fixtures', []):
        if f['kind'] != 'arbol':
            continue
        doomed = []
        for o in bpy.data.objects:
            p = o
            while p is not None and p.name.split('.')[0] != f['id']:
                p = p.parent
            if p is not None:
                doomed.append(o)
        # borrar todo junto: si se borra el padre primero, los hijos se sueltan y quedan reflejados
        bpy.data.batch_remove(doomed)
        x0, z0, x1, z1 = f['rect']
        cx, cy, r = (x0 + x1) / 2, (z0 + z1) / 2, min(x1 - x0, z1 - z0) / 2
        h = f.get('height', 6)
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.22 * r / 2, radius2=0.1 * r / 2, depth=h * 0.62, location=(cx, cy, h * 0.31))
        trunk = bpy.context.active_object
        trunk.data.materials.append(bark)
        import random
        rnd = random.Random(f['id'])
        for i in range(7):
            ang = rnd.random() * math.tau
            dist = rnd.random() * r * 0.45
            size = r * (0.45 + rnd.random() * 0.3)
            loc = (cx + math.cos(ang) * dist, cy + math.sin(ang) * dist, h * (0.62 + rnd.random() * 0.28))
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=size, location=loc)
            blob = bpy.context.active_object
            tex = bpy.data.textures.new(f"ruido-{f['id']}-{i}", 'VORONOI')
            tex.noise_scale = 0.35
            disp = blob.modifiers.new('hojas', 'DISPLACE')
            disp.texture = tex
            disp.strength = size * 0.45
            blob.scale.z = 0.8
            blob.data.materials.append(leaf_mats[i % 3])
            bpy.ops.object.shade_smooth()


def context(casa):
    """Terreno amplio, calle y acera frente al lote para las tomas exteriores."""
    ground = plane('terreno', -200, -200, 200, 200, -0.09, material('pasto-lejano', (0.06, 0.1, 0.03), 1.0))
    grass(ground.data.materials[0])
    lote_frente = -6.3
    plane('acera', -30, lote_frente - 2.0, 50, lote_frente, 0.02, material('acera', (0.55, 0.54, 0.5), 0.85))
    plane('cordon', -30, lote_frente - 2.2, 50, lote_frente - 2.0, 0.1, material('cordon', (0.7, 0.7, 0.67), 0.8))
    plane('calle', -30, lote_frente - 10.0, 50, lote_frente - 2.2, 0.0, material('asfalto', (0.07, 0.07, 0.075), 0.7))
    plane('franja', -30, lote_frente - 6.2, 50, lote_frente - 6.05, 0.005, material('pintura', (0.85, 0.75, 0.2), 0.6))


def lights(casa, interior):
    sc = bpy.context.scene
    # Cielo físico
    world = bpy.data.worlds.new('cielo')
    sc.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes['Background']
    sky = nt.nodes.new('ShaderNodeTexSky')
    for t in ('MULTIPLE_SCATTERING', 'NISHITA', 'HOSEK_WILKIE'):
        try:
            sky.sky_type = t
            break
        except TypeError:
            continue
    if hasattr(sky, 'sun_disc'):
        sky.sun_disc = False
    elev, azim = math.radians(38), math.radians(215)  # sol de la tarde desde el suroeste
    if hasattr(sky, 'sun_elevation'):
        sky.sun_elevation = elev
        sky.sun_rotation = azim
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.4
    # Sol con sombras nítidas
    sun_data = bpy.data.lights.new('sol', 'SUN')
    sun_data.energy = 5.0
    sun_data.angle = math.radians(1.2)
    sun_data.color = (1.0, 0.95, 0.86)
    sun = bpy.data.objects.new('sol', sun_data)
    sc.collection.objects.link(sun)
    d = mathutils.Vector((math.cos(elev) * math.sin(azim), math.cos(elev) * math.cos(azim), math.sin(elev)))
    sun.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    # Luz de cielo raso en cada cuarto (cálida), más fuerte en tomas interiores
    watts_m2 = 22.0 if interior else 2.0
    for r in casa['rooms']:
        for rc in [r['rect'], *r.get('parts', [])]:
            x0, z0, x1, z1 = rc
            h = r.get('ceiling', casa['defaults']['ceiling'])
            ld = bpy.data.lights.new(f"luz-{r['id']}", 'AREA')
            ld.shape = 'RECTANGLE'
            ld.size = max(0.3, (x1 - x0) * 0.35)
            ld.size_y = max(0.3, (z1 - z0) * 0.35)
            ld.energy = watts_m2 * (x1 - x0) * (z1 - z0)
            ld.color = (1.0, 0.82, 0.62)
            lo = bpy.data.objects.new(f"luz-{r['id']}", ld)
            lo.location = ((x0 + x1) / 2, (z0 + z1) / 2, h - 0.08)
            sc.collection.objects.link(lo)


def camera(name, spec, w, h):
    sc = bpy.context.scene
    cd = bpy.data.cameras.new(name)
    cd.lens = spec['lens']
    cd.sensor_width = 36
    cd.clip_start = 0.05
    cam = bpy.data.objects.new(name, cd)
    sc.collection.objects.link(cam)
    cam.location = spec['loc']
    direction = mathutils.Vector(spec['target']) - mathutils.Vector(spec['loc'])
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    # corrección de verticales (arquitectura): cámara nivelada y desplazamiento vertical del lente
    if not spec.get('cutaway') and spec['loc'][2] < 3:
        pitch = math.atan2(direction.z, math.hypot(direction.x, direction.y))
        yaw = math.atan2(-direction.x, direction.y)  # con X=90° la cámara mira hacia +Y
        cam.rotation_euler = mathutils.Euler((math.pi / 2, 0, yaw), 'XYZ')
        cd.shift_y = math.tan(pitch) * cd.lens / cd.sensor_width
    sc.camera = cam
    return cam


def set_visible(prefixes, visible):
    for o in bpy.data.objects:
        p = o
        while p is not None:
            if p.name.split('.')[0] in prefixes:
                o.hide_render = not visible
                break
            p = p.parent


def main():
    a = args()
    w, h = (int(v) for v in a.res.split('x'))
    if a.preview:
        w, h = w // 2, h // 2
    casa = json.loads(CASA.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    for name in a.shots.split(','):
        spec = SHOTS[name]
        bpy.ops.wm.read_factory_settings(use_empty=True)
        setup_cycles(a.samples if not a.preview else min(a.samples, 48), a.preview)
        bpy.ops.import_scene.gltf(filepath=str(GLB))
        tune_materials()
        organic_trees(casa)
        context(casa)
        lights(casa, spec.get('interior', False))
        set_visible({'roofs', 'ceilings'}, not spec.get('cutaway'))
        sc = bpy.context.scene
        sc.render.resolution_x, sc.render.resolution_y = w, h
        sc.render.resolution_percentage = 100
        sc.view_settings.exposure = spec['exposure']
        camera(name, spec, w, h)
        sc.render.image_settings.file_format = 'PNG'
        sc.render.filepath = str(OUT / (f'{name}-preview.png' if a.preview else f'{name}.png'))
        print(f'>>> Renderizando {name} ({w}x{h})')
        bpy.ops.render.render(write_still=True)
        print(f'>>> Listo {sc.render.filepath}')


main()
