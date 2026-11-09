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
    .setFaviconUrl("https://but0o.github.io/LAU-Hogar-y-Aromas/iconos/icono-32.png");
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
  throw new Error('Falta la columna "' + nombres[0] + '" en la pestaña Productos.');
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

  let catalogos = [];
  try {
    const hc = hoja_(HOJA_CATALOGOS);
    if (hc.getLastRow() > 1) catalogos = hc.getRange(2, 1, hc.getLastRow() - 1, 1).getValues().map((r) => String(r[0]).trim()).filter(String);
  } catch (e) { /* sin pestaña de catálogos */ }
  productos.forEach((p) => { if (p.catalogo && catalogos.indexOf(p.catalogo) === -1) catalogos.push(p.catalogo); });

  const categorias = [...new Set(productos.map((p) => p.categoria).filter(String))].sort();
  return { productos, catalogos, categorias };
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
