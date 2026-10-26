"""Render de las piezas con Blender (Workbench): base, techo levantado y muebles.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P tools/imprimir/render_piezas.py -- assets/imprimir/escala_1-112
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

carpeta = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
ESCALA = int(carpeta.name.split("-")[-1])
LOSA = 2.0


def importar(nombre, color, dz=0.0, dx=0.0, dy=0.0):
    bpy.ops.wm.stl_import(filepath=str(carpeta / f"{nombre}.stl"))
    o = bpy.context.selected_objects[0]
    o.location = (dx, dy, dz)
    o.color = (*color, 1)
    return o


def escena(objetos, camara, mira, archivo, lente=50):
    for o in bpy.data.objects:
        o.hide_render = o.name not in objetos and o.type == "MESH"
    cam = bpy.data.objects.get("Cam") or bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    if cam.name not in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.link(cam)
    cam.data.lens = lente
    cam.location = camara
    cam.rotation_euler = (Vector(mira) - Vector(camara)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    bpy.context.scene.render.filepath = str(carpeta / archivo)
    bpy.ops.render.render(write_still=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "OBJECT"
sc.display.shading.show_shadows = True
sc.display.shading.show_cavity = True
sc.display.shading.cavity_type = "BOTH"
sc.render.resolution_x, sc.render.resolution_y = 1600, 1100
sc.world = bpy.data.worlds.new("w"); sc.world.color = (0.96, 0.95, 0.93)
sc.render.film_transparent = False

crema, teja, madera = (0.93, 0.91, 0.86), (0.72, 0.33, 0.30), (0.78, 0.62, 0.45)
alto = LOSA + 2.7 * 1000 / ESCALA
base = importar("casa_base", crema)
techo_arriba = importar("casa_techo", teja, dz=alto + 60)
techo_puesto = importar("casa_techo", teja, dz=alto)
c = Vector(((base.bound_box[0][0] + base.bound_box[6][0]) / 2, (base.bound_box[0][1] + base.bound_box[6][1]) / 2, 0))

escena([base.name], c + Vector((-170, -230, 260)), c, "render_interior.png")
escena([base.name, techo_arriba.name], c + Vector((-260, -330, 200)), c + Vector((0, 0, 45)), "render_despiece.png")
escena([base.name, techo_puesto.name], c + Vector((-230, -320, 120)), c + Vector((0, 0, 15)), "render_cerrada.png")

m = importar("muebles_1", madera, dy=-300)
cm = Vector(((m.bound_box[0][0] + m.bound_box[6][0]) / 2, (m.bound_box[0][1] + m.bound_box[6][1]) / 2 - 300, 0))
escena([m.name], cm + Vector((0, -150, 120)), cm, "render_muebles.png")
