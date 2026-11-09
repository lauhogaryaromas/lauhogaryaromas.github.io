(() => {
  "use strict";

  const CFG = window.CONFIG || {};
  // Acepta el código solo o el link completo de la planilla.
  CFG.SHEET_ID = String(CFG.SHEET_ID || "").trim().replace(/^.*\/spreadsheets\/d\/([\w-]+).*$/, "$1");
  const app = document.getElementById("app");
  const aviso = document.getElementById("aviso");

  // ---------- Datos de ejemplo (se usan si no hay planilla configurada) ----------
  const DEMO = {
    Catalogos: [
      ["Catálogo", "Descripción", "Visible", "Vigente desde", "Vigente hasta", "Imagen"],
      ["Catálogo general", "Todos nuestros productos para el hogar.", "SÍ", "", "", ""],
      ["Navidad", "Combos y regalos para estas fiestas.", "SÍ", "1/11/2026", "24/12/2026", ""],
      ["Día de la Madre", "Regalos especiales para mamá.", "SÍ", "1/10/2026", "18/10/2026", ""],
      ["Reyes", "Aparece recién en diciembre.", "SÍ", "26/12/2026", "6/1/2027", ""],
    ],
    Productos: [
      ["Catálogo", "Categoría", "Producto", "Descripción", "Precio", "Imagen", "Disponible"],
      ["Catálogo general", "Velas", "Vela de soja 200 g", "Aroma vainilla o lavanda.", "8500", "", "SÍ"],
      ["Catálogo general", "Velas", "Vela en frasco de vidrio", "Con tapa de madera.", "11000", "", "SÍ"],
      ["Catálogo general", "Difusores", "Difusor de varillas 125 ml", "Aromas: frutos rojos, bambú, coco.", "9800", "", "SÍ"],
      ["Catálogo general", "Sahumerios", "Caja de sahumerios x 20", "", "2500", "", "NO"],
      ["Navidad", "Combos", "Combo Noche Buena", "Vela + difusor + tarjeta navideña.", "19900", "", "SÍ"],
      ["Navidad", "Combos", "Combo Arbolito", "Home spray + 2 velas chicas.", "15500", "", "SÍ"],
      ["Día de la Madre", "Combos", "Combo Mamá", "Difusor + vela + bolsita de regalo.", "18000", "", "SÍ"],
    ],
    Config: [
      ["Clave", "Valor"],
      ["WhatsApp", ""],
      ["Instagram", ""],
      ["Bienvenida", "Elegí un catálogo para ver los productos."],
    ],
  };

  // ---------- Utilidades ----------
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const siNo = (v, porDefecto = true) => {
    const n = norm(v);
    if (!n) return porDefecto;
    return !["no", "false", "falso", "0", "n"].includes(n);
  };

  function parseCSV(texto) {
    const filas = [];
    let fila = [], campo = "", comillas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (comillas) {
        if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') comillas = false;
        else campo += c;
      } else if (c === '"') comillas = true;
      else if (c === ",") { fila.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        fila.push(campo); filas.push(fila); fila = []; campo = "";
      } else campo += c;
    }
    if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
    return filas;
  }

  // Convierte una tabla (primera fila = encabezados) en objetos con claves normalizadas.
  function aObjetos(filas) {
    if (!filas.length) return [];
    const enc = filas[0].map(norm);
    return filas.slice(1)
      .filter((f) => f.some((v) => String(v).trim() !== ""))
      .map((f) => Object.fromEntries(enc.map((k, i) => [k, String(f[i] ?? "").trim()])));
  }

  const col = (obj, ...nombres) => {
    for (const n of nombres) if (obj[norm(n)] !== undefined && obj[norm(n)] !== "") return obj[norm(n)];
    return "";
  };

  // Links de Google Drive -> link directo a la imagen.
  function urlImagen(u) {
    if (!u) return "";
    const m = u.match(/\/d\/([\w-]{20,})/) || u.match(/[?&]id=([\w-]{20,})/);
    if (m && /drive\.google|docs\.google/.test(u)) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
    return u;
  }

  function precioTexto(p) {
    if (!p) return "Consultar";
    const limpio = p.replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(limpio);
    if (!isNaN(n) && limpio !== "") return "$ " + n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
    return p;
  }

  // Acepta "24/12", "24/12/2026" o "2026-12-24". Devuelve el fin de ese día (o el inicio si inicio=true) o null.
  function parseFecha(s, inicio) {
    if (!s) return null;
    let d, m, a;
    let r = s.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
    if (r) { d = +r[1]; m = +r[2]; a = r[3] ? +r[3] : new Date().getFullYear(); if (a < 100) a += 2000; }
    else if ((r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { a = +r[1]; m = +r[2]; d = +r[3]; }
    else return null;
    const f = inicio ? new Date(a, m - 1, d, 0, 0, 0) : new Date(a, m - 1, d, 23, 59, 59);
    return isNaN(f) ? null : f;
  }

  // "24/12/2026" -> "24/12" si es de este año; si no, la deja igual.
  function fechaCorta(s) {
    const f = parseFecha(s);
    if (!f) return s;
    const dm = `${f.getDate()}/${f.getMonth() + 1}`;
    return f.getFullYear() === new Date().getFullYear() ? dm : `${dm}/${f.getFullYear()}`;
  }

  // ---------- Carga de la planilla ----------
  async function hoja(nombre) {
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(CFG.SHEET_ID)}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(nombre)}&_=${Date.now()}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`No se pudo leer la pestaña "${nombre}" (${r.status})`);
    const txt = await r.text();
    if (/^\s*</.test(txt)) throw new Error(`La planilla no es pública (pestaña "${nombre}")`);
    return parseCSV(txt);
  }

  let DATOS = null;

  async function cargar() {
    let crudo;
    if (!CFG.SHEET_ID) {
      crudo = DEMO;
      mostrarAviso("Vista de ejemplo: todavía no hay planilla conectada.");
    } else {
      try {
        const [c, p, k] = await Promise.all([
          hoja("Catalogos"), hoja("Productos"), hoja("Config").catch(() => [["Clave", "Valor"]]),
        ]);
        crudo = { Catalogos: c, Productos: p, Config: k };
      } catch (e) {
        console.error(e);
        app.innerHTML = `<p class="vacio">No pudimos cargar el catálogo. Probá de nuevo en un rato.</p>`;
        return;
      }
    }

    const config = {};
    for (const fila of crudo.Config.slice(1)) if (fila[0]) config[norm(fila[0])] = String(fila[1] ?? "").trim();

    const hoy = new Date();
    const catalogos = aObjetos(crudo.Catalogos)
      .map((o) => {
        const nombre = col(o, "catalogo", "nombre");
        const desde = col(o, "vigente desde", "desde", "inicio");
        const hasta = col(o, "vigente hasta", "hasta", "vigencia", "fin");
        const ini = parseFecha(desde, true);
        const fin = parseFecha(hasta);
        return {
          nombre, slug: slug(nombre),
          descripcion: col(o, "descripcion"),
          // Antes de la fecha de inicio el catálogo no se muestra.
          visible: siNo(col(o, "visible", "mostrar")) && !(ini && ini > hoy),
          hasta: fechaCorta(hasta), vencido: fin ? fin < hoy : false,
          imagen: urlImagen(col(o, "imagen", "foto")),
        };
      })
      .filter((c) => c.nombre && c.visible);

    const productos = aObjetos(crudo.Productos)
      .map((o) => ({
        catalogo: slug(col(o, "catalogo")),
        categoria: col(o, "categoria"),
        nombre: col(o, "producto", "nombre"),
        descripcion: col(o, "descripcion"),
        precio: col(o, "precio"),
        imagen: urlImagen(col(o, "imagen", "foto")),
        disponible: siNo(col(o, "disponible", "stock")),
      }))
      .filter((p) => p.nombre);

    DATOS = { config, catalogos, productos };
    prepararWhatsApp();
    render();
  }

  function mostrarAviso(t) { aviso.textContent = t; aviso.hidden = false; }

  // ---------- WhatsApp ----------
  const numeroWA = () => (DATOS.config.whatsapp || "").replace(/\D/g, "");
  const linkWA = (msg) => `https://wa.me/${numeroWA()}?text=${encodeURIComponent(msg)}`;

  function prepararWhatsApp() {
    const fl = document.getElementById("wa-flotante");
    if (numeroWA()) {
      fl.href = linkWA(`¡Hola! Vi el catálogo de ${CFG.NOMBRE} y quería consultar.`);
      fl.hidden = false;
    }
    const redes = [];
    const ig = (DATOS.config.instagram || "").replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");
    if (ig) redes.push(`<a href="https://instagram.com/${esc(ig)}" target="_blank" rel="noopener">Instagram @${esc(ig)}</a>`);
    if (numeroWA()) redes.push(`<a href="${linkWA("¡Hola!")}" target="_blank" rel="noopener">WhatsApp</a>`);
    document.getElementById("pie-redes").innerHTML = redes.join(" · ");
  }

  // ---------- Pantallas ----------
  function render() {
    if (!DATOS) return;
    const ruta = location.hash.replace(/^#\/?/, "");
    const m = ruta.match(/^c\/([^/?]+)/);
    if (m) {
      const cat = DATOS.catalogos.find((c) => c.slug === m[1]);
      if (cat) return pantallaCatalogo(cat);
    }
    pantallaInicio();
  }

  function pantallaInicio() {
    document.title = `${CFG.NOMBRE} · Catálogo`;
    const cats = [...DATOS.catalogos].sort((a, b) => a.vencido - b.vencido);
    if (!cats.length) {
      app.innerHTML = `<p class="vacio">Pronto vas a encontrar acá nuestros catálogos.</p>`;
      return;
    }
    const bienvenida = DATOS.config.bienvenida || "Elegí un catálogo para ver los productos.";
    app.innerHTML = `
      <h1 class="titulo">Nuestros catálogos</h1>
      <p class="bajada">${esc(bienvenida)}</p>
      <div class="catalogos">
        ${cats.map((c) => {
          const cant = DATOS.productos.filter((p) => p.catalogo === c.slug).length;
          const etiqueta = c.vencido
            ? `<span class="etiqueta agotado">Finalizado</span>`
            : `<span class="etiqueta">${c.hasta ? "Vigente hasta " + esc(c.hasta) : "Vigente"}</span>`;
          const img = c.imagen
            ? `<img class="cat-img" src="${esc(c.imagen)}" alt="" loading="lazy">`
            : `<div class="cat-img sin-foto">${esc(c.nombre.charAt(0))}</div>`;
          return `
            <a class="cat" href="#/c/${c.slug}">
              ${img}
              <div class="cat-cuerpo">
                <h2>${esc(c.nombre)}</h2>
                ${c.descripcion ? `<p>${esc(c.descripcion)}</p>` : ""}
                <div class="cat-pie">${etiqueta}<span class="cat-ver">Ver ${cant} producto${cant === 1 ? "" : "s"} →</span></div>
              </div>
            </a>`;
        }).join("")}
      </div>`;
    window.scrollTo(0, 0);
  }

  function pantallaCatalogo(cat) {
    document.title = `${cat.nombre} · ${CFG.NOMBRE}`;
    const prods = DATOS.productos.filter((p) => p.catalogo === cat.slug);
    const categorias = [...new Set(prods.map((p) => p.categoria).filter(Boolean))];
    let filtro = "", busqueda = "";

    app.innerHTML = `
      <a class="volver" href="#/">← Todos los catálogos</a>
      <h1 class="titulo">${esc(cat.nombre)}</h1>
      <p class="bajada">${esc(cat.descripcion)}${cat.vencido ? " · <strong>Este catálogo ya finalizó.</strong>" : cat.hasta ? ` · Vigente hasta ${esc(cat.hasta)}` : ""}</p>
      ${prods.length > 6 ? `<input class="buscador" type="search" placeholder="Buscar producto…" aria-label="Buscar producto">` : ""}
      ${categorias.length > 1 ? `<div class="filtros" role="group" aria-label="Categorías">
        <button class="chip" data-cat="" aria-pressed="true">Todo</button>
        ${categorias.map((c) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join("")}
      </div>` : ""}
      <div id="lista"></div>`;

    const lista = app.querySelector("#lista");

    const tarjeta = (p) => {
      const img = p.imagen
        ? `<img class="prod-img" src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy">`
        : `<div class="prod-img sin-foto" aria-hidden="true">✿</div>`;
      const boton = !p.disponible
        ? `<span class="etiqueta agotado">Sin stock</span>`
        : numeroWA()
          ? `<a class="btn-wa" target="_blank" rel="noopener" href="${linkWA(`¡Hola! Me interesa "${p.nombre}" del catálogo ${cat.nombre} (${precioTexto(p.precio)}).`)}">Pedir por WhatsApp</a>`
          : "";
      return `
        <article class="prod${p.disponible ? "" : " no-disp"}">
          ${img}
          <div class="prod-cuerpo">
            <h3>${esc(p.nombre)}</h3>
            ${p.descripcion ? `<p class="prod-desc">${esc(p.descripcion)}</p>` : ""}
            <div class="prod-pie"><span class="precio">${esc(precioTexto(p.precio))}</span>${boton}</div>
          </div>
        </article>`;
    };

    const dibujar = () => {
      const q = norm(busqueda);
      const visibles = prods.filter((p) =>
        (!filtro || p.categoria === filtro) &&
        (!q || norm(p.nombre + " " + p.descripcion + " " + p.categoria).includes(q)));
      if (!visibles.length) {
        lista.innerHTML = `<p class="vacio">${prods.length ? "No encontramos productos con esa búsqueda." : "Este catálogo todavía no tiene productos."}</p>`;
        return;
      }
      // Agrupar por categoría cuando se ve "Todo"
      if (!filtro && categorias.length > 1 && !q) {
        const grupos = [...categorias, ""].map((c) => [c, visibles.filter((p) => p.categoria === c)]).filter(([, ps]) => ps.length);
        lista.innerHTML = grupos.map(([c, ps]) =>
          `${c ? `<h2 class="seccion">${esc(c)}</h2>` : `<h2 class="seccion">Otros</h2>`}<div class="productos">${ps.map(tarjeta).join("")}</div>`).join("");
      } else {
        lista.innerHTML = `<div class="productos">${visibles.map(tarjeta).join("")}</div>`;
      }
    };

    app.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
      filtro = b.dataset.cat;
      app.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      dibujar();
    }));
    const buscador = app.querySelector(".buscador");
    if (buscador) buscador.addEventListener("input", () => { busqueda = buscador.value; dibujar(); });

    dibujar();
    window.scrollTo(0, 0);
  }

  // Foto ampliada al tocar una imagen de producto
  app.addEventListener("click", (e) => {
    const img = e.target.closest("img.prod-img");
    if (!img) return;
    const v = document.createElement("div");
    v.className = "visor";
    v.innerHTML = `<img src="${esc(img.src)}" alt="${esc(img.alt)}">`;
    v.addEventListener("click", () => v.remove());
    document.body.appendChild(v);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.querySelector(".visor")?.remove(); });

  // Si una foto no carga, mostrar el ícono en su lugar
  app.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG") return;
    const div = document.createElement("div");
    div.className = img.className + " sin-foto";
    div.textContent = img.classList.contains("cat-img") ? "✿" : "✿";
    img.replaceWith(div);
  }, true);

  window.addEventListener("hashchange", render);
  cargar();
})();
