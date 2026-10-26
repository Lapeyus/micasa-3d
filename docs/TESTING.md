# Pruebas

## 1. Estrategia

El proyecto no tenía pruebas automatizadas. La estrategia actual cubre lo que se puede probar sin navegador,
sin red externa y sin Blender:

- **Núcleo geométrico** (`src/core/geometry.js`, `src/core/fixtures.js`): lógica pura en JavaScript,
  probada con el corredor nativo de Node (`node:test`) sobre casas mínimas construidas en la prueba y sobre
  el borrador publicado.
- **Integridad de *casa.json***: ids únicos, rectángulos bien formados y referencias válidas entre
  colecciones, con `unittest` de Python.
- **Herramientas** (`tools/`): `pano_period.py` con imágenes sintéticas generadas en la prueba (nunca con
  fotos reales) y `serve.py` levantado en un puerto libre de `127.0.0.1`.

La interfaz (planta SVG, escena three.js, panorámicas) y el render de Blender se verifican a mano.

## 2. Cómo correr las pruebas

Desde la raíz del repo:

```bash
node --test 'tests/*.test.mjs'                      # Node 22 o superior (probado con 26.7)
.venv/bin/python -m unittest discover -s tests -v   # Python 3.12 del .venv (OpenCV y NumPy)
```

Si el `.venv` no existe: `/opt/homebrew/bin/python3.12 -m venv .venv && .venv/bin/pip install numpy opencv-python`
(no hay `requirements.txt`). Sin OpenCV, `PanoPeriodTest` se omite (`SkipTest`) y el resto corre igual.

## 3. Inventario de suites

| Suite | Archivo | Cubre |
|---|---|---|
| Núcleo geométrico (13 pruebas) | `tests/geometry.test.mjs` | `sideLine` (incluido lado inválido); `area`, `roomArea`, `roomRects` con cuarto en L; altura y color con valores por defecto; muro compartido repartido por mitades con la altura de cada cuarto; muros exteriores con esquinas cerradas; sin muro entre partes del mismo cuarto ni en lados `open`; `resolveOpenings` (puerta al piso, repisa de ventana, tipo desconocido → `vano`, vano huérfano omitido); corte de un vano en ambas mitades del muro compartido con dintel y banda; `bounds` con y sin exteriores; `validate` (traslape, vano fuera de su lado, vano huérfano, casa válida); `fixtureInfo` y capas del catálogo; el borrador valida sin problemas y solo usa tipos conocidos. |
| `CasaDefaultTest` (5) | `tests/test_tools.py` | Campos raíz y `defaults`; ids únicos por colección; rectángulos con `x0 < x1` y `z0 < z1`; vanos con cuarto, lado y ancho válidos; muebles en un cuarto, exterior o `lote`; panorámicas con `at` y archivo `.jpg`; techos `hip`/`gable` y `ridge` válido. |
| `PanoPeriodTest` (2) | `tests/test_tools.py` | Detecta el periodo (±16 px) de una imagen sintética que se repite; no inventa periodo en una imagen sin repetición. |
| `ServeTest` (4) | `tests/test_tools.py` | `GET` con `Cache-Control: no-store`; `PUT /__save/` escribe dentro de `assets/` y responde la ruta; `PUT` que escapa de `assets/` → 403 sin crear el archivo; `PUT` a otra ruta → 404. |

## 4. Último resultado

Corrida del 25 de octubre de 2026 (macOS, Node 26.7.0, Python 3.12 del `.venv`):

```text
node --test 'tests/*.test.mjs'          → tests 13, pass 13, fail 0
python -m unittest discover -s tests    → Ran 11 tests, OK
```

## 5. Datos y servicios que necesitan

| Prueba | Necesita | Cómo se resuelve |
|---|---|---|
| `geometry.test.mjs` | `src/core/casa.default.json` | Se lee del repo; el resto son casas mínimas en memoria. |
| `CasaDefaultTest` | `src/core/casa.default.json` | Se lee del repo. |
| `PanoPeriodTest` | Imágenes panorámicas | Se generan imágenes sintéticas en una carpeta temporal. |
| `ServeTest` | Servidor HTTP | Subproceso de `tools/serve.py` en un puerto libre de `127.0.0.1`; escribe en `assets/_prueba-<id>/` y la borra al terminar. |

Ninguna prueba usa Internet, credenciales, Blender ni las fotos locales.

## 6. Verificación manual

Con `python3 tools/serve.py` y el navegador:

1. **Planta**: arrastrar un cuarto (viajan sus muebles y puntos de foto), redimensionar un borde, deslizar
   una puerta; provocar un traslape y ver el aviso; Cmd/Ctrl+Z deshace.
2. **3D**: vistas Maqueta, Sección y Planta 3D; mover el corte; conmutar capas; «Caminar adentro» y
   comprobar que los muros bloquean el paso.
3. **Panorámicas**: en local se abre la foto; en el sitio publicado aparece el aviso de privacidad.
4. **Datos**: copiar, importar un JSON sin `rooms` (debe rechazarlo), «Volver al borrador» (pide confirmar).
5. **Render**: `--preview --shots fachada` y revisar `assets/renders/fachada-preview.png`.

## 7. Brechas conocidas

- Sin pruebas de interfaz (`app.js`, `plan.js`, `scene3d.js`, `pano.js`); requerirían un navegador sin cabeza.
- Sin prueba de la migración por `revision` en `localStorage` (RF-02).
- Sin prueba del render (`render_casa.py` depende de `bpy`).
- `cocina/` no tiene pruebas.
- No hay CI: las pruebas se corren a mano antes del push.
