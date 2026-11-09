/**
 * Panel de administración de LAU Hogar y Aromas.
 * Va pegado en la planilla: Extensiones → Apps Script.
 * Se publica como "Aplicación web" (Ejecutar como: Usuario que accede · Acceso: Cualquier persona con cuenta de Google).
 * Solo puede modificar quien sea Editor de la planilla. Cada usuario guarda las fotos en una carpeta de su propio Drive.
 */

const HOJA_PRODUCTOS = "Productos";
const HOJA_CATALOGOS = "Catalogos";
const NOMBRE_CARPETA = "LAU Catálogo - Fotos";

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Admin")
    .setTitle("LAU · Administrar catálogo")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setFaviconUrl("https://lauhogaryaromas.github.io/iconos/icono-32.png");
}

// ---------- Utilidades ----------

function norm_(s) {
  return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

function hoja_(nombre) {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!h) throw new Error('No encuentro la pestaña "' + nombre + '" en la planilla.');
  return h;
}

// Devuelve { nombreNormalizado: númeroDeColumna (1 = A) }
function columnas_(h) {
  const enc = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const mapa = {};
  enc.forEach((v, i) => { if (v !== "") mapa[norm_(v)] = i + 1; });
  return mapa;
}

function col_(mapa, ...nombres) {
  for (const n of nombres) if (mapa[norm_(n)]) return mapa[norm_(n)];
  throw new Error('Falta la columna "' + nombres[0] + '" en la planilla.');
}

function siNo_(v) {
  const n = norm_(v);
  if (v === true) return true;
  if (v === false) return false;
  return !n || !["no", "false", "falso", "0", "n"].includes(n);
}

function idDrive_(url) {
  const m = String(url || "").match(/\/d\/([\w-]{20,})/) || String(url || "").match(/[?&]id=([\w-]{20,})/);
  return m ? m[1] : "";
}

function miniatura_(url) {
  const id = idDrive_(url);
  return id && /drive\.google|docs\.google/.test(url) ? "https://drive.google.com/thumbnail?id=" + id + "&sz=w400" : url;
}

function carpeta_() {
  const props = PropertiesService.getUserProperties();
  const id = props.getProperty("CARPETA_FOTOS");
  if (id) {
    try {
      const c = DriveApp.getFolderById(id);
      if (!c.isTrashed()) return c;
    } catch (e) { /* se borró: se crea otra */ }
  }
  const c = DriveApp.createFolder(NOMBRE_CARPETA);
  c.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  props.setProperty("CARPETA_FOTOS", c.getId());
  return c;
}

function guardarFoto_(foto, nombreProducto) {
  const datos = Utilities.base64Decode(foto.base64);
  const nombre = nombreProducto.replace(/[\\/:*?"<>|]/g, "") + " " +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH.mm") + ".jpg";
  const archivo = carpeta_().createFile(Utilities.newBlob(datos, foto.tipo || "image/jpeg", nombre));
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/file/d/" + archivo.getId() + "/view";
}

// Busca la fila del producto y confirma que sigue siendo el mismo (por si la planilla cambió).
function filaProducto_(h, mapa, fila, nombre) {
  const cNombre = col_(mapa, "producto", "nombre");
  if (fila >= 2 && fila <= h.getLastRow() && String(h.getRange(fila, cNombre).getValue()).trim() === nombre) return fila;
  const nombres = h.getRange(2, cNombre, Math.max(h.getLastRow() - 1, 1), 1).getValues();
  const i = nombres.findIndex((r) => String(r[0]).trim() === nombre);
  if (i === -1) throw new Error('No encuentro "' + nombre + '" en la planilla. Recargá la página.');
  return i + 2;
}

function precioNumero_(p) {
  if (p === "" || p == null) return "";
  const n = Number(String(p).replace(/[$\s.]/g, "").replace(",", "."));
  if (isNaN(n)) throw new Error("El precio tiene que ser un número.");
  return n;
}

// ---------- Funciones que llama el panel ----------

function obtenerDatos() {
  const h = hoja_(HOJA_PRODUCTOS);
  const mapa = columnas_(h);
  const c = {
    catalogo: col_(mapa, "catalogo"),
    categoria: mapa[norm_("categoria")],
    nombre: col_(mapa, "producto", "nombre"),
    descripcion: mapa[norm_("descripcion")],
    precio: col_(mapa, "precio"),
    imagen: col_(mapa, "imagen", "foto"),
    disponible: col_(mapa, "disponible", "stock"),
  };
  const filas = h.getLastRow() > 1 ? h.getRange(2, 1, h.getLastRow() - 1, h.getLastColumn()).getValues() : [];
  const productos = [];
  filas.forEach((f, i) => {
    const nombre = String(f[c.nombre - 1]).trim();
    if (!nombre) return;
    const imagen = String(f[c.imagen - 1]).trim();
    productos.push({
      fila: i + 2,
      catalogo: String(f[c.catalogo - 1]).trim(),
      categoria: c.categoria ? String(f[c.categoria - 1]).trim() : "",
      nombre: nombre,
      descripcion: c.descripcion ? String(f[c.descripcion - 1]).trim() : "",
      precio: f[c.precio - 1] === "" ? "" : String(f[c.precio - 1]),
      miniatura: miniatura_(imagen),
      disponible: siNo_(f[c.disponible - 1]),
    });
  });

  const detalle = leerCatalogos_();
  const catalogos = detalle.map((c) => c.nombre);
  productos.forEach((p) => { if (p.catalogo && catalogos.indexOf(p.catalogo) === -1) catalogos.push(p.catalogo); });

  const categorias = [...new Set(productos.map((p) => p.categoria).filter(String))].sort();
  return { productos, catalogos, categorias, catalogosDetalle: detalle };
}

function guardarCambios(cambio) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const h = hoja_(HOJA_PRODUCTOS);
    const mapa = columnas_(h);
    const fila = filaProducto_(h, mapa, cambio.fila, cambio.nombre);
    if ("precio" in cambio) h.getRange(fila, col_(mapa, "precio")).setValue(precioNumero_(cambio.precio));
    if ("disponible" in cambio) h.getRange(fila, col_(mapa, "disponible", "stock")).setValue(cambio.disponible ? "SÍ" : "NO");
    let miniatura = null;
    if (cambio.foto) {
      const url = guardarFoto_(cambio.foto, cambio.nombre);
      h.getRange(fila, col_(mapa, "imagen", "foto")).setValue(url);
      miniatura = miniatura_(url);
    }
    SpreadsheetApp.flush();
    return { fila, miniatura };
  } finally {
    lock.releaseLock();
  }
}

function agregarProducto(p) {
  if (!p.nombre || !String(p.nombre).trim()) throw new Error("Falta el nombre del producto.");
  if (!p.catalogo) throw new Error("Elegí un catálogo.");
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const h = hoja_(HOJA_PRODUCTOS);
    const mapa = columnas_(h);
    const fila = new Array(h.getLastColumn()).fill("");
    const poner = (valor, ...nombres) => {
      for (const n of nombres) if (mapa[norm_(n)]) { fila[mapa[norm_(n)] - 1] = valor; return; }
    };
    const nombre = String(p.nombre).trim();
    poner(p.catalogo, "catalogo");
    poner(String(p.categoria || "").trim(), "categoria");
    poner(nombre, "producto", "nombre");
    poner(String(p.descripcion || "").trim(), "descripcion");
    poner(precioNumero_(p.precio), "precio");
    poner(p.disponible === false ? "NO" : "SÍ", "disponible", "stock");
    if (p.foto) poner(guardarFoto_(p.foto, nombre), "imagen", "foto");
    h.appendRow(fila);
    SpreadsheetApp.flush();
    return true;
  } finally {
    lock.releaseLock();
  }
}

// ---------- Catálogos ----------

// Se asegura de que existan las columnas "Vigente desde" y "Vigente hasta" (como texto dd/mm/aaaa).
function columnasCatalogos_(hc) {
  let mapa = columnas_(hc);
  if (!mapa["vigente desde"]) {
    const hasta = mapa["vigente hasta"];
    const c = hasta || hc.getLastColumn() + 1;
    if (hasta) hc.insertColumnBefore(hasta);
    hc.getRange(1, c).setValue("Vigente desde");
    mapa = columnas_(hc);
  }
  if (!mapa["vigente hasta"]) {
    hc.getRange(1, hc.getLastColumn() + 1).setValue("Vigente hasta");
    mapa = columnas_(hc);
  }
  // Fechas como texto, para que Google no las cambie de formato.
  const filas = Math.max(hc.getLastRow() - 1, 0);
  ["vigente desde", "vigente hasta"].forEach((k) => {
    if (!filas) return;
    const r = hc.getRange(2, mapa[k], filas, 1);
    if (r.getNumberFormat() === "@") return;
    const vistas = r.getDisplayValues();
    r.setNumberFormat("@").setValues(vistas);
  });
  return mapa;
}

function leerCatalogos_() {
  let hc;
  try { hc = hoja_(HOJA_CATALOGOS); } catch (e) { return []; }
  const mapa = columnasCatalogos_(hc);
  if (hc.getLastRow() < 2) return [];
  const vals = hc.getRange(2, 1, hc.getLastRow() - 1, hc.getLastColumn()).getDisplayValues();
  const cNombre = col_(mapa, "catalogo", "nombre");
  const cDesc = mapa["descripcion"], cVis = mapa["visible"];
  return vals.map((f, i) => ({
    fila: i + 2,
    nombre: String(f[cNombre - 1]).trim(),
    descripcion: cDesc ? f[cDesc - 1] : "",
    visible: cVis ? siNo_(f[cVis - 1]) : true,
    desde: f[mapa["vigente desde"] - 1],
    hasta: f[mapa["vigente hasta"] - 1],
  })).filter((c) => c.nombre);
}

function fechaTexto_(s) {
  s = String(s || "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return Number(m[3]) + "/" + Number(m[2]) + "/" + m[1];
  if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(s)) return s;
  throw new Error("Fecha inválida: " + s);
}

function validarFechas_(desde, hasta) {
  const aDate = (t) => { if (!t) return null; const p = t.split("/").map(Number); return new Date(p[2] || new Date().getFullYear(), p[1] - 1, p[0]); };
  const a = aDate(desde), b = aDate(hasta);
  if (a && b && a > b) throw new Error("La fecha de inicio es posterior a la de fin.");
}

function guardarCatalogo(c) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const hc = hoja_(HOJA_CATALOGOS);
    const mapa = columnasCatalogos_(hc);
    const cNombre = col_(mapa, "catalogo", "nombre");
    let fila = c.fila;
    if (!(fila >= 2 && fila <= hc.getLastRow() && String(hc.getRange(fila, cNombre).getValue()).trim() === c.nombre)) {
      const nombres = hc.getRange(2, cNombre, Math.max(hc.getLastRow() - 1, 1), 1).getValues();
      const i = nombres.findIndex((r) => String(r[0]).trim() === c.nombre);
      if (i === -1) throw new Error('No encuentro el catálogo "' + c.nombre + '". Recargá la página.');
      fila = i + 2;
    }
    const desde = fechaTexto_(c.desde), hasta = fechaTexto_(c.hasta);
    validarFechas_(desde, hasta);
    hc.getRange(fila, mapa["vigente desde"]).setValue(desde);
    hc.getRange(fila, mapa["vigente hasta"]).setValue(hasta);
    if ("visible" in c) hc.getRange(fila, col_(mapa, "visible")).setValue(c.visible ? "SÍ" : "NO");
    if ("descripcion" in c && mapa["descripcion"]) hc.getRange(fila, mapa["descripcion"]).setValue(String(c.descripcion || "").trim());
    SpreadsheetApp.flush();
    return { fila };
  } finally {
    lock.releaseLock();
  }
}

function agregarCatalogo(c) {
  const nombre = String(c.nombre || "").trim();
  if (!nombre) throw new Error("Falta el nombre del catálogo.");
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const hc = hoja_(HOJA_CATALOGOS);
    const mapa = columnasCatalogos_(hc);
    const existentes = leerCatalogos_().map((x) => norm_(x.nombre));
    if (existentes.indexOf(norm_(nombre)) !== -1) throw new Error("Ya existe un catálogo con ese nombre.");
    const desde = fechaTexto_(c.desde), hasta = fechaTexto_(c.hasta);
    validarFechas_(desde, hasta);
    const fila = new Array(hc.getLastColumn()).fill("");
    const poner = (v, k) => { if (mapa[k]) fila[mapa[k] - 1] = v; };
    poner(nombre, mapa["catalogo"] ? "catalogo" : "nombre");
    poner(String(c.descripcion || "").trim(), "descripcion");
    poner(c.visible === false ? "NO" : "SÍ", "visible");
    poner(desde, "vigente desde");
    poner(hasta, "vigente hasta");
    hc.appendRow(fila);
    const n = hc.getLastRow();
    hc.getRange(n, mapa["vigente desde"]).setNumberFormat("@").setValue(desde);
    hc.getRange(n, mapa["vigente hasta"]).setNumberFormat("@").setValue(hasta);
    SpreadsheetApp.flush();
    return true;
  } finally {
    lock.releaseLock();
  }
}
