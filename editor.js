/* ==========================================================================
   SOFIBÉL · editor.js — modo operador
   --------------------------------------------------------------------------
   Se entra con  .../sofibel/#editar  (o ?editar). El sitio normal no carga
   este archivo, así que ninguna clienta paga un byte por él.

   CÓMO ESTÁ PENSADO

   GitHub Pages es estático: no hay servidor donde guardar. Entonces el editor
   escribe de vuelta al repositorio, y hay una decisión que sostiene todo:

     NO se serializa el DOM vivo. Se pide el index.html ORIGINAL, se parsea
     aparte, y los cambios se aplican sobre ESA copia limpia.

   Motivo: app.js le mete cosas a la página que no van en el archivo (los
   corazones, la segunda foto del hover, el contenido de la ficha, los chips de
   filtro) y le quita otras (el data-src de cada imagen, que cambia por src al
   cargarla). Si se guardara el DOM vivo, todo eso se congelaría dentro del
   HTML y el sitio publicado quedaría roto y pesado. Con la copia limpia, lo
   que se publica es el archivo de verdad más las ediciones, y nada más.

   QUÉ VA A DÓNDE
     textos, colores, secciones, foto de portada  ->  index.html
     catálogo (orden, fotos, nombre, precio, talla) ->  data/vestidos.json
                                                       y las tarjetas del HTML

   Lo segundo importa: el catálogo del HTML lo genera tools/render_html.py a
   partir del JSON. Si solo se tocara el HTML, la próxima corrida del script
   borraría los cambios. Por eso se escriben los dos.
   ========================================================================== */
'use strict';

(function () {

/* ------------------------------------------------------------- 1. ajustes */
const REPO = { duenio: 'cmartinezdj', nombre: 'sofibel', rama: 'main' };

/* Los tokens que tiene sentido que mueva un operador. El resto del sistema de
   color se queda quieto a propósito: cambiarlos todos rompe los contrastes. */
const COLORES = [
  ['--papel',      'Fondo de la página'],
  ['--tarjeta',    'Fondo de las bandas'],
  ['--tinta',      'Texto principal'],
  ['--tinta-suave','Texto secundario'],
  ['--rosa',       'Rosa de relleno'],
  ['--rosa-honda', 'Rosa de botones y enlaces'],
];

const LLAVE_BORRADOR = 'sofibel-editor-borrador';
const LLAVE_TOKEN = 'sofibel-editor-token';

/* --------------------------------------------------------- 2. utilidades */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

let avisoTimer;
function aviso(txt, ms = 2600) {
  let el = $('.ed-aviso');
  if (!el) { el = document.createElement('div'); el.className = 'ed-aviso'; document.body.appendChild(el); }
  el.textContent = txt;
  el.dataset.visible = 'si';
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => { el.dataset.visible = 'no'; }, ms);
}

/** Un elemento cuenta como texto editable si su contenido es solo texto.
 *  Se excluye lo que app.js escribe (contadores, conteos) y lo que no es copy. */
const NO_EDITABLES = new Set(['conteo', 'conteo-hoja', 'cuenta-favoritos',
  'cuenta-favoritos-barra', 'cuenta-notas', 'cajon-titulo', 'cajon-rotulo']);

/* Ojo con lo que se excluye: TIENE que decidirse con selectores estables, nunca
   con atributos que pone el propio editor. Al filtrar por [data-ed-ordena] las
   dos listas jamas coincidian (la copia limpia no lo tiene) y la edicion de
   texto se apagaba sola. */
const FUERA = [
  '.ed-barra', '.ed-panel', '.ed-marca-seccion',   /* piel del editor */
  '#cajon', '#hoja-filtros', '#barra-accion',      /* lo pinta app.js */
  '#conteo', '#conteo-hoja',                       /* contadores vivos */
  '#resumen-cita', '#fichas-elegidas',             /* el formulario los rellena */
  '#hora-cita', '#chips-ocasion',
  '.pieza', '.mosaico', '#rejilla-look',           /* se editan en su panel */
  'script', 'style',
].join(', ');

function esTextoEditable(el) {
  if (!el || NO_EDITABLES.has(el.id)) return false;
  if (el.closest(FUERA)) return false;
  const t = (el.textContent || '').trim();
  if (!t || t.length > 900) return false;
  return el.children.length === 0;
}

const SEL_TEXTO = '.aviso p, main h1, main h2, main h3, main p, main li, main dd, main dt, ' +
                  'main summary, main span, main b, main a, .pie p, .pie a, .pie .lema';

/** Lista determinista de elementos de texto de un documento.
 *  Sirve como llave: la posición i es la misma en la página viva y en la copia
 *  limpia, porque lo que app.js inyecta (corazones, img.reverso) nunca es un
 *  elemento de solo texto y por lo tanto no entra en esta lista. */
function textosDe(doc) {
  return $$(SEL_TEXTO, doc).filter(esTextoEditable);
}

/* ------------------------------------------------------------- 3. estado */
const Ed = {
  activo: false,
  modo: 'texto',            // texto | orden | foto
  origen: null,             // texto del index.html original
  limpio: null,             // Document parseado de ese texto
  datos: null,              // data/vestidos.json original
  cambios: {                // lo que el operador lleva hecho
    textos: {},             // { indice: "texto nuevo" }
    colores: {},            // { "--rosa": "#RRGGBB" }
    ocultas: [],            // ids de secciones apagadas
    orden: {},              // { vestidos: [...ids], lookbook: [...], mosaicos: [...] }
    piezas: {},             // { id: {nombre, precioRenta, precioVenta, tallas, disponible} }
    fotos: {},              // { idPieza: {variantes:[...], nuevas:{ruta:base64}} }
    portada: null,          // {src, srcset} de la foto de portada
  },
  subidas: {},              // { ruta: base64 } de fotos nuevas por publicar
};

function hayCambios() {
  const c = Ed.cambios;
  return Object.keys(c.textos).length || Object.keys(c.colores).length || c.ocultas.length ||
         Object.keys(c.orden).length || Object.keys(c.piezas).length ||
         Object.keys(c.fotos).length || c.portada;
}
function cuentaCambios() {
  const c = Ed.cambios;
  return Object.keys(c.textos).length + Object.keys(c.colores).length + c.ocultas.length +
         Object.keys(c.orden).length + Object.keys(c.piezas).length + Object.keys(c.fotos).length +
         (c.portada ? 1 : 0);
}

function guardaBorrador() {
  try {
    localStorage.setItem(LLAVE_BORRADOR, JSON.stringify({ cambios: Ed.cambios, subidas: Ed.subidas }));
  } catch (e) { aviso('No pude guardar el borrador: el navegador se quedó sin espacio.'); }
  pintaBarra();
}
function cargaBorrador() {
  try {
    const b = JSON.parse(localStorage.getItem(LLAVE_BORRADOR) || 'null');
    if (b && b.cambios) { Ed.cambios = Object.assign(Ed.cambios, b.cambios); Ed.subidas = b.subidas || {}; return true; }
  } catch (e) {}
  return false;
}

/* --------------------------------------------------------- 4. arranque */
async function arranca() {
  document.documentElement.classList.add('modo-editor');
  montaBarra();
  try {
    const [htm, dat] = await Promise.all([
      fetch('index.html', { cache: 'no-store' }).then((r) => r.text()),
      fetch('data/vestidos.json', { cache: 'no-store' }).then((r) => r.json()),
    ]);
    Ed.origen = htm;
    Ed.limpio = new DOMParser().parseFromString(htm, 'text/html');
    Ed.datos = dat;
  } catch (e) {
    aviso('No pude leer el sitio original. Recarga la página.', 6000);
    return;
  }
  /* gancho de diagnostico: si algo se comporta raro, window.__ed lo dice todo */
  window.__ed = Ed;
  Ed.construyeHTML = () => construyeHTML();
  Ed.construyeDatos = () => construyeDatos();
  Ed.revisa = (h) => revisa(h);
  const listaVivo = textosDe(document), listaLimpio = textosDe(Ed.limpio);
  const nVivo = listaVivo.length, nLimpio = listaLimpio.length;
  Ed.diag = { nVivo, nLimpio, vivo: listaVivo.map((e) => e.tagName + '|' + (e.textContent || '').trim().slice(0, 30)),
              limpio: listaLimpio.map((e) => e.tagName + '|' + (e.textContent || '').trim().slice(0, 30)) };
  if (nVivo !== nLimpio) {
    console.warn('[editor] textos vivo=%d limpio=%d', nVivo, nLimpio);
    /* Si las dos listas no coinciden, las llaves de texto no serían de fiar y
       una edición podría caer en el párrafo equivocado. Mejor no editar texto. */
    aviso(`La página viva y el archivo no coinciden (${nVivo} contra ${nLimpio}). ` +
          'La edición de texto queda apagada por seguridad; lo demás sí funciona.', 9000);
    Ed.textoSeguro = false;
  } else {
    Ed.textoSeguro = true;
  }

  marcaEditables();
  if (cargaBorrador()) { aplicaCambiosEnVivo(); aviso('Retomé tu borrador guardado.'); }
  Ed.activo = true;
  pintaBarra();
}

/* ------------------------------------------------- 5. marcar lo editable */
function marcaEditables() {
  if (Ed.textoSeguro) {
    textosDe(document).forEach((el, i) => { el.dataset.edTexto = String(i); });
  }
  /* fotos: portada, mosaicos y tarjetas del catálogo */
  const foto = $('.portada-foto');
  if (foto) marcaFoto(foto, { tipo: 'portada' });
  $$('#rejilla-vestidos .pieza, #riel-accesorios .pieza').forEach((p) => {
    const caja = $('.pieza-foto', p);
    if (caja) marcaFoto(caja, { tipo: 'pieza', id: p.dataset.id });
  });
  /* orden: catálogo, mosaicos y lookbook */
  const rej = $('#rejilla-vestidos'); if (rej) rej.dataset.edOrdena = 'vestidos';
  const mos = $('.mosaicos'); if (mos) mos.dataset.edOrdena = 'mosaicos';
  const look = $('#rejilla-look'); if (look) look.dataset.edOrdena = 'lookbook';
  /* secciones: se les pone su etiqueta de ocultar */
  $$('main > section[id], .pie').forEach((s) => {
    const id = s.id || 'pie';
    const m = document.createElement('div');
    m.className = 'ed-marca-seccion';
    m.innerHTML = `<span>${id}</span> <button type="button" data-ed-oculta="${id}">ocultar</button>`;
    s.appendChild(m);
  });
}

function marcaFoto(caja, info) {
  caja.classList.add('ed-foto');
  Object.assign(caja.dataset, { edFoto: info.tipo, edFotoId: info.id || '' });
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ed-cambiar-foto';
  b.textContent = 'Cambiar foto';
  caja.appendChild(b);
}

/* -------------------------------------------------------------- 6. barra */
function montaBarra() {
  const barra = document.createElement('div');
  barra.className = 'ed-barra';
  barra.innerHTML = `
    <div class="ed-marca"><i class="ed-punto"></i><span>SOFIBÉL · editor</span></div>
    <button class="ed-btn" data-ed-modo="texto" aria-pressed="true">Textos</button>
    <button class="ed-btn" data-ed-modo="orden" aria-pressed="false">Mover</button>
    <button class="ed-btn" data-ed-panel="colores">Colores</button>
    <button class="ed-btn" data-ed-panel="catalogo">Catálogo</button>
    <span class="ed-crece"></span>
    <span class="ed-cuenta" id="ed-cuenta" hidden>0</span>
    <button class="ed-btn" data-ed-accion="deshacer">Descartar</button>
    <button class="ed-btn" data-ed-accion="descargar">Descargar</button>
    <button class="ed-btn ed-btn-fuerte" data-ed-accion="publicar">Publicar</button>
    <button class="ed-btn" data-ed-accion="salir">Salir</button>`;
  document.body.appendChild(barra);

  const panel = document.createElement('aside');
  panel.className = 'ed-panel';
  panel.id = 'ed-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="ed-panel-cab"><span id="ed-panel-t">Panel</span>
      <button class="ed-cerrar" type="button" data-ed-cierra aria-label="Cerrar">&times;</button></div>
    <div class="ed-panel-cuerpo" id="ed-panel-cuerpo"></div>
    <div class="ed-panel-pie" id="ed-panel-pie"></div>`;
  document.body.appendChild(panel);
}

function pintaBarra() {
  const n = cuentaCambios();
  const c = $('#ed-cuenta');
  if (c) { c.textContent = n; c.hidden = n === 0; }
  $$('[data-ed-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.edModo === Ed.modo)));
}

function abrePanel(titulo, cuerpo, pie) {
  $('#ed-panel-t').textContent = titulo;
  $('#ed-panel-cuerpo').innerHTML = cuerpo;
  $('#ed-panel-pie').innerHTML = pie || '';
  $('#ed-panel').hidden = false;
}
const cierraPanel = () => { $('#ed-panel').hidden = true; };

/* ------------------------------------------------------- 7. modo textos */
function activaTextos(si) {
  $$('[data-ed-texto]').forEach((el) => {
    if (si) {
      el.setAttribute('contenteditable', 'plaintext-only');
      el.spellcheck = false;
    } else {
      el.removeAttribute('contenteditable');
    }
  });
}

document.addEventListener('input', (e) => {
  const el = e.target.closest && e.target.closest('[data-ed-texto][contenteditable]');
  if (!el) return;
  Ed.cambios.textos[el.dataset.edTexto] = el.textContent;
  el.dataset.edTocado = 'si';
  guardaBorrador();
});

/* Enter no debe meter saltos en un titular */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.closest && e.target.closest('[data-ed-texto][contenteditable]')) {
    e.preventDefault(); e.target.blur();
  }
  if (e.key === 'Escape' && !$('#ed-panel').hidden) cierraPanel();
}, true);

/* -------------------------------------------------------- 8. modo mover */
let arrastrado = null;
function activaOrden(si) {
  $$('[data-ed-ordena] > *').forEach((el) => {
    if (si) el.setAttribute('draggable', 'true');
    else el.removeAttribute('draggable');
  });
}
document.addEventListener('dragstart', (e) => {
  const el = e.target.closest && e.target.closest('[data-ed-ordena] > *');
  if (!el || Ed.modo !== 'orden') return;
  arrastrado = el;
  el.classList.add('ed-arrastrando');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', ''); } catch (err) {}
});
document.addEventListener('dragover', (e) => {
  if (!arrastrado) return;
  const sobre = e.target.closest && e.target.closest('[data-ed-ordena] > *');
  if (!sobre || sobre === arrastrado) return;
  if (sobre.parentElement !== arrastrado.parentElement) return;
  e.preventDefault();
  $$('.ed-blanco').forEach((x) => x.classList.remove('ed-blanco'));
  sobre.classList.add('ed-blanco');
  const r = sobre.getBoundingClientRect();
  const despues = (e.clientY - r.top) > r.height / 2;
  sobre.parentElement.insertBefore(arrastrado, despues ? sobre.nextSibling : sobre);
});
document.addEventListener('dragend', () => {
  if (!arrastrado) return;
  arrastrado.classList.remove('ed-arrastrando');
  $$('.ed-blanco').forEach((x) => x.classList.remove('ed-blanco'));
  const cont = arrastrado.parentElement;
  const cual = cont.dataset.edOrdena;
  Ed.cambios.orden[cual] = Array.from(cont.children)
    .filter((x) => !x.classList.contains('ed-marca-seccion'))
    .map((x) => llaveDe(x, cual));
  arrastrado = null;
  guardaBorrador();
  aviso('Orden guardado en el borrador.');
});

function llaveDe(el, cual) {
  if (cual === 'vestidos') return el.dataset.id || '';
  if (cual === 'mosaicos') return el.dataset.filtra || '';
  return String(Array.prototype.indexOf.call(el.parentElement.children, el));
}

/* -------------------------------------------------------- 9. colores */
function panelColores() {
  const raiz = getComputedStyle(document.documentElement);
  const filas = COLORES.map(([tok, etiqueta]) => {
    const actual = (Ed.cambios.colores[tok] || raiz.getPropertyValue(tok)).trim();
    return `<div class="ed-campo">
      <label>${etiqueta}</label>
      <div class="ed-color">
        <input type="color" value="${aHex(actual)}" data-ed-color="${tok}">
        <code>${tok}</code>
        <button class="ed-btn" type="button" data-ed-color-reset="${tok}">Original</button>
      </div></div>`;
  }).join('');
  abrePanel('Colores', `
    <div class="ed-nota"><span>!</span><span>El rosa de relleno nunca lleva texto encima:
      es muy claro y no alcanza el contraste mínimo. Para botones y enlaces usa el rosa de botones.</span></div>
    ${filas}
    <div class="ed-ayuda">Los cambios se ven al momento. Se publican con el botón verde.</div>`);
}

function aHex(v) {
  v = (v || '').trim();
  if (v.startsWith('#')) return v.length === 4
    ? '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3] : v.slice(0, 7);
  const m = v.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return '#000000';
  return '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('');
}

function aplicaColor(tok, val) {
  Ed.cambios.colores[tok] = val;
  document.documentElement.style.setProperty(tok, val);
  guardaBorrador();
}

/* ------------------------------------------------------ 10. catálogo */
function panelCatalogo() {
  const items = (Ed.datos.vestidos || []).concat(Ed.datos.accesorios || []);
  const ops = items.map((p) => `<option value="${p.id}">${p.nombre}</option>`).join('');
  abrePanel('Catálogo', `
    <div class="ed-campo"><label>Pieza</label>
      <select id="ed-pieza">${ops}</select></div>
    <div id="ed-pieza-campos"></div>`);
  $('#ed-pieza').addEventListener('change', (e) => pintaPieza(e.target.value));
  pintaPieza(items[0] && items[0].id);
}

function pieza(id) {
  return (Ed.datos.vestidos || []).concat(Ed.datos.accesorios || []).find((p) => p.id === id);
}

function pintaPieza(id) {
  const p = pieza(id);
  if (!p) return;
  const c = Ed.cambios.piezas[id] || {};
  const v = (k) => (c[k] !== undefined ? c[k] : (p[k] === null || p[k] === undefined ? '' : p[k]));
  $('#ed-pieza-campos').innerHTML = `
    <div class="ed-campo"><label>Nombre</label>
      <input type="text" data-ed-pieza="${id}" data-campo="nombre" value="${String(v('nombre')).replace(/"/g, '&quot;')}"></div>
    <div class="ed-fila">
      <div class="ed-campo"><label>Renta $</label>
        <input type="number" min="0" step="10" data-ed-pieza="${id}" data-campo="precioRenta" value="${v('precioRenta')}" placeholder="sin precio"></div>
      <div class="ed-campo"><label>Venta $</label>
        <input type="number" min="0" step="10" data-ed-pieza="${id}" data-campo="precioVenta" value="${v('precioVenta')}" placeholder="sin precio"></div>
    </div>
    <div class="ed-campo"><label>Tallas</label>
      <input type="text" data-ed-pieza="${id}" data-campo="tallas" value="${String(v('tallas')).replace(/"/g, '&quot;')}" placeholder="por ejemplo: 5, 7 y 9 (MX)"></div>
    <div class="ed-ayuda">Deja el precio vacío y la tarjeta sigue diciendo
      "Precio por WhatsApp". En cuanto pongas un número, lo muestra sola.</div>`;
}

document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.dataset || !el.dataset.edPieza) return;
  const id = el.dataset.edPieza, campo = el.dataset.campo;
  Ed.cambios.piezas[id] = Ed.cambios.piezas[id] || {};
  let val = el.value.trim();
  if (campo === 'precioRenta' || campo === 'precioVenta') val = val === '' ? null : Number(val);
  Ed.cambios.piezas[id][campo] = val === '' ? null : val;
  aplicaPiezaEnVivo(id);
  guardaBorrador();
});

function aplicaPiezaEnVivo(id) {
  const art = $(`.pieza[data-id="${CSS.escape(id)}"]`);
  if (!art) return;
  const c = Ed.cambios.piezas[id] || {};
  if (c.nombre) { const n = $('.nombre', art); if (n) n.textContent = c.nombre; }
  const pie = $('.pieza-pie', art);
  if (!pie) return;
  const viejo = $('.precio, .sin-precio', pie);
  if (!viejo) return;
  if (c.precioRenta) {
    viejo.className = 'precio num';
    viejo.textContent = 'Renta $' + Number(c.precioRenta).toLocaleString('es-MX');
  } else if (c.precioRenta === null) {
    viejo.className = 'sin-precio';
    viejo.textContent = 'Precio por WhatsApp';
  }
}

/* ---------------------------------------------------------- 11. fotos */
let fotoActual = null;
function panelFoto(caja) {
  fotoActual = caja;
  const esPortada = caja.dataset.edFoto === 'portada';
  const pool = poolDeFotos();
  const g = pool.map((src) => `<button type="button" data-ed-elige="${src}">
      <img src="${src}" alt="" loading="lazy"></button>`).join('');
  abrePanel(esPortada ? 'Foto de portada' : 'Foto de la pieza', `
    <div class="ed-campo"><label>Subir una foto nueva</label>
      <input type="file" accept="image/*" id="ed-subir">
      <span class="ed-ayuda">Se recorta a 2:3 y se guarda en tres tamaños. Queda lista para publicar.</span></div>
    <div class="ed-sep"></div>
    <p class="ed-titulo">O elige una que ya está en el sitio</p>
    <div class="ed-galeria">${g}</div>`);
  $('#ed-subir').addEventListener('change', (e) => subeFoto(e.target.files[0]));
}

function poolDeFotos() {
  const set = new Set();
  (Ed.datos.vestidos || []).concat(Ed.datos.accesorios || []).forEach((p) => {
    (p.fotos || []).forEach((f) => {
      const v = (f.variantes || [])[0];
      if (v) set.add(v.src);
    });
  });
  (Ed.datos.lookbook || []).forEach((l) => {
    const v = (l.variantes || [])[0]; if (v) set.add(v.src);
  });
  return Array.from(set);
}

/** Recorta a 2:3 y exporta tres anchos en webp, todo en el navegador. */
function subeFoto(file) {
  if (!file) return;
  if (!/^image\//.test(file.type)) { aviso('Eso no es una imagen.'); return; }
  const img = new Image();
  img.onload = async () => {
    const RATIO = 2 / 3;
    let nw, nh;
    if (img.width / img.height > RATIO) { nh = img.height; nw = Math.round(nh * RATIO); }
    else { nw = img.width; nh = Math.round(nw / RATIO); }
    const sx = Math.round((img.width - nw) / 2);
    const sy = Math.round((img.height - nh) * 0.28);   /* un poco arriba del centro */
    const base = 'subida-' + Date.now();
    const variantes = [];
    for (const a of [420, 720, 1080]) {
      if (a > nw * 1.06 && a !== 420) continue;
      const cv = document.createElement('canvas');
      cv.width = a; cv.height = Math.round(a / RATIO);
      cv.getContext('2d').drawImage(img, sx, sy, nw, nh, 0, 0, cv.width, cv.height);
      const b64 = cv.toDataURL('image/webp', 0.82).split(',')[1];
      const ruta = `images/vestidos/${base}-${a}.webp`;
      Ed.subidas[ruta] = b64;
      variantes.push({ w: a, src: ruta });
    }
    guardaFoto(variantes, true);
    aviso('Foto lista. Se sube cuando publiques.');
  };
  img.onerror = () => aviso('No pude leer esa imagen.');
  img.src = URL.createObjectURL(file);
}

function guardaFoto(variantes, esNueva) {
  const caja = fotoActual;
  if (!caja) return;
  const grande = variantes[variantes.length - 1];
  const srcset = variantes.map((v) => `${v.src} ${v.w}w`).join(', ');
  const im = $('img', caja);
  if (im) {
    /* en vivo se pone src para verla; al publicar se restituye data-src */
    im.src = esNueva ? 'data:image/webp;base64,' + Ed.subidas[grande.src] : grande.src;
    im.removeAttribute('srcset');
  }
  if (caja.dataset.edFoto === 'portada') {
    Ed.cambios.portada = { src: grande.src, srcset, variantes };
  } else {
    Ed.cambios.fotos[caja.dataset.edFotoId] = { variantes };
  }
  guardaBorrador();
  cierraPanel();
}

/* --------------------------------------------- 12. aplicar el borrador */
function aplicaCambiosEnVivo() {
  const c = Ed.cambios;
  if (Ed.textoSeguro) {
    /* Por atributo, no recalculando la lista: para este momento ya existe
       data-ed-ordena y el filtro devolveria otros indices, con lo que un texto
       caeria en el parrafo equivocado. */
    Object.entries(c.textos).forEach(([i, txt]) => {
      const el = $(`[data-ed-texto="${i}"]`);
      if (el) { el.textContent = txt; el.dataset.edTocado = 'si'; }
    });
  }
  Object.entries(c.colores).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  c.ocultas.forEach((id) => {
    const s = id === 'pie' ? $('.pie') : document.getElementById(id);
    if (s) s.dataset.edOculto = 'si';
  });
  Object.keys(c.piezas).forEach(aplicaPiezaEnVivo);
  Object.entries(c.orden).forEach(([cual, llaves]) => {
    const cont = $(`[data-ed-ordena="${cual}"]`);
    if (!cont) return;
    llaves.forEach((k) => {
      const el = cual === 'vestidos' ? $(`.pieza[data-id="${CSS.escape(k)}"]`, cont)
               : cual === 'mosaicos' ? $(`[data-filtra="${CSS.escape(k)}"]`, cont)
               : null;
      if (el) cont.appendChild(el);
    });
  });
}

/* --------------------------------- 13. construir los archivos a publicar */
function construyeHTML() {
  const doc = Ed.limpio.cloneNode(true);
  const c = Ed.cambios;

  if (Ed.textoSeguro) {
    const lista = textosDe(doc);
    Object.entries(c.textos).forEach(([i, txt]) => {
      const el = lista[Number(i)];
      if (el) el.textContent = txt;
    });
  }

  if (Object.keys(c.colores).length) {
    let st = doc.getElementById('ed-colores');
    if (!st) {
      st = doc.createElement('style');
      st.id = 'ed-colores';
      doc.head.appendChild(st);
    }
    const cuerpo = Object.entries(c.colores).map(([k, v]) => `  ${k}: ${v};`).join('\n');
    st.textContent = `\n/* Colores puestos desde el editor. */\n:root {\n${cuerpo}\n}\n`;
  }

  c.ocultas.forEach((id) => {
    const s = id === 'pie' ? doc.querySelector('.pie') : doc.getElementById(id);
    if (s) s.setAttribute('hidden', '');
  });

  if (c.portada) {
    const im = doc.querySelector('.portada-foto img');
    if (im) { im.setAttribute('src', c.portada.src); im.setAttribute('srcset', c.portada.srcset); }
  }

  /* catálogo: se reordenan y se actualizan las tarjetas del HTML */
  Object.entries(c.orden).forEach(([cual, llaves]) => {
    const cont = cual === 'vestidos' ? doc.querySelector('#rejilla-vestidos')
               : cual === 'mosaicos' ? doc.querySelector('.mosaicos')
               : doc.querySelector('#rejilla-look');
    if (!cont) return;
    llaves.forEach((k) => {
      const el = cual === 'vestidos' ? cont.querySelector(`.pieza[data-id="${CSS.escape(k)}"]`)
               : cual === 'mosaicos' ? cont.querySelector(`[data-filtra="${CSS.escape(k)}"]`)
               : null;
      if (el) cont.appendChild(el);
    });
  });

  Object.entries(c.piezas).forEach(([id, campos]) => {
    const art = doc.querySelector(`.pieza[data-id="${CSS.escape(id)}"]`);
    if (!art) return;
    if (campos.nombre) { const n = art.querySelector('.nombre'); if (n) n.textContent = campos.nombre; }
    const p = art.querySelector('.precio, .sin-precio');
    if (p) {
      if (campos.precioRenta) {
        p.className = 'precio num';
        p.textContent = 'Renta $' + Number(campos.precioRenta).toLocaleString('es-MX');
      } else if (campos.precioRenta === null) {
        p.className = 'sin-precio';
        p.textContent = 'Precio por WhatsApp';
      }
    }
  });

  Object.entries(c.fotos).forEach(([id, f]) => {
    const art = doc.querySelector(`.pieza[data-id="${CSS.escape(id)}"]`);
    if (!art) return;
    const im = art.querySelector('.pieza-foto img');
    if (!im) return;
    const grande = f.variantes[f.variantes.length - 1];
    /* data-src y no src: así sigue difiriéndose la carga, como en el resto */
    im.setAttribute('data-src', grande.src);
    im.setAttribute('data-srcset', f.variantes.map((v) => `${v.src} ${v.w}w`).join(', '));
    im.removeAttribute('src'); im.removeAttribute('srcset');
  });

  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML + '\n';
}

function construyeDatos() {
  const d = JSON.parse(JSON.stringify(Ed.datos));
  const c = Ed.cambios;
  Object.entries(c.piezas).forEach(([id, campos]) => {
    ['vestidos', 'accesorios'].forEach((g) => {
      const p = (d[g] || []).find((x) => x.id === id);
      if (p) Object.assign(p, campos);
    });
  });
  Object.entries(c.fotos).forEach(([id, f]) => {
    ['vestidos', 'accesorios'].forEach((g) => {
      const p = (d[g] || []).find((x) => x.id === id);
      if (p && p.fotos && p.fotos[0]) p.fotos[0].variantes = f.variantes;
    });
  });
  if (c.orden.vestidos) {
    const pos = {};
    c.orden.vestidos.forEach((id, i) => { pos[id] = i; });
    d.vestidos.sort((a, b) => (pos[a.id] ?? 999) - (pos[b.id] ?? 999));
  }
  if (c.orden.mosaicos && d.mosaicos) {
    const pos = {};
    c.orden.mosaicos.forEach((oc, i) => { pos[oc] = i; });
    d.mosaicos.sort((a, b) => (pos[a.ocasion] ?? 999) - (pos[b.ocasion] ?? 999));
  }
  return JSON.stringify(d, null, 1);
}

/** Antes de publicar: revisar que el HTML no salió mutilado. */
function revisa(html) {
  const faltas = [];
  const debe = ['<!--CATALOGO-->', '<!--/CATALOGO-->', '<!--MOSAICOS-->', '<!--LOOKBOOK-->',
                'id="datos-sofibel"', 'src="app.js"', 'href="styles.css"', '<symbol id="i-heart"'];
  debe.forEach((t) => { if (html.indexOf(t) === -1) faltas.push(t); });
  const piezas = (html.match(/class="pieza"/g) || []).length;
  if (piezas < 30) faltas.push(`solo ${piezas} piezas en la rejilla`);
  if (html.indexOf('ed-barra') !== -1) faltas.push('quedó la barra del editor dentro');
  if (html.indexOf('contenteditable') !== -1) faltas.push('quedó un contenteditable dentro');
  if (html.indexOf('data-ed-') !== -1) faltas.push('quedaron marcas del editor dentro');
  return faltas;
}

/* --------------------------------------------------------- 14. publicar */
function guardaToken(t, recordar) {
  try { (recordar ? localStorage : sessionStorage).setItem(LLAVE_TOKEN, t); } catch (e) {}
}
function leeToken() {
  try { return sessionStorage.getItem(LLAVE_TOKEN) || localStorage.getItem(LLAVE_TOKEN) || ''; }
  catch (e) { return ''; }
}

function panelPublicar() {
  const html = construyeHTML();
  const faltas = revisa(html);
  const n = cuentaCambios();
  const tok = leeToken();
  const listaSubidas = Object.keys(Ed.subidas);

  if (faltas.length) {
    abrePanel('Publicar', `<div class="ed-nota ed-mal"><span>✕</span><span>
      <b>No publico así.</b> La revisión encontró esto:<br>${faltas.map((f) => '· ' + f).join('<br>')}
      <br><br>Recarga la página y vuelve a intentar. Si sigue, avísame.</span></div>`);
    return;
  }

  abrePanel('Publicar', `
    <div class="ed-nota ed-bien"><span>✓</span><span>${n} cambio${n === 1 ? '' : 's'} listo${n === 1 ? '' : 's'}.
      El HTML pasó la revisión${listaSubidas.length ? ` y hay ${listaSubidas.length / 3 | 0} foto(s) nueva(s)` : ''}.</span></div>
    <div class="ed-campo"><label>Token de GitHub</label>
      <input type="password" id="ed-token" value="${tok}" placeholder="github_pat_...">
      <span class="ed-ayuda">Token de <b>acceso preciso</b>, solo para el repositorio
        <code>${REPO.duenio}/${REPO.nombre}</code>, con permiso <b>Contents: Read and write</b>.
        Se queda en tu navegador y nunca sale hacia otro lado que GitHub.</span></div>
    <label class="ed-ayuda"><input type="checkbox" id="ed-recordar"> Recordarlo en este dispositivo</label>
    <div class="ed-nota"><span>!</span><span>Un token guardado da acceso de escritura al
      repositorio desde este navegador. Si es una computadora compartida, no lo recuerdes.</span></div>`,
    `<button class="ed-btn" type="button" data-ed-cierra>Cancelar</button>
     <button class="ed-btn ed-btn-fuerte" type="button" id="ed-publicar-ya">Publicar ahora</button>`);

  $('#ed-publicar-ya').addEventListener('click', () => publica($('#ed-token').value.trim(), $('#ed-recordar').checked));
}

async function gh(ruta, token, opciones) {
  const r = await fetch(`https://api.github.com${ruta}`, Object.assign({
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  }, opciones || {}));
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GitHub respondió ${r.status}: ${t.slice(0, 180)}`);
  }
  return r.json();
}

const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

/** Un solo commit con todos los archivos, usando la API de Git.
 *  Se hace así y no archivo por archivo para que el sitio nunca quede a medias. */
async function publica(token, recordar) {
  if (!token) { aviso('Falta el token.'); return; }
  const boton = $('#ed-publicar-ya');
  boton.disabled = true; boton.textContent = 'Publicando...';
  const base = `/repos/${REPO.duenio}/${REPO.nombre}`;
  try {
    const ref = await gh(`${base}/git/ref/heads/${REPO.rama}`, token);
    const commitBase = await gh(`${base}/git/commits/${ref.object.sha}`, token);

    const archivos = [
      { path: 'index.html', content: construyeHTML(), binario: false },
      { path: 'data/vestidos.json', content: construyeDatos(), binario: false },
    ];
    Object.entries(Ed.subidas).forEach(([ruta, datos]) => {
      archivos.push({ path: ruta, content: datos, binario: true });
    });

    const arbol = [];
    for (const a of archivos) {
      const blob = await gh(`${base}/git/blobs`, token, {
        method: 'POST',
        body: JSON.stringify({ content: a.binario ? a.content : b64(a.content), encoding: 'base64' }),
      });
      arbol.push({ path: a.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    const tree = await gh(`${base}/git/trees`, token, {
      method: 'POST',
      body: JSON.stringify({ base_tree: commitBase.tree.sha, tree: arbol }),
    });
    const commit = await gh(`${base}/git/commits`, token, {
      method: 'POST',
      body: JSON.stringify({
        message: `Edicion desde el editor: ${cuentaCambios()} cambio(s)`,
        tree: tree.sha, parents: [ref.object.sha],
      }),
    });
    await gh(`${base}/git/refs/heads/${REPO.rama}`, token, {
      method: 'PATCH', body: JSON.stringify({ sha: commit.sha }),
    });

    guardaToken(token, recordar);
    Ed.cambios = { textos: {}, colores: {}, ocultas: [], orden: {}, piezas: {}, fotos: {}, portada: null };
    Ed.subidas = {};
    try { localStorage.removeItem(LLAVE_BORRADOR); } catch (e) {}
    cierraPanel(); pintaBarra();
    aviso('Publicado. GitHub tarda alrededor de un minuto en actualizar el sitio.', 8000);
  } catch (e) {
    abrePanel('Publicar', `<div class="ed-nota ed-mal"><span>✕</span><span>
      <b>No se pudo publicar.</b><br>${String(e.message).replace(/</g, '&lt;')}
      <br><br>Lo más común es que el token no tenga permiso de escritura en
      <code>${REPO.duenio}/${REPO.nombre}</code>, o que ya haya vencido.
      Tus cambios siguen guardados aquí.</span></div>`);
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = 'Publicar ahora'; }
  }
}

/* -------------------------------------------------------- 15. descargar */
function baja(nombre, contenido, tipo) {
  const b = new Blob([contenido], { type: tipo || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function descarga() {
  const faltas = revisa(construyeHTML());
  if (faltas.length) { aviso('La revisión falló: ' + faltas[0]); return; }
  baja('index.html', construyeHTML(), 'text/html;charset=utf-8');
  setTimeout(() => baja('vestidos.json', construyeDatos(), 'application/json'), 500);
  Object.entries(Ed.subidas).forEach(([ruta, datos], i) => {
    setTimeout(() => {
      const bin = atob(datos);
      const arr = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
      baja(ruta.split('/').pop(), new Blob([arr], { type: 'image/webp' }), 'image/webp');
    }, 1000 + i * 400);
  });
  aviso('Descargando. index.html va en la raíz y vestidos.json en la carpeta data.', 7000);
}

/* ----------------------------------------------------------- 16. clics */
document.addEventListener('click', (e) => {
  const t = e.target;

  const modo = t.closest && t.closest('[data-ed-modo]');
  if (modo) {
    Ed.modo = modo.dataset.edModo;
    activaTextos(Ed.modo === 'texto');
    activaOrden(Ed.modo === 'orden');
    pintaBarra();
    aviso(Ed.modo === 'texto' ? 'Toca cualquier texto para cambiarlo.'
                              : 'Arrastra las tarjetas para reordenarlas.');
    return;
  }

  const panel = t.closest && t.closest('[data-ed-panel]');
  if (panel) {
    if (panel.dataset.edPanel === 'colores') panelColores();
    if (panel.dataset.edPanel === 'catalogo') panelCatalogo();
    return;
  }

  if (t.closest && t.closest('[data-ed-cierra]')) { cierraPanel(); return; }

  const oculta = t.closest && t.closest('[data-ed-oculta]');
  if (oculta) {
    e.preventDefault();
    const id = oculta.dataset.edOculta;
    const s = id === 'pie' ? $('.pie') : document.getElementById(id);
    const ya = Ed.cambios.ocultas.indexOf(id);
    if (ya === -1) { Ed.cambios.ocultas.push(id); s.dataset.edOculto = 'si'; oculta.textContent = 'mostrar'; }
    else { Ed.cambios.ocultas.splice(ya, 1); delete s.dataset.edOculto; oculta.textContent = 'ocultar'; }
    guardaBorrador();
    return;
  }

  const cambiar = t.closest && t.closest('.ed-cambiar-foto');
  if (cambiar) { e.preventDefault(); e.stopPropagation(); panelFoto(cambiar.closest('.ed-foto')); return; }

  const elige = t.closest && t.closest('[data-ed-elige]');
  if (elige) {
    const src = elige.dataset.edElige;
    const base = src.replace(/-\d+\.webp$/, '');
    guardaFoto([420, 720, 1080].map((w) => ({ w, src: `${base}-${w}.webp` })), false);
    return;
  }

  const color = t.closest && t.closest('[data-ed-color-reset]');
  if (color) {
    const tok = color.dataset.edColorReset;
    delete Ed.cambios.colores[tok];
    document.documentElement.style.removeProperty(tok);
    guardaBorrador(); panelColores();
    return;
  }

  const acc = t.closest && t.closest('[data-ed-accion]');
  if (acc) {
    const a = acc.dataset.edAccion;
    if (a === 'publicar') panelPublicar();
    if (a === 'descargar') descarga();
    if (a === 'salir') { Ed.activo = false; location.hash = ''; location.reload(); }
    if (a === 'deshacer') {
      if (!hayCambios()) { aviso('No hay nada que descartar.'); return; }
      if (confirm('¿Descartar todos los cambios sin publicar? Esto no se puede deshacer.')) {
        try { localStorage.removeItem(LLAVE_BORRADOR); } catch (err) {}
        Ed.activo = false;
        location.reload();
      }
    }
  }
}, true);

document.addEventListener('change', (e) => {
  const c = e.target.closest && e.target.closest('[data-ed-color]');
  if (c) aplicaColor(c.dataset.edColor, c.value);
});

/* no perder trabajo sin querer */
window.addEventListener('beforeunload', (e) => {
  if (Ed.activo && hayCambios()) { e.preventDefault(); e.returnValue = ''; }
});

/* ------------------------------------------------------------ arranque */
arranca().then(() => {
  activaTextos(true);
  aviso('Modo editor. Toca cualquier texto para cambiarlo.', 4000);
});

})();
