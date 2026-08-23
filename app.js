/* ==========================================================================
   SOFIBÉL · app.js
   Sitio estático, sin dependencias, sin build. Todo corre en el navegador.

   Lo que hay aquí:
     1. CONFIG          lo único que hay que editar para poner el sitio en vivo
     2. utilidades      DOM, escape, fechas
     3. tema            claro / oscuro, recordado en localStorage
     4. navegación      borde al hacer scroll, menú móvil, revelado al entrar
     5. catálogo        render, filtros, favoritos, cajón de ficha
     6. reels           video con poster, uno a la vez
     7. ubicación       mapa diferido, horario de hoy, enlaces de ruta
     8. cita            3 pasos, validación, mensaje de WhatsApp, .ics y GCal
   ========================================================================== */
'use strict';

/* Primera linea util del archivo: le dice al script de arranque que app.js si
   llego y si parseo. Si esto no pasa en 1.8 s, el efecto de entrada se apaga y
   el contenido se ve completo aunque el resto de este archivo falle. */
window.__sofibelVivo = true;

/* ------------------------------------------------------------- 1. CONFIG */
const CONFIG = {
  /* WhatsApp del negocio: 52 + 10 dígitos, SIN el 1 viejo y sin signos.
     Sale de la ficha de Google Business de SOFIBÉL: 55 3763 6800.          */
  wa: '525537636800',

  /* Enlace corto del bio. No acepta mensaje prellenado, así que solo se usa
     para el botón genérico del encabezado.                                  */
  waCorto: 'https://wa.me/message/4CNMLLB56LSBN1',

  /* Respaldo por correo. Sin llave, el formulario funciona igual: solo pierde
     la copia escrita si la clienta no toca "enviar" en WhatsApp.
     Para activarlo: crea una llave gratis en web3forms.com y pégala aquí.
     La llave es pública por diseño; el correo real nunca aparece en el HTML. */
  web3forms: '',

  /* Local. Coordenadas del pin de Google Business. */
  local: {
    nombre: 'SOFIBÉL',
    calle: 'Av. Jesús del Monte 16, local 2',
    colonia: 'Hacienda de las Palmas, Huixquilucan',
    estado: 'Estado de México',
    cp: '52763',
    lat: 19.390715,
    lon: -99.291011,
    plusCode: '9PR5+7H',
  },

  /* Horario publicado en el perfil de Instagram. Google Business dice 10:00:
     hay que alinear los dos. 0 = domingo. */
  horario: {
    0: null,
    1: ['10:30', '19:00'], 2: ['10:30', '19:00'], 3: ['10:30', '19:00'],
    4: ['10:30', '19:00'], 5: ['10:30', '19:00'],
    6: ['10:30', '15:00'],
  },

  duracionCitaMin: 60,
  ultimoSlotAntesDeCerrarMin: 60,
  maxVestidosEnMensaje: 6,
  tzOffset: '-06:00',           // México no aplica horario de verano desde 2022
  tzNombre: 'America/Mexico_City',
};

/* -------------------------------------------------------- 2. utilidades */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2027-03-14" -> "domingo 14 de marzo de 2027" (sin usar zona horaria local) */
function fechaLarga(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIAS[dow]} ${d} de ${MESES[m - 1]} de ${a}`;
}
function diaSemana(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}
function hoyISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}
const aMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Teléfono mexicano: normaliza cualquier formato a 10 dígitos nacionales.
    El orden importa: el 1 después del 52 solo se quita si venían 13 dígitos,
    porque si no, un número de Estados Unidos pasaría como válido.            */
function normalizaTel(v) {
  let d = String(v || '').replace(/\D+/g, '');
  if (d.startsWith('00')) d = d.slice(2);                 // 0052...
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3);        // +52 1 55...
  else if (d.length === 12 && d.startsWith('52')) d = d.slice(2);    // +52 55...
  else if (d.length === 13 && (d.startsWith('044') || d.startsWith('045'))) d = d.slice(3);
  /* Un 1 al inicio NO se quita: "1 415 555 1234" es de Estados Unidos, no un
     formato mexicano, y quitarlo lo colaba como si fuera de aquí. */
  return d;
}
const telValido = (v) => /^[2-9]\d{9}$/.test(normalizaTel(v));
const telBonito = (v) => { const d = normalizaTel(v); return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}` : v; };

const waLink = (texto) => `https://wa.me/${CONFIG.wa}?text=${encodeURIComponent(texto)}`;

/* -------------------------------------------------- 0. aislar los bloques */
/* Cada sección va en su propio try. Si una falla, las demás siguen: antes un
   error en el primer bloque abortaba el archivo completo y la página quedaba
   sin catálogo, sin formulario y con todo el contenido invisible. */
const fallos = [];
function bloque(nombre, fn) {
  try { fn(); } catch (e) {
    fallos.push(nombre + ': ' + (e && e.message ? e.message : e));
    if (window.console) console.error('SOFIBEL, fallo el bloque ' + nombre, e);
    rescate();
  }
}
/* Pase lo que pase, el contenido se ve y hay cómo escribirles. */
function rescate() {
  try {
    document.documentElement.classList.add('revelado-directo');
    const r = document.querySelector('#rejilla-vestidos');
    if (r && !r.children.length) {
      r.innerHTML = '<p style="grid-column:1/-1;color:var(--tinta-suave)">' +
        'No pudimos cargar el catálogo en este navegador. Escríbeles directo por ' +
        '<a href="' + CONFIG.waCorto + '" target="_blank" rel="noopener">WhatsApp</a> ' +
        'y te mandan fotos de lo que tienen.</p>';
    }
  } catch (e) {}
}
window.addEventListener('error', rescate);

/* -------------------------------------------------------------- 3. tema */
bloque('tema', function () {
  const raiz = document.documentElement;
  const btn = $('#cambiar-tema');
  const pinta = () => {
    const oscuro = raiz.dataset.theme
      ? raiz.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    $('.claro-icono', btn).hidden = oscuro;
    $('.oscuro-icono', btn).hidden = !oscuro;
    btn.setAttribute('aria-label', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  };
  btn.addEventListener('click', () => {
    const oscuro = raiz.dataset.theme
      ? raiz.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    raiz.dataset.theme = oscuro ? 'light' : 'dark';
    try { localStorage.setItem('sofibel-tema', raiz.dataset.theme); } catch (e) {}
    pinta();
  });
  const mq = matchMedia('(prefers-color-scheme: dark)');
  /* Safari de iOS 13 y anteriores no tienen addEventListener en MediaQueryList.
     Sin esta comprobación tronaba aquí, en el primer bloque del archivo. */
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', pinta);
  else if (typeof mq.addListener === 'function') mq.addListener(pinta);
  pinta();
});

/* ------------------------------------------------------- 4. navegación */
bloque('nav', function () {
  /* Borde del encabezado solo cuando ya hay contenido debajo. Con un centinela
     y IntersectionObserver, no con un listener de scroll.                    */
  const centinela = document.createElement('div');
  centinela.style.cssText = 'position:absolute;top:0;height:1px;width:1px';
  document.body.prepend(centinela);
  new IntersectionObserver(([e]) => {
    $('#nav').dataset.pegado = e.isIntersecting ? 'no' : 'si';
  }).observe(centinela);

  /* menú móvil */
  const menu = $('#menu-movil'), abrir = $('#abrir-menu');
  const cierra = () => {
    menu.dataset.visible = 'no';
    abrir.setAttribute('aria-expanded', 'false');
    setTimeout(() => { menu.hidden = true; }, 220);
    document.body.dataset.cajon = '';
    abrir.focus();
  };
  abrir.addEventListener('click', () => {
    menu.hidden = false;
    document.body.dataset.cajon = 'abierto';
    void menu.offsetWidth;                       /* mismo motivo que en el cajón */
    menu.dataset.visible = 'si';
    $('#cerrar-menu').focus();
    abrir.setAttribute('aria-expanded', 'true');
  });
  $('#cerrar-menu').addEventListener('click', cierra);
  $$('a', menu).forEach((a) => a.addEventListener('click', cierra));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) cierra(); });

  /* revelado al entrar al encuadre, una sola vez */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ojo = new IntersectionObserver((filas) => {
    filas.forEach((f) => {
      if (!f.isIntersecting) return;
      f.target.dataset.visto = 'si';
      ojo.unobserve(f.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  const revelaTodo = () => {
    /* La clase apaga la transición: si el reloj de animación está congelado
       (pestaña que nunca se mostró, restauración desde caché), la transición
       no avanza y la opacidad se queda en 0 aunque el atributo ya esté puesto.
       Aquí se salta directo al valor final. */
    document.documentElement.classList.add('revelado-directo');
    $$('.revela, .escalona').forEach((el) => { el.dataset.visto = 'si'; });
  };
  const mira = () => $$('.revela:not([data-visto]), .escalona:not([data-visto])')
    .forEach((el) => (reduce ? (el.dataset.visto = 'si') : ojo.observe(el)));
  mira();
  window.sofibelMira = mira;      // el catálogo lo llama cuando pinta piezas

  /* Red de seguridad. Se revisa el RESULTADO, no si el observador corrió: el
     modo de falla real es que sí corra y reporte "nada visible" para siempre
     (pasa cuando el navegador entrega innerHeight en 0, por ejemplo en una
     pestaña que nunca se mostró). Si a los 2.5 s no se reveló ni un bloque,
     estando la portada obviamente a la vista, se revela todo: vale mucho más
     perder la animación que perder el contenido. */
  const red = () => { if (!$('[data-visto="si"]')) revelaTodo(); };
  setTimeout(red, 2500);
  window.addEventListener('pageshow', () => setTimeout(red, 400));
});

/* --------------------------------------------------- 5. catálogo y ficha */
const Tienda = {
  datos: null,
  favoritos: new Set(),
  filtro: { ocasion: '', color: '', largo: '', tela: '', soloFavoritos: false },
};

try {
  const g = JSON.parse(localStorage.getItem('sofibel-favoritos') || '[]');
  if (Array.isArray(g)) g.forEach((x) => Tienda.favoritos.add(x));
} catch (e) {}
const guardaFavoritos = () => {
  try { localStorage.setItem('sofibel-favoritos', JSON.stringify([...Tienda.favoritos])); } catch (e) {}
};

const icono = (n) => `<svg class="icono" aria-hidden="true"><use href="#i-${n}"></use></svg>`;

/** <img> responsivo a partir del arreglo de variantes del JSON.
 *
 *  Por defecto NO trae src: lo pone el observador de Difiere cuando la foto se
 *  acerca. Es a propósito. `loading="lazy"` no sirve aquí porque las 27 tarjetas
 *  se insertan de golpe con innerHTML, antes de que el navegador calcule el
 *  layout: en ese momento las ve todas en pantalla y se bajaba el catálogo
 *  completo de una (5.35 MB, unos 9 segundos en 4G).
 *  `ya: true` es para las primeras fotos, que sí deben pintar de inmediato.
 */
function img(foto, sizes, alt, extra = '', ya = false) {
  const v = foto.variantes;
  const grande = v[v.length - 1];
  const srcset = v.map((x) => `${x.src} ${x.w}w`).join(', ');
  const medidas = `width="${grande.w}" height="${Math.round(grande.w * 1.5)}"`;
  const fuente = ya
    ? `src="${grande.src}" srcset="${srcset}"`
    : `data-src="${grande.src}" data-srcset="${srcset}"`;
  return `<img ${fuente} sizes="${sizes}" ${medidas}
    alt="${esc(alt)}" decoding="async" ${extra}>`;
}

/* ------------------------------------------------- carga diferida de fotos */
const Difiere = {
  ojo: null,
  reporto: false,
  arranca() {
    if (this.ojo) { this.mira(); return; }
    this.ojo = new IntersectionObserver((filas) => {
      this.reporto = true;
      filas.forEach((f) => {
        if (!f.isIntersecting) return;
        this.trae(f.target);
        this.ojo.unobserve(f.target);
      });
    }, { rootMargin: '800px 0px' });   /* holgado: llega antes de que se vea */
    this.mira();
    /* Misma red que en el revelado: si el observador no reporta, las fotos se
       quedarían en blanco para siempre. Se traen todas y ya. */
    setTimeout(() => { if (!this.reporto) this.todas(); }, 3000);
  },
  mira() { $$('img[data-src]').forEach((el) => this.ojo.observe(el)); },
  trae(el) {
    if (el.dataset.srcset) el.srcset = el.dataset.srcset;
    if (el.dataset.src) el.src = el.dataset.src;
    delete el.dataset.src; delete el.dataset.srcset;
  },
  todas() { $$('img[data-src]').forEach((el) => this.trae(el)); },
};

function altDe(p, i = 0) {
  const que = p.tipoItem === 'accesorio' ? p.tipo.toLowerCase() : 'vestido';
  return `${p.nombre}, ${que} ${p.color.toLowerCase()} en renta en SOFIBÉL${i ? ', otra toma' : ''}.`;
}

function tarjeta(p, i = 0) {
  const f1 = p.fotos[0];
  const f2 = p.fotos[1];
  const ya = i < 6;                 /* la primera fila y media, sin esperar */
  const meta = p.tipoItem === 'accesorio'
    ? `${p.tipo} · ${p.color}`
    : `${p.largo} · ${p.tela} · ${p.color}`;
  const precio = p.precioRenta
    ? `<span class="precio num">Renta $${p.precioRenta.toLocaleString('es-MX')}</span>`
    : `<span class="sin-precio">Precio por WhatsApp</span>`;
  return `
  <article class="pieza" data-id="${p.id}"
      data-ocasion="${(p.ocasion || []).join(' ')}" data-color="${esc(p.color)}"
      data-largo="${esc(p.largo || '')}" data-tela="${esc(p.tela || '')}">
    <button class="corazon" type="button" aria-pressed="${Tienda.favoritos.has(p.id)}"
        data-fav="${p.id}" aria-label="Guardar ${esc(p.nombre)} para mi cita">
      ${icono('heart')}<svg class="icono lleno" aria-hidden="true"><use href="#i-heart-fill"></use></svg>
    </button>
    <button class="pieza-boton" type="button" data-abre="${p.id}">
      <span class="pieza-foto">
        ${img(f1, '(min-width:64rem) 20vw, (min-width:40rem) 30vw, 46vw', altDe(p), 'class="frente"', ya)}
        ${f2 ? img(f2, '(min-width:64rem) 20vw, (min-width:40rem) 30vw, 46vw', altDe(p, 1), 'class="reverso"') : ''}
      </span>
      <span class="pieza-pie">
        <span class="nombre">${esc(p.nombre)}</span>
        <span class="meta">${esc(meta)}</span>
        ${precio}
      </span>
    </button>
  </article>`;
}

function pintaChips() {
  const d = Tienda.datos;
  const oc = $('#chips-ocasion');
  oc.innerHTML = `<button class="chip" type="button" aria-pressed="true" data-f="ocasion" data-v="">Todos</button>` +
    d.ocasiones.map((o) => {
      const n = d.vestidos.filter((v) => (v.ocasion || []).includes(o.id)).length;
      return n ? `<button class="chip" type="button" aria-pressed="false" data-f="ocasion" data-v="${o.id}">${esc(o.nombre)}</button>` : '';
    }).join('');

  const colores = [];
  d.vestidos.forEach((v) => { if (!colores.some((c) => c.n === v.color)) colores.push({ n: v.color, hex: v.colorHex }); });
  colores.sort((a, b) => a.n.localeCompare(b.n, 'es'));
  $('#chips-color').innerHTML =
    `<button class="chip" type="button" aria-pressed="true" data-f="color" data-v="">Todos los colores</button>` +
    colores.map((c) => `<button class="chip" type="button" aria-pressed="false" data-f="color" data-v="${esc(c.n)}">
      <span class="punto-color" style="background:${esc(c.hex)}"></span>${esc(c.n)}</button>`).join('');

  const largos = [...new Set(d.vestidos.map((v) => v.largo))].filter(Boolean);
  const telas = [...new Set(d.vestidos.map((v) => v.tela))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
  $('#chips-largo').innerHTML =
    largos.map((l) => `<button class="chip" type="button" aria-pressed="false" data-f="largo" data-v="${esc(l)}">${esc(l)}</button>`).join('') +
    telas.map((t) => `<button class="chip" type="button" aria-pressed="false" data-f="tela" data-v="${esc(t)}">${esc(t)}</button>`).join('') +
    `<button class="chip" type="button" aria-pressed="false" data-f="soloFavoritos" data-v="1">${icono('heart')} Mis favoritos</button>`;
}

function aplicaFiltro() {
  const f = Tienda.filtro;
  let vistos = 0;
  $$('#rejilla-vestidos .pieza').forEach((el) => {
    const ok =
      (!f.ocasion || el.dataset.ocasion.split(' ').includes(f.ocasion)) &&
      (!f.color || el.dataset.color === f.color) &&
      (!f.largo || el.dataset.largo === f.largo) &&
      (!f.tela || el.dataset.tela === f.tela) &&
      (!f.soloFavoritos || Tienda.favoritos.has(el.dataset.id));
    el.hidden = !ok;
    if (ok) vistos++;
  });
  $('#conteo').innerHTML = `<b class="num">${vistos}</b> ${vistos === 1 ? 'vestido' : 'vestidos'}`;
  $('#vacio-filtro').hidden = vistos > 0;
  const activo = f.ocasion || f.color || f.largo || f.tela || f.soloFavoritos;
  $('#limpiar-filtros').hidden = !activo;

  $$('.chip').forEach((c) => {
    const k = c.dataset.f, v = c.dataset.v;
    c.setAttribute('aria-pressed', String(k === 'soloFavoritos' ? f.soloFavoritos : f[k] === v));
  });
}

function limpiaFiltros() {
  Tienda.filtro = { ocasion: '', color: '', largo: '', tela: '', soloFavoritos: false };
  aplicaFiltro();
}

/* -------- favoritos: contador, cinta y fichas del formulario ------------ */
function pintaFavoritos() {
  const n = Tienda.favoritos.size;
  const badge = $('#cuenta-favoritos');
  badge.textContent = n;
  badge.hidden = n === 0;
  $('#cinta-cuenta').textContent = n;
  $('#cinta-favoritos').dataset.visible = n > 0 ? 'si' : 'no';
  $$('[data-fav]').forEach((b) => b.setAttribute('aria-pressed', String(Tienda.favoritos.has(b.dataset.fav))));

  const cont = $('#fichas-elegidas');
  const lista = elegidos();
  cont.innerHTML = lista.map((p) => `<span class="ficha-elegida">${esc(p.nombre)}
    <button type="button" data-quita="${p.id}" aria-label="Quitar ${esc(p.nombre)} de la lista">${icono('x')}</button></span>`).join('');
  $('#ayuda-elegidos').hidden = lista.length > 0;
  if (Tienda.filtro.soloFavoritos) aplicaFiltro();
  pintaResumen();
}
function elegidos() {
  if (!Tienda.datos) return [];
  const todo = [...Tienda.datos.vestidos, ...Tienda.datos.accesorios];
  return [...Tienda.favoritos].map((id) => todo.find((p) => p.id === id)).filter(Boolean);
}
function alternaFavorito(id) {
  Tienda.favoritos.has(id) ? Tienda.favoritos.delete(id) : Tienda.favoritos.add(id);
  guardaFavoritos();
  pintaFavoritos();
}

/* -------------------------- cajón de ficha ----------------------------- */
const Cajon = { abierto: false, disparador: null };

function abreCajon(id, disparador) {
  const d = Tienda.datos;
  const p = [...d.vestidos, ...d.accesorios].find((x) => x.id === id);
  if (!p) return;
  const esAcc = p.tipoItem === 'accesorio';
  const nombresOcasion = (p.ocasion || [])
    .map((o) => (d.ocasiones.find((x) => x.id === o) || {}).nombre).filter(Boolean).join(', ');

  $('#cajon-rotulo').textContent = esAcc ? 'Accesorio' : 'Vestido';
  $('#cajon-cuerpo').innerHTML = `
    <div class="cajon-galeria${esAcc ? ' contenida' : ''}">
      ${p.fotos.map((f, i) => img(f, '(min-width:40rem) 28rem, 92vw', altDe(p, i))).join('')}
    </div>
    <h3 id="cajon-titulo">${esc(p.nombre)}</h3>
    <p style="color:var(--tinta-suave)">${esc(p.detalle)}</p>

    <dl class="ficha-tabla">
      <div><dt>Color</dt><dd>${esc(p.color)}</dd></div>
      ${esAcc ? `<div><dt>Tipo</dt><dd>${esc(p.tipo)}</dd></div>`
              : `<div><dt>Largo</dt><dd>${esc(p.largo)}</dd></div>
                 <div><dt>Tela o detalle</dt><dd>${esc(p.tela)}</dd></div>
                 ${nombresOcasion ? `<div><dt>Va para</dt><dd>${esc(nombresOcasion)}</dd></div>` : ''}`}
      <div><dt>Talla</dt><dd>${p.tallas ? esc(p.tallas) : 'Se ve en el probador. Pregúntala por WhatsApp.'}</dd></div>
      <div><dt>Precio</dt><dd>${p.precioRenta
        ? `Renta <span class="num">$${p.precioRenta.toLocaleString('es-MX')}</span> MXN`
        : 'SOFIBÉL lo cotiza por vestido, por WhatsApp o en tu cita.'}</dd></div>
    </dl>

    <div class="reglas-renta">
      <b>Cómo funciona</b>
      <ul>
        <li>${icono('check')} <span>Agendas cita y te lo pruebas en el probador.</span></li>
        <li>${icono('check')} <span>Los ajustes se hacen en el local.</span></li>
        <li>${icono('check')} <span>El precio, los días de renta y la garantía se cierran en tu cita.</span></li>
      </ul>
    </div>

    <div class="cajon-acciones">
      <button class="btn btn-primario btn-grande" type="button" data-fav-cajon="${p.id}">
        ${icono(Tienda.favoritos.has(p.id) ? 'heart-fill' : 'heart')}
        <span>${Tienda.favoritos.has(p.id) ? 'Ya está en tu lista' : 'Guardar para mi cita'}</span>
      </button>
      <a class="btn btn-secundario" href="${waLink(mensajeVestido(p))}" target="_blank" rel="noopener">
        ${icono('whatsapp-logo')} Preguntar por WhatsApp</a>
      <a class="btn btn-fantasma" href="${esc(p.fotos[0].origen)}" target="_blank" rel="noopener">
        ${icono('instagram-logo')} Ver la publicación original</a>
    </div>`;

  const cajon = $('#cajon'), scrim = $('#scrim');
  Cajon.disparador = disparador || document.activeElement;
  cajon.hidden = false; scrim.hidden = false;
  document.body.dataset.cajon = 'abierto';
  /* Un reflujo forzado, no requestAnimationFrame: rAF no corre en una pestaña
     oculta y el cajón se quedaría fuera de pantalla, presente pero invisible. */
  void cajon.offsetWidth;
  cajon.dataset.visible = 'si'; scrim.dataset.visible = 'si';
  $('#cerrar-cajon').focus();
  Cajon.abierto = true;
}

function cierraCajon() {
  if (!Cajon.abierto) return;
  const cajon = $('#cajon'), scrim = $('#scrim');
  cajon.dataset.visible = 'no'; scrim.dataset.visible = 'no';
  document.body.dataset.cajon = '';
  Cajon.abierto = false;
  setTimeout(() => { cajon.hidden = true; scrim.hidden = true; }, 280);
  if (Cajon.disparador && Cajon.disparador.isConnected) Cajon.disparador.focus();
}

function mensajeVestido(p) {
  return `Hola SOFIBÉL, me interesa el "${p.nombre}" que vi en su página. ¿Me dicen precio y si lo tienen en mi talla?`;
}

/* ----------------------------- render ---------------------------------- */
function pintaCatalogo() {
  const d = Tienda.datos;
  /* El catálogo ya viene escrito en el HTML por tools/render_html.py. Solo se
     pinta desde aquí si por alguna razón no estuviera: así el sitio funciona
     igual con el HTML pre-generado y sin él. */
  const rej = $('#rejilla-vestidos');
  if (!rej.querySelector('.pieza')) {
    rej.innerHTML = d.vestidos.map((p, i) => tarjeta(p, i)).join('');
  }
  const riel = $('#riel-accesorios');
  if (!riel.querySelector('.pieza')) {
    riel.innerHTML = d.accesorios.map((p, i) => tarjeta(p, i + 99)).join('');
  }
  const look = $('#rejilla-look');
  if (!look.querySelector('figure')) {
    look.innerHTML = d.lookbook.map((l, i) => `
      <figure style="--i:${i % 4}">
        <a href="${esc(l.origen)}" target="_blank" rel="noopener" aria-label="Ver esta foto en el Instagram de SOFIBÉL">
          ${img(l, '(min-width:52rem) 23vw, 46vw', l.alt)}
        </a>
      </figure>`).join('');
  }
  pintaChips();
  aplicaFiltro();
  pintaFavoritos();
  Difiere.arranca();
  if (window.sofibelMira) window.sofibelMira();
}

/* ---------------------------- 6. reels --------------------------------- */
function pintaReels(reels) {
  const cont = $('#rejilla-reels');
  if (!cont.querySelector('.reel')) cont.innerHTML = reels.map((r) => `
    <figure class="reel" data-code="${esc(r.code)}" data-mp4="${esc(r.mp4)}">
      <div class="lienzo">
        <img data-src="${esc(r.poster)}" width="720" height="1280" decoding="async" alt="${esc(r.alt)}">
        <!-- El <video> nace SIN <source> y sin poster=, a proposito. Safari no
             siempre respeta preload="none" y se ponia a jalar los seis videos
             (15 MB) al abrir la pagina. El source se agrega al tocar play. -->
        <video muted loop playsinline preload="none"
               aria-label="${esc(r.alt)}"></video>
        <button class="reel-play" type="button" aria-label="Reproducir: ${esc(r.titulo)}">
          <span>${icono('play')}</span></button>
      </div>
      <figcaption>${esc(r.titulo)}</figcaption>
    </figure>`).join('');

  $('#rejilla-reels').addEventListener('click', (e) => {
    const b = e.target.closest('.reel-play');
    if (!b) return;
    const fig = b.closest('.reel');
    const v = $('video', fig);
    /* uno a la vez: el ancho de banda en 4G no aguanta seis */
    $$('.reel[data-jugando="si"]').forEach((otro) => {
      if (otro === fig) return;
      otro.dataset.jugando = 'no';
      $('video', otro).pause();
    });
    if (fig.dataset.jugando === 'si') { v.pause(); fig.dataset.jugando = 'no'; return; }
    /* el archivo se pide aqui, la primera vez que alguien lo toca */
    if (!v.querySelector('source') && fig.dataset.mp4) {
      const s = document.createElement('source');
      s.src = fig.dataset.mp4; s.type = 'video/mp4';
      v.appendChild(s);
      v.load();
    }
    fig.dataset.jugando = 'si';
    v.play().catch(() => { fig.dataset.jugando = 'no'; });
  });

  /* si el reel sale del encuadre, se pausa: no tiene sentido gastar batería */
  const ojo = new IntersectionObserver((filas) => {
    filas.forEach((f) => {
      if (f.isIntersecting) return;
      const fig = f.target;
      if (fig.dataset.jugando === 'si') { $('video', fig).pause(); fig.dataset.jugando = 'no'; }
    });
  }, { threshold: 0.15 });
  $$('.reel').forEach((r) => ojo.observe(r));
}

/* -------------------------- 7. ubicación ------------------------------- */
bloque('ubicacion', function () {
  const L = CONFIG.local;
  const dir = `${L.calle}, ${L.colonia}, ${L.estado}`;
  $('#mapa-google').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(L.nombre + ' ' + dir)}`;
  $('#mapa-waze').href = `https://waze.com/ul?ll=${L.lat},${L.lon}&navigate=yes`;

  const wa = CONFIG.waCorto;
  $('#wa-directo').href = wa;
  $('#tel-wa').href = waLink('Hola SOFIBÉL, quiero preguntar por la renta de un vestido.');
  $('#wa-pie').href = waLink('Hola SOFIBÉL, quiero preguntar por la renta de un vestido.');
  $('#wa-venta').href = waLink('Hola SOFIBÉL, quiero preguntar por los vestidos que tienen en venta.');
  $('#wa-buscar').href = waLink('Hola SOFIBÉL, busco un vestido y no lo vi en su página. ¿Me ayudan a encontrarlo?');

  /* el día de hoy, marcado */
  const hoy = new Date().getDay();
  $$('#horario > div').forEach((d) => {
    if (d.dataset.dia.split(',').map(Number).includes(hoy)) d.classList.add('hoy');
  });

  /* el iframe del mapa se carga cuando la sección se acerca, no antes */
  const marco = $('#osm');
  if (!marco) return;          /* hay versiones del sitio que no llevan mapa */
  const d = 0.004;
  const bbox = [L.lon - d, L.lat - d / 2, L.lon + d, L.lat + d / 2].join('%2C');
  const cargaMapa = () => {
    if (marco.dataset.cargado) return;
    marco.dataset.cargado = 'si';
    marco.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${L.lat}%2C${L.lon}`;
  };
  /* El observador lo trae antes si la clienta llega rápido hasta aquí. */
  const ojo = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    cargaMapa(); ojo.disconnect();
  }, { rootMargin: '400px' });
  ojo.observe(marco);
  /* Y si no, entra igual poco después de load. El mapa está debajo del pliegue,
     así que no compite con el LCP, y así nunca queda un rectángulo muerto. */
  const tras = () => setTimeout(cargaMapa, 1500);
  document.readyState === 'complete' ? tras() : window.addEventListener('load', tras);
});

/* ----------------------------- 8. cita -------------------------------- */
const Cita = { paso: 1, ultimoWa: '' };

function vePaso(n) {
  Cita.paso = n;
  [1, 2, 3].forEach((i) => { $(`#hoja-${i}`).hidden = i !== n; });
  $('#hoja-listo').hidden = true;
  $$('.pasos-cita span').forEach((s, i) => { s.dataset.hecho = i < n ? 'si' : ''; });
  const h = $(`#hoja-${n}`);
  const primero = $('select, input, textarea', h);
  if (primero) primero.focus({ preventScroll: true });
  $('#cita').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

function marcaError(idCampo, hay, mensaje) {
  const campo = $(`#${idCampo}`).closest('.campo');
  const err = $(`#e-${idCampo}`);
  campo.dataset.invalido = hay ? 'si' : '';
  if (err) { err.hidden = !hay; if (hay && mensaje) err.textContent = mensaje; }
  $(`#${idCampo}`).setAttribute('aria-invalid', String(!!hay));
  return !hay;
}

function validaPaso(n) {
  let ok = true;
  if (n === 1) {
    ok = marcaError('tipo-evento', !$('#tipo-evento').value) && ok;
    ok = marcaError('fecha-evento', !$('#fecha-evento').value) && ok;
    ok = marcaError('busco', !$('#busco').value) && ok;
  }
  if (n === 2) {
    const f = $('#fecha-cita').value;
    const malDia = !f || !CONFIG.horario[diaSemana(f)];
    ok = marcaError('fecha-cita', malDia, !f ? 'Elige el día que te acomoda.' : 'Ese día está cerrado. Abren de lunes a sábado.') && ok;
    ok = marcaError('hora-cita', !$('#hora-cita').value) && ok;
  }
  if (n === 3) {
    ok = marcaError('nombre', !$('#nombre').value.trim()) && ok;
    ok = marcaError('telefono', !telValido($('#telefono').value)) && ok;
  }
  if (!ok) {
    const primerMal = $('.campo[data-invalido="si"] input, .campo[data-invalido="si"] select');
    if (primerMal) primerMal.focus();
  }
  return ok;
}

function llenaHoras() {
  const sel = $('#hora-cita');
  const f = $('#fecha-cita').value;
  const rango = f ? CONFIG.horario[diaSemana(f)] : null;
  sel.innerHTML = '';
  if (!f) { sel.innerHTML = '<option value="">Elige primero el día</option>'; return; }
  if (!rango) { sel.innerHTML = '<option value="">Ese día está cerrado</option>'; return; }
  const [abre, cierra] = rango.map(aMin);
  const ultimo = cierra - CONFIG.ultimoSlotAntesDeCerrarMin;
  sel.innerHTML = '<option value="">Elige una hora</option>';
  for (let m = abre; m <= ultimo; m += 30) {
    const h = aHora(m);
    sel.insertAdjacentHTML('beforeend', `<option value="${h}">${h}</option>`);
  }
  $('#ayuda-fecha-cita').textContent =
    `Ese día abren de ${rango[0]} a ${rango[1]}. La última cita empieza a las ${aHora(ultimo)}.`;
}

function pintaResumen() {
  const caja = $('#resumen-cita');
  if (!caja) return;
  const g = (id) => ($(`#${id}`) || {}).value || '';
  const lista = elegidos().slice(0, CONFIG.maxVestidosEnMensaje);
  const filas = [
    ['Evento', g('tipo-evento') && `${g('tipo-evento')}${g('fecha-evento') ? `, ${fechaLarga(g('fecha-evento'))}` : ''}`],
    ['Buscas', g('busco')],
    ['Tu cita', g('fecha-cita') && `${fechaLarga(g('fecha-cita'))}${g('hora-cita') ? ` a las ${g('hora-cita')}` : ''}`],
    ['Talla', g('talla')],
    ['Vestidos', lista.length ? lista.map((p) => p.nombre).join(', ') : ''],
  ].filter(([, v]) => v);
  caja.innerHTML = filas.length
    ? `<p class="rotulo">Así se va a enviar</p><dl>${filas.map(([k, v]) =>
        `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`
    : `<p style="color:var(--tinta-suave)">Llena los pasos anteriores y aquí ves el resumen antes de enviar.</p>`;
}

function armaMensaje() {
  const g = (id) => ($(`#${id}`) || {}).value.trim();
  const lista = elegidos().slice(0, CONFIG.maxVestidosEnMensaje);
  const l = [];
  l.push('Hola SOFIBÉL, quiero agendar una cita.');
  l.push('');
  l.push(`Nombre: ${g('nombre')}`);
  l.push(`WhatsApp: ${telBonito(g('telefono'))}`);
  l.push(`Evento: ${g('tipo-evento')}, el ${fechaLarga(g('fecha-evento'))}`);
  l.push(`Busco: ${g('busco')}`);
  l.push(`Me acomoda: ${fechaLarga(g('fecha-cita'))} a las ${g('hora-cita')}`);
  if (g('talla')) l.push(`Talla aproximada: ${g('talla')}`);
  if (g('acompanantes')) l.push(`Voy con: ${g('acompanantes')}`);
  if (lista.length) {
    l.push('');
    l.push('Vestidos que me gustaron de su página:');
    lista.forEach((p, i) => l.push(`${i + 1}. ${p.nombre} (${p.color})`));
    if (Tienda.favoritos.size > lista.length) {
      l.push(`Y ${Tienda.favoritos.size - lista.length} más que traigo apuntados.`);
    }
  }
  if (g('notas')) { l.push(''); l.push(`Notas: ${g('notas')}`); }
  return l.join('\n');
}

/* ------- .ics propio, cumpliendo RFC 5545 (CRLF, plegado, escapes) ------ */
function escapaIcs(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')       /* dos barras en el literal de JS o el ; sale crudo */
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}
/** Plegado a 75 octetos contando BYTES: si se cuentan caracteres, un acento
    parte la línea a la mitad y el archivo se corrompe. */
function pliega(linea) {
  const bytes = new TextEncoder().encode(linea);
  if (bytes.length <= 73) return linea;
  const salida = [];
  let actual = '', actualBytes = 0, limite = 73;
  for (const ch of linea) {
    const n = new TextEncoder().encode(ch).length;
    if (actualBytes + n > limite) { salida.push(actual); actual = ' '; actualBytes = 1; limite = 72; }
    actual += ch; actualBytes += n;
  }
  salida.push(actual);
  return salida.join('\r\n');
}
function utcDe(fecha, hora, masMin = 0) {
  const d = new Date(`${fecha}T${hora}:00${CONFIG.tzOffset}`);
  if (masMin) d.setMinutes(d.getMinutes() + masMin);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00Z`;
}
function armaIcs() {
  const g = (id) => ($(`#${id}`) || {}).value.trim();
  const L = CONFIG.local;
  const inicio = utcDe(g('fecha-cita'), g('hora-cita'));
  const fin = utcDe(g('fecha-cita'), g('hora-cita'), CONFIG.duracionCitaMin);
  const lista = elegidos().slice(0, CONFIG.maxVestidosEnMensaje).map((p) => p.nombre).join('; ');
  const desc = [
    'Cita para probarte vestidos en SOFIBÉL.',
    g('tipo-evento') ? `Evento: ${g('tipo-evento')}, el ${fechaLarga(g('fecha-evento'))}.` : '',
    lista ? `Vestidos: ${lista}.` : '',
    'Consejo: lleva los tacones que vas a usar.',
    `WhatsApp de la boutique: +52 ${telBonito(CONFIG.wa.slice(2))}`,
  ].filter(Boolean).join(' ');
  const uid = `${inicio}-${Math.abs(hashSimple(g('nombre') + g('telefono')))}@sofibel`;
  const lineas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SOFIBEL//sitio//ES', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${utcDe(hoyISO(), '12:00')}`,
    `DTSTART:${inicio}`, `DTEND:${fin}`,
    `SUMMARY:${escapaIcs('Cita en SOFIBÉL, probarme vestidos')}`,
    `DESCRIPTION:${escapaIcs(desc)}`,
    `LOCATION:${escapaIcs(`${L.calle}, ${L.colonia}, ${L.estado}, ${L.cp}`)}`,
    `GEO:${L.lat};${L.lon}`,   /* el ; de GEO es separador estructural: no se escapa */
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT2H',
    `DESCRIPTION:${escapaIcs('Tu cita en SOFIBÉL es en 2 horas')}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lineas.map(pliega).join('\r\n') + '\r\n';
}
function hashSimple(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

function armaGcal() {
  const g = (id) => ($(`#${id}`) || {}).value.trim();
  const L = CONFIG.local;
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Cita en SOFIBÉL, probarme vestidos',
    dates: `${utcDe(g('fecha-cita'), g('hora-cita'))}/${utcDe(g('fecha-cita'), g('hora-cita'), CONFIG.duracionCitaMin)}`,
    details: `Cita para probarte vestidos en SOFIBÉL. Consejo: lleva los tacones que vas a usar.`,
    location: `${L.calle}, ${L.colonia}, ${L.estado}, ${L.cp}`,
    ctz: CONFIG.tzNombre,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/* respaldo por correo: se dispara ANTES de navegar, con keepalive y sin await,
   para que sobreviva al salto a WhatsApp. Si falla, nunca bloquea a la clienta. */
function respaldoCorreo(mensaje) {
  if (!CONFIG.web3forms) return;
  if ($('input[name="botcheck"]').value) return;     /* trampa de bots */
  const g = (id) => ($(`#${id}`) || {}).value.trim();
  try {
    fetch('https://api.web3forms.com/submit', {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: CONFIG.web3forms,
        subject: `Cita nueva: ${g('nombre')} para ${g('tipo-evento')}`,
        from_name: 'Sitio de SOFIBÉL',
        nombre: g('nombre'), telefono: telBonito(g('telefono')),
        evento: g('tipo-evento'), fecha_evento: g('fecha-evento'),
        busca: g('busco'), fecha_cita: g('fecha-cita'), hora_cita: g('hora-cita'),
        talla: g('talla'), acompanantes: g('acompanantes'), notas: g('notas'),
        vestidos: elegidos().map((p) => p.nombre).join(', '),
        mensaje,
      }),
    }).catch(() => {});
  } catch (e) {}
}

bloque('cita', function () {
  const form = $('#form-cita');
  const hoy = hoyISO();
  $('#fecha-evento').min = hoy;
  $('#fecha-cita').min = hoy;

  $$('[data-ir]').forEach((b) => b.addEventListener('click', () => {
    const destino = Number(b.dataset.ir);
    if (destino > Cita.paso && !validaPaso(Cita.paso)) return;
    if (destino === 3) pintaResumen();
    vePaso(destino);
  }));

  $('#fecha-cita').addEventListener('change', () => { llenaHoras(); pintaResumen(); });
  $$('#form-cita input, #form-cita select, #form-cita textarea').forEach((c) => {
    c.addEventListener('input', () => {
      if (c.closest('.campo') && c.closest('.campo').dataset.invalido === 'si') {
        c.closest('.campo').dataset.invalido = '';
        const e = $(`#e-${c.id}`); if (e) e.hidden = true;
      }
      pintaResumen();
    });
  });
  $('#notas').addEventListener('input', (e) => { $('#cuenta-notas').textContent = e.target.value.length; });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validaPaso(3)) return;
    const mensaje = armaMensaje();
    const url = waLink(mensaje);
    Cita.ultimoWa = url;

    respaldoCorreo(mensaje);

    /* .ics y Google Calendar listos antes de saltar */
    $('#reabrir-wa').href = url;
    $('#gcal').href = armaGcal();
    const blob = new Blob([armaIcs()], { type: 'text/calendar;charset=utf-8' });
    $('#bajar-ics').href = URL.createObjectURL(blob);

    [1, 2, 3].forEach((i) => { $(`#hoja-${i}`).hidden = true; });
    $('#hoja-listo').hidden = false;
    $$('.pasos-cita span').forEach((s) => { s.dataset.hecho = 'si'; });
    $('#hoja-listo').scrollIntoView({ block: 'center', behavior: 'smooth' });

    /* location.href y no window.open: en Safari iOS el bloqueador de ventanas
       mata la pestaña nueva abierta dentro de un manejador. */
    window.location.href = url;
  });

  $('#otra-cita').addEventListener('click', () => {
    form.reset();
    $('#cuenta-notas').textContent = '0';
    llenaHoras();
    pintaResumen();
    vePaso(1);
  });

  llenaHoras();
  pintaResumen();
});

/* ------------------------------ 9. eventos ----------------------------- */
document.addEventListener('click', (e) => {
  const fav = e.target.closest('[data-fav]');
  if (fav) { alternaFavorito(fav.dataset.fav); return; }

  const favCajon = e.target.closest('[data-fav-cajon]');
  if (favCajon) {
    const id = favCajon.dataset.favCajon;
    alternaFavorito(id);
    const dentro = Tienda.favoritos.has(id);
    $('span', favCajon).textContent = dentro ? 'Ya está en tu lista' : 'Guardar para mi cita';
    $('use', favCajon).setAttribute('href', dentro ? '#i-heart-fill' : '#i-heart');
    return;
  }

  const quita = e.target.closest('[data-quita]');
  if (quita) { alternaFavorito(quita.dataset.quita); return; }

  const abre = e.target.closest('[data-abre]');
  if (abre) {
    /* La tarjeta es un enlace real a la publicación de Instagram para que sirva
       sin JavaScript. Con JavaScript, abre la ficha en vez de navegar. */
    e.preventDefault();
    abreCajon(abre.dataset.abre, abre);
    return;
  }

  const chip = e.target.closest('.chip');
  if (chip) {
    const k = chip.dataset.f, v = chip.dataset.v;
    if (k === 'soloFavoritos') Tienda.filtro.soloFavoritos = !Tienda.filtro.soloFavoritos;
    else Tienda.filtro[k] = Tienda.filtro[k] === v ? '' : v;
    aplicaFiltro();
    return;
  }

  if (e.target.closest('#limpiar-filtros, [data-limpiar]')) { limpiaFiltros(); return; }
  if (e.target.closest('#cerrar-cajon, #scrim')) { cierraCajon(); return; }

  if (e.target.closest('#ver-favoritos')) {
    if (Tienda.favoritos.size === 0) {
      Tienda.filtro.soloFavoritos = false;
      $('#vestidos').scrollIntoView({ behavior: 'smooth' });
    } else {
      Tienda.filtro.soloFavoritos = true;
      aplicaFiltro();
      $('#vestidos').scrollIntoView({ behavior: 'smooth' });
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && Cajon.abierto) { cierraCajon(); return; }
  /* trampa de foco del cajón */
  if (e.key === 'Tab' && Cajon.abierto) {
    const foco = $$('#cajon a[href], #cajon button:not([disabled])');
    if (!foco.length) return;
    const primero = foco[0], ultimo = foco[foco.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }
});

/* ------------------------------ 10. arranque --------------------------- */
(async function arranca() {
  try {
    /* Los datos van en línea dentro del HTML. Antes venían de un fetch, que es
       una cosa más que puede fallar y dejar el catálogo vacío. El fetch se
       queda solo como respaldo. */
    const enLinea = document.getElementById('datos-sofibel');
    const v = enLinea
      ? JSON.parse(enLinea.textContent)
      : await fetch('data/vestidos.json').then((x) => x.json());
    const r = await fetch('data/reels.json').then((x) => x.json()).catch(() => ({ reels: [] }));
    Tienda.datos = v;
    pintaCatalogo();
    if (r.reels && r.reels.length) { pintaReels(r.reels); Difiere.mira(); }
    else if ($('#rejilla-reels').querySelector('.reel')) { pintaReels([]); Difiere.mira(); }
    else $('#reels').hidden = true;
  } catch (err) {
    /* si los datos no cargan, el catálogo no se queda en blanco callado */
    $('#rejilla-vestidos').innerHTML =
      `<p style="grid-column:1/-1;color:var(--tinta-suave)">No pude cargar el catálogo.
       Recarga la página, o escríbeles directo por
       <a href="${CONFIG.waCorto}" target="_blank" rel="noopener">WhatsApp</a>.</p>`;
    console.error(err);
  }
})();
