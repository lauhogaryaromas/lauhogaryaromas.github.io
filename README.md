# LAU Hogar y Aromas — Catálogo

Catálogo online publicado en GitHub Pages. Los productos, precios y catálogos se cargan desde una planilla de Google Sheets: se edita la planilla y la página se actualiza sola.

- Pantalla de inicio con los catálogos (general, Navidad, Día de la Madre, etc.) y si están vigentes.
- Cada catálogo con sus productos, agrupados por categoría, con buscador.
- Botón "Pedir por WhatsApp" en cada producto con el mensaje ya escrito.

## Armar la planilla (una sola vez)

1. Crear una planilla nueva en Google Sheets.
2. Importar los tres archivos de la carpeta `plantilla/` con **Archivo → Importar → Subir → "Insertar hojas nuevas"**. Quedan las pestañas **Catalogos**, **Productos** y **Config** (los nombres tienen que ser exactamente esos, sin tilde).
3. Borrar la pestaña vacía "Hoja 1".
4. **Compartir → Acceso general → "Cualquier persona con el enlace" → Lector.**
5. Copiar el código del link (lo que está entre `/d/` y `/edit`) y pegarlo en `SHEET_ID` dentro de `config.js`.

## Cómo se usa la planilla

**Catalogos** — una fila por catálogo.

| Columna | Qué poner |
|---|---|
| Catálogo | Nombre, ej. `Navidad` |
| Descripción | Texto corto que aparece en la tarjeta |
| Visible | `SÍ` para mostrarlo, `NO` para esconderlo |
| Vigente hasta | Opcional, ej. `24/12/2026`. Pasada esa fecha aparece como "Finalizado" |
| Imagen | Opcional, link de una foto |

**Productos** — una fila por producto.

| Columna | Qué poner |
|---|---|
| Catálogo | El nombre del catálogo, igual que en la pestaña Catalogos |
| Categoría | Opcional, ej. `Velas`, `Difusores`, `Combos` |
| Producto | Nombre |
| Descripción | Opcional |
| Precio | Solo el número, ej. `8500`. Vacío = "Consultar" |
| Imagen | Link de la foto (ver abajo) |
| Disponible | `SÍ` o `NO` (con `NO` aparece como "Sin stock") |

El mismo producto puede estar en dos catálogos: se copia la fila y se cambia el catálogo.

**Config**

| Clave | Valor |
|---|---|
| WhatsApp | Número con código de país, ej. `5491123456789` |
| Instagram | Usuario, ej. `lau.hogaryaromas` |
| Bienvenida | Texto que aparece arriba en el inicio |

### Fotos

Subir las fotos a una carpeta de Google Drive, compartir la carpeta como **"Cualquier persona con el enlace"**, y en cada foto usar **Compartir → Copiar vínculo** y pegarlo en la columna Imagen. La página convierte el link sola.

Los cambios en la planilla se ven al recargar la página (a veces tarda 1 o 2 minutos).

## Desarrollo

HTML, CSS y JS puros, sin build. Para probar local: `python3 -m http.server` y abrir `http://localhost:8000`. Sin `SHEET_ID` muestra datos de ejemplo.
