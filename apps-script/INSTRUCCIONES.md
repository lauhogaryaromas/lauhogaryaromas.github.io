# Panel de administración (desde el celular)

Página privada para que LAU cambie precios, marque stock, suba fotos y agregue productos sin tocar la planilla. Todo se guarda en la planilla y las fotos van a una carpeta del Drive de quien las sube ("LAU Catálogo - Fotos"), que se crea sola.

Solo puede modificar quien sea **Editor** de la planilla. Cualquier otra persona que abra el link no puede cambiar nada.

## Instalación (una sola vez, desde la compu, con tu cuenta)

1. Abrir la planilla → **Extensiones → Apps Script**.
2. En el archivo `Código.gs` borrar todo y pegar el contenido de [`Codigo.gs`](Codigo.gs).
3. Al lado de "Archivos" tocar **＋ → HTML**, ponerle de nombre `Admin` (sin `.html`) y pegar el contenido de [`Admin.html`](Admin.html).
4. Guardar (ícono del disquete).
5. Arriba a la derecha: **Implementar → Nueva implementación**.
   - Engranaje ⚙ → **Aplicación web**.
   - Ejecutar como: **Usuario que accede a la aplicación web**.
   - Quién tiene acceso: **Cualquier persona con una cuenta de Google**.
   - **Implementar**.
6. Copiar la **URL de la aplicación web** (termina en `/exec`).
7. Abrir esa URL en tu navegador para probar. La primera vez pide permiso: **Revisar permisos** → elegir tu cuenta → "Google no verificó esta app" → **Configuración avanzada → Ir a … (no seguro)** → **Permitir**. Es normal: la "app" es este mismo código.
8. Compartir la planilla con el mail de tu mamá como **Editor** (botón **Compartir** de la planilla).

## En el celular de tu mamá

1. Mandarle la URL `/exec` por WhatsApp y abrirla en Chrome con su cuenta de Google.
2. La primera vez le pide el mismo permiso del paso 7: **Revisar permisos → su cuenta → Configuración avanzada → Ir a … (no seguro) → Permitir**.
3. Menú ⋮ → **Agregar a la pantalla principal**. Queda como una app más.

Si aparece un error de "no se puede abrir el archivo", suele ser porque hay **varias cuentas de Google** iniciadas en ese navegador. Abrirla en una pestaña de incógnito iniciando sesión solo con su cuenta, o cerrar las otras cuentas.

## Qué puede hacer

- **Precio:** escribir el número y tocar **Guardar**.
- **Stock:** tocar "Hay stock" o "Sin stock" y **Guardar**.
- **Foto:** tocar "Agregar foto" / "Cambiar foto": deja sacar una foto o elegir de la galería, y se guarda al instante.
- **＋ Nuevo producto:** catálogo, nombre, precio, categoría, descripción y foto.

Los catálogos (Navidad, Día de la Madre…) se siguen creando en la pestaña **Catalogos** de la planilla.

## Si se cambia el código

Pegar el código nuevo, guardar, y **Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. La URL sigue siendo la misma.
