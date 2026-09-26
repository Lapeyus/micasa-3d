# Mi Casa 3D

Modelo de toda la casa construido sobre una **estructura base** (`src/core/casa.default.json`)
de la que salen varias visualizaciones.

## Abrir

```bash
python3 tools/serve.py
```

Luego http://localhost:5173 (servidor sin caché; los módulos ES necesitan HTTP).

## Capas

| Capa | Archivo | Qué hace |
|---|---|---|
| Estructura base | `src/core/casa.default.json` | Cuartos (rectángulos a cara interior de muro), vanos, exteriores y panorámicas. Solo datos. |
| Núcleo | `src/core/geometry.js` | Deriva muros (compartidos o de fachada), corta vanos, valida traslapes. No depende de three.js. |
| Editor de planta | `src/arch/plan.js` | SVG: mover y redimensionar cuartos, deslizar puertas, ubicar puntos de foto. |
| Visor arquitectónico | `src/arch/scene3d.js` | three.js con materiales reales, corte de sección, recorrido a pie. |
| Panorámicas | `src/arch/pano.js` | Proyección cilíndrica de las fotos del modo Panorama del Pixel. |
| Cocina detallada | `cocina/` | Primera versión: cocina y lavado con muebles y animaciones. |

## Coordenadas

En planta: `x` crece a la derecha visto desde la calle, `z` hacia el fondo del lote (`z = 0` es la fachada).
En three.js el grupo de la casa usa `scale.z = -1` para no quedar en espejo.

## Privacidad

`photos/`, `panoramas/` y `panoramas-web/` están en `.gitignore`: son fotos del interior de la casa y
solo se ven en la copia local. Para regenerar las versiones web de las panorámicas:

```bash
mkdir -p panoramas-web && for f in panoramas/*.jpg; do sips -Z 8192 -s formatOptions 80 "$f" --out "panoramas-web/$(basename "$f")"; done
```

## Render arquitectónico (Blender Cycles)

1. En la app, pestaña 3D, el modelo se exporta a `assets/modelo/casa.glb` (con el servidor de desarrollo,
   `window.__casa.exportGLB()` y `PUT /__save/modelo/casa.glb`; o el botón «Descargar .glb»).
2. Render:

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P tools/render/render_casa.py -- --samples 256 --res 1920x1080
```

`--shots fachada,aerea,maqueta,patio,sala,cocina,estudio` elige tomas y `--preview` hace una pasada rápida a media
resolución. El script ajusta materiales (vidrio con transmisión, metales, relieve de repello y pisos, bisel de
aristas), cambia los árboles esquemáticos por árboles orgánicos, agrega calle, cielo físico, sol y una luz cálida
por cuarto leída de `casa.json`. Las imágenes quedan en `assets/renders/` (PNG) y en JPG para la web.
