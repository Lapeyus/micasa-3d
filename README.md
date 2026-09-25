# Cocina y Lavado 3D

Modelo 3D paramétrico (Three.js / WebGL) de la cocina en galera y el pasillo de lavado,
reconstruido a partir de las 29 fotos de `photos/`, la vista de calle y la vista satelital.

## Abrir

```bash
python3 -m http.server 5173
```

Luego abrir http://localhost:5173 (los módulos ES necesitan servirse por HTTP, no con doble clic).

## Estructura

- `src/layout.js` — **todas las medidas** en metros. Es el único archivo que hay que tocar para
  corregir dimensiones (también se pueden editar en la pestaña *Medidas* de la app).
- `src/model.js` — genera paredes, vanos, cielo raso, muebles, electrodomésticos, techo y exterior
  a partir del layout. Cada pieza es un grupo con nombre, etapa de construcción y etiquetas.
- `src/textures.js` — texturas procedurales (piso provenzal, tablilla del cielo, caoba, mosaico, zinc…).
- `src/main.js` — cámara, recorridos, animaciones (construir, vaciar cocina, puertas), cotas y exportación a GLB.

## Coordenadas

`x` = de la pared verde hacia la ventana, `y` = altura, `z` = del muro del lavado hacia la sala
(negativo = dentro del lavado). El modelo se refleja en `x` al final para que la orientación
coincida con las fotos.
