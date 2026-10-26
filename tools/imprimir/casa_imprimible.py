"""Casa de muñecas imprimible: piezas STL a partir de casa.json y casa.glb.

    node tools/imprimir/exportar_muros.mjs > /tmp/muros.json
    .venv/bin/python tools/imprimir/casa_imprimible.py /tmp/muros.json --cama 220

Piezas (en assets/imprimir/escala_1-<N>/):
  casa_base.stl     piso, muros con vanos, columnas de corredores y empotrados (cocina, closets, baños)
  casa_techo.stl    techo principal + sala + ala trasera + corredor de la pila, en una sola pieza que se levanta
  anexo_base.stl    oficina, taller, bodegas y corredor del fondo
  anexo_techo.stl, caseta_techo.stl
  muebles_<n>.stl   muebles sueltos acomodados en placas del tamaño de la cama

Los muros, techos y vanos salen de geometry.js (mismo núcleo que el visor); los empotrados
y muebles se toman tal cual del GLB exportado por la app. El techo tiene el fondo plano para
imprimirse sin soportes y una ranura donde encajan los muros exteriores, que sobresalen un poco.
"""

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely.geometry as sg
import shapely.ops as so
import trimesh

RAIZ = Path(__file__).resolve().parents[2]

# Medidas de impresión en mm (FDM, boquilla de 0.4)
MURO_MIN = 1.6      # grosor mínimo de muro
DETALLE_MIN = 0.8   # grosor mínimo de cualquier pieza de mueble o empotrado
LOSA = 2.0          # grosor del piso
LLAVE = 1.2         # cuánto sobresalen los muros exteriores dentro de la ranura del techo
HOLGURA = 0.25      # juego entre muro y ranura, por lado
MARGEN_CAMA = 6.0   # mm libres a cada lado de la cama

LIMITE_ANEXO = 20.5  # z (m): lo que queda más al fondo es el anexo del patio


TRASLAPE = 2e-4  # m: las cajas que solo se tocan por una arista dan STL no-manifold; así se traslapan
_jitter = iter(range(10**9))


def jitter():
    """Variación determinista de 1–47 pasos de 0.11 mm reales (≈0.001 mm impreso cada uno).

    Evita caras coplanares exactas entre piezas; más fina que eso, el redondeo del STL
    junta los vértices y deja aristas degeneradas.
    """
    return ((next(_jitter) * 7919) % 47 + 1) * 1.12e-4


def caja(x0, x1, y0, y1, z0, z1):
    """Caja en coordenadas de impresión (X=x de la casa, Y=z de la casa, Z=altura)."""
    x0, y0, x1, y1 = x0 - TRASLAPE, y0 - TRASLAPE, x1 + TRASLAPE, y1 + TRASLAPE
    b = trimesh.creation.box(extents=[x1 - x0, y1 - y0, z1 - z0])
    b.apply_translation([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2])
    return b


def engrosar(m, minimo, ejes=(0, 1, 2)):
    """Estira la malla alrededor de su centro en los ejes donde es más delgada que `minimo`."""
    lo, hi = m.bounds
    ext = hi - lo
    s = np.ones(3)
    for e in ejes:
        if ext[e] > 1e-9:  # siempre crece un pelo (TRASLAPE) para que lo que se toca se traslape
            s[e] = max(minimo, ext[e] + 2 * (TRASLAPE + jitter())) / ext[e]
    c = (lo + hi) / 2
    t = np.eye(4)
    t[:3, :3] = np.diag(s)
    t[:3, 3] = c - s * c
    t[0, 3] += jitter() / 2  # y se corre un pelo, para no quedar a ras de la cara de un muro
    t[1, 3] += jitter() / 2
    m.apply_transform(t)
    return m


def unir(mallas):
    mallas = [m for m in mallas if m is not None and len(m.faces)]
    if not mallas:
        return None
    return trimesh.boolean.union(mallas, engine="manifold")


def limpiar(poligono, hueco_min=1.0):
    """Quita rendijas, vértices casi colineales y huecos interiores pequeños (< hueco_min m²)."""
    e = 1e-3
    poligono = poligono.buffer(e, join_style=2).buffer(-e, join_style=2).simplify(1e-4)
    partes = poligono.geoms if hasattr(poligono, "geoms") else [poligono]
    return so.unary_union([sg.Polygon(q.exterior, [i for i in q.interiors if sg.Polygon(i).area >= hueco_min])
                           for q in partes])


def extruir(poligono, z0, z1):
    poligono = limpiar(poligono)
    partes = poligono.geoms if hasattr(poligono, "geoms") else [poligono]
    return unir([trimesh.creation.extrude_polygon(p, z1 - z0).apply_translation([0, 0, z0])
                 for p in partes if p.area > 1e-8])


def rect_poly(r):
    return sg.box(min(r[0], r[2]), min(r[1], r[3]), max(r[0], r[2]), max(r[1], r[3]))


# ---------- techo ----------

def techo_solido(rf, alto_fondo):
    """Sólido del techo (convex hull) con el fondo plano en `alto_fondo`.

    Reproduce buildRoof de scene3d.js: alero `overhang`, pendiente `pitch`, cenefa de 0.18 m.
    El techo completo se sube lo necesario para que la cenefa termine en `alto_fondo`.
    """
    ov = rf.get("overhang", 0.7)
    p = math.radians(rf.get("pitch", 18))
    a0, b0, a1, b1 = rf["rect"]
    x0, z0, x1, z1 = a0 - ov, b0 - ov, a1 + ov, b1 + ov
    base = rf.get("base", 2.8)
    ye = base - ov * math.tan(p)
    cenefa = 0.18
    dy = alto_fondo - (ye - cenefa)
    ye += dy
    a_lo_x = rf["ridge"] != "z" if rf["kind"] == "gable" else (x1 - x0) >= (z1 - z0)
    half = (z1 - z0) / 2 if a_lo_x else (x1 - x0) / 2
    top = ye + half * math.tan(p)
    inset = 0 if rf["kind"] == "gable" else min(half, ((x1 - x0) if a_lo_x else (z1 - z0)) / 2 - 0.01)
    if a_lo_x:
        zm = (z0 + z1) / 2
        cumbrera = [(x0 + inset, zm, top), (x1 - inset, zm, top)]
    else:
        xm = (x0 + x1) / 2
        cumbrera = [(xm, z0 + inset, top), (xm, z1 - inset, top)]
    puntos = [(x, z, h) for h in (ye, alto_fondo) for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1))]
    return trimesh.convex.convex_hull(np.array(puntos + cumbrera))


# ---------- GLB ----------

def piezas_glb(ruta, capa):
    """{nombre del hijo de la capa: [mallas en coords de impresión, metros]}."""
    escena = trimesh.load(ruta)
    g = escena.graph
    padres = g.transforms.parents
    giro = np.array([[1, 0, 0, 0], [0, 0, -1, 0], [0, 1, 0, 0], [0, 0, 0, 1]], float)  # (x,y,zg)->(x,-zg,y)
    out = defaultdict(list)
    for nodo in g.nodes_geometry:
        cadena = [nodo]
        while cadena[-1] in padres:
            cadena.append(padres[cadena[-1]])
        cadena = cadena[::-1]
        if capa not in cadena:
            continue
        i = cadena.index(capa)
        hijo = cadena[i + 1] if i + 1 < len(cadena) else nodo
        tf, geom = g[nodo]
        m = escena.geometry[geom].copy()
        m.apply_transform(giro @ tf)
        m.merge_vertices(digits_vertex=5)
        if not m.is_watertight:  # planos sueltos (vidrios, espejos): se vuelven placa
            if m.extents.min() < 1e-3 and len(m.faces) <= 4:
                m = trimesh.creation.box(extents=np.maximum(m.extents, 1e-3)).apply_translation(m.bounds.mean(0))
            else:
                m = m.convex_hull
        out[hijo].append(m)
    return out


# ---------- grupos ----------

def de_grupo(z, grupo):
    return (z <= LIMITE_ANEXO) == (grupo == "casa")


def bajo_techo(x, z, rf):
    ov = rf.get("overhang", 0.7)
    a0, b0, a1, b1 = rf["rect"]
    return a0 - ov <= x <= a1 + ov and b0 - ov <= z <= b1 + ov


def armar_base(datos, grupo, mm, empotrados, edificios):
    """Piso, muros, columnas y empotrados de un grupo. `edificios`: {nombre: [techos]}.

    Devuelve la base y, por edificio, (altura de apoyo del techo, huella de muros exteriores, corredores).
    """
    celdas = [c for c in datos["cells"] if de_grupo((c["rect"][1] + c["rect"][3]) / 2, grupo)]
    cuartos = {c["room"] for c in celdas}
    muros = [w for w in datos["walls"] if w["room"] in cuartos]
    corredores = [o for o in datos["outdoor"] if o.get("roof") and de_grupo((o["rect"][1] + o["rect"][3]) / 2, grupo)]

    def edificio_de(x, z):
        for nombre, techos in edificios.items():
            if any(bajo_techo(x, z, rf) for rf in techos):
                return nombre
        return next(iter(edificios))

    info = {n: {"alto": 0.0, "ext": [], "corr": []} for n in edificios}
    for c in celdas:
        e = edificio_de((c["rect"][0] + c["rect"][2]) / 2, (c["rect"][1] + c["rect"][3]) / 2)
        info[e]["alto"] = max(info[e]["alto"], c["height"])
    for o in corredores:
        e = edificio_de((o["rect"][0] + o["rect"][2]) / 2, (o["rect"][1] + o["rect"][3]) / 2)
        info[e]["corr"].append(o)

    partes, huellas = [], []
    for w in muros:
        e = info[edificio_de((w["x0"] + w["x1"]) / 2, (w["z0"] + w["z1"]) / 2)]
        # los muros exteriores llegan hasta el techo y sobresalen LLAVE para encajar en la ranura
        sube = w["exterior"] and w["y1"] > 2.0
        # la variación sube las llaves y baja los muros interiores (nunca deben tocar el fondo del techo)
        y1 = e["alto"] + LLAVE * mm + jitter() if sube else min(w["y1"], e["alto"] - 0.02) - jitter()
        b = engrosar(caja(w["x0"], w["x1"], w["z0"], w["z1"], w["y0"], y1), MURO_MIN * mm, ejes=(0, 1))
        partes.append(b)
        huellas.append(sg.box(*b.bounds[0][:2], *b.bounds[1][:2]))
        if sube:
            e["ext"].append(huellas[-1])

    huella = so.unary_union(huellas + [rect_poly(c["rect"]) for c in celdas] + [rect_poly(o["rect"]) for o in corredores])
    partes.append(extruir(huella.buffer(4 * TRASLAPE, join_style=2), -LOSA * mm, TRASLAPE))

    # columnas de 0.3 m en las esquinas de cada corredor techado (como en el GLB)
    for e in info.values():
        for o in e["corr"]:
            x0, z0, x1, z1 = o["rect"]
            for cx, cz in ((x0, z0), (x1 - 0.3, z0), (x0, z1 - 0.3), (x1 - 0.3, z1 - 0.3)):
                partes.append(caja(cx, cx + 0.3, cz, cz + 0.3, 0, e["alto"] - 0.02))

    for nombre, mallas in empotrados.items():
        z = np.mean([m.bounds.mean(0)[1] for m in mallas])
        if de_grupo(z, grupo):
            partes += [engrosar(m.copy(), DETALLE_MIN * mm) for m in mallas]

    for e in info.values():
        e["ext"] = so.unary_union(e["ext"]) if e["ext"] else None
    return unir(partes), info


def armar_techo(techos, e, mm):
    alto = e["alto"]
    solidos = [techo_solido(rf, alto) for rf in techos]
    grosor = max(1.2 * mm, 0.05)
    for o in e["corr"]:  # losa del corredor colgada del techo, apoyada en las columnas
        x0, z0, x1, z1 = o["rect"]
        solidos.append(caja(x0 - 0.3, x1 + 0.3, z0 - 0.3, z1 + 0.3, alto, alto + grosor))
    techo = unir(solidos)
    if e["ext"] is not None:
        ranura = extruir(e["ext"].buffer(HOLGURA * mm, join_style=2), alto - 1, alto + (LLAVE + 0.3) * mm)
        techo = trimesh.boolean.difference([techo, ranura], engine="manifold")
    return techo


# ---------- muebles sueltos ----------

def acomodar(piezas, cama_mm, sep=3.0):
    """Estantería simple: llena placas de cama_mm x cama_mm. Devuelve [[malla, ...], ...]."""
    util = cama_mm - 2 * MARGEN_CAMA
    piezas = sorted(piezas, key=lambda m: -m.extents[1])
    placas, actual = [], []
    x = y = fila = 0.0
    for m in piezas:
        w, d = m.extents[0], m.extents[1]
        if w > d and d <= util and w > util:  # girar las piezas largas
            m.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [0, 0, 1]))
            w, d = d, w
        if x + w > util:
            x, y, fila = 0.0, y + fila + sep, 0.0
        if y + d > util:
            placas.append(actual)
            actual, x, y, fila = [], 0.0, 0.0, 0.0
        lo = m.bounds[0]
        m.apply_translation([MARGEN_CAMA + x - lo[0], MARGEN_CAMA + y - lo[1], -lo[2]])
        actual.append(m)
        x += w + sep
        fila = max(fila, d)
    if actual:
        placas.append(actual)
    return placas


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("muros", type=Path, help="salida de exportar_muros.mjs")
    p.add_argument("--glb", type=Path, default=RAIZ / "assets/modelo/casa.glb")
    p.add_argument("--cama", type=float, default=220, help="lado de la cama en mm (AnkerMake M5C: 220)")
    p.add_argument("--escala", type=int, help="1:N; por defecto la más grande que cabe en la cama")
    a = p.parse_args()

    datos = json.loads(a.muros.read_text())
    techos = {rf["id"]: rf for rf in datos["roofs"]}
    techos_casa = [techos[i] for i in ("techo-principal", "techo-frente", "techo-ala")]

    empotrados = piezas_glb(a.glb, "empotrados")
    muebles = piezas_glb(a.glb, "muebles")
    casa = {"casa": techos_casa}
    util = a.cama - 2 * MARGEN_CAMA

    if a.escala:
        escala = a.escala
    else:
        # Las piezas más grandes son la base y el techo de la casa; su huella en metros casi
        # no depende de la escala (solo el engrosado de muros), así que basta una pasada provisional.
        base, info = armar_base(datos, "casa", 0.1, empotrados, casa)
        techo = armar_techo(techos_casa, info["casa"], 0.1)
        lado_m = max(*base.extents[:2], *techo.extents[:2])
        escala = math.ceil(lado_m * 1000 / util * 1.005)
    mm = escala / 1000  # metros reales que mide 1 mm impreso
    print(f"Escala 1:{escala}  (1 mm impreso = {mm * 100:.1f} cm reales)")

    salida = RAIZ / "assets" / "imprimir" / f"escala_1-{escala}"
    salida.mkdir(parents=True, exist_ok=True)
    a_mm = trimesh.transformations.scale_matrix(1000 / escala)

    def exportar(nombre, malla, en_metros=True, solo_apoyadas=False):
        malla = malla.copy()
        if en_metros:
            malla.apply_transform(a_mm)
        # fuera astillas y piezas que quedarían flotando (p. ej. frentes de mueble despegados)
        partes = malla.split(only_watertight=False)
        if len(partes) > 1:
            piso = malla.bounds[0][2]
            grande = max(partes, key=lambda q: q.volume)
            quedan = [q for q in partes if q is grande or (q.volume > 0.5 and (not solo_apoyadas or q.bounds[0][2] - piso < 0.05))]
            if len(quedan) < len(partes):
                print(f"  ({nombre}: descarto {len(partes) - len(quedan)} piezas sueltas)")
            malla = trimesh.util.concatenate(quedan)
        malla.apply_translation(-malla.bounds[0] * [0, 0, 1])  # apoyada en z=0
        x, y, z = malla.extents
        cabe = "ok" if max(x, y) <= util + 0.01 else "NO CABE"
        malla.export(salida / f"{nombre}.stl")
        cerrada = trimesh.load(salida / f"{nombre}.stl").is_watertight  # tal como lo verá el slicer
        print(f"  {nombre:14s} {x:6.1f} x {y:6.1f} x {z:5.1f} mm  cerrada={cerrada}  {cabe}")
        return malla

    base, info = armar_base(datos, "casa", mm, empotrados, casa)
    exportar("casa_base", base, solo_apoyadas=True)
    exportar("casa_techo", armar_techo(techos_casa, info["casa"], mm))

    anexo = {"caseta": [techos["techo-caseta"]], "anexo": [techos["techo-anexo"]]}
    base, info = armar_base(datos, "anexo", mm, empotrados, anexo)
    exportar("anexo_base", base, solo_apoyadas=True)
    for nombre, ts in anexo.items():
        exportar(f"{nombre}_techo", armar_techo(ts, info[nombre], mm))

    piezas = []
    for nombre, mallas in muebles.items():
        m = unir([engrosar(x.copy(), DETALLE_MIN * mm) for x in mallas])
        if m is not None:
            partes = m.split(only_watertight=False)
            if len(partes) > 1:  # lo que no toca el piso del mueble no se puede imprimir solo
                m = trimesh.util.concatenate([q for q in partes if q.bounds[0][2] - m.bounds[0][2] < 1e-3])
            m.apply_transform(a_mm)
            m.metadata["nombre"] = nombre
            piezas.append(m)
    for i, placa in enumerate(acomodar(piezas, a.cama), 1):
        exportar(f"muebles_{i}", trimesh.util.concatenate(placa), en_metros=False)
    print(f"Listo en {salida}/ ({len(piezas)} muebles)")


if __name__ == "__main__":
    main()
