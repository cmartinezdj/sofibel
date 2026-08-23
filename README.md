# SOFIBÉL · sitio web

Sitio de **SOFIBÉL, Renta y Venta de Vestidos · Interlomas** ([@sofibelmx](https://www.instagram.com/sofibelmx/)).
Una sola página, estática, sin build y sin servidor: HTML, CSS y JavaScript puro sobre GitHub Pages.

**En vivo:** https://cmartinezdj.github.io/sofibel/

---

## Lo primero: 6 datos que faltan

El sitio se escribió con lo que SOFIBÉL ya dice en público (su Instagram, su ficha de Google
y sus reseñas). Todo lo que **no** está publicado se dejó dicho como lo que es, en vez de
inventarlo. Estos son los huecos, en orden de importancia:

| # | Qué falta | Dónde entra | Hoy dice |
|---|---|---|---|
| 1 | **Rango de precio de renta** | `#precios` y cada ficha | "Se cotiza por WhatsApp o en tu cita, por pieza" |
| 2 | **Días que dura la renta** | FAQ y ficha | "Se acuerda en tu cita" |
| 3 | **Depósito en garantía**: si existe, cuánto, si se devuelve | FAQ | "Se acuerda en tu cita" |
| 4 | **Tintorería**: ¿la cubre la boutique? | FAQ | no se menciona |
| 5 | **Ajustes**: ¿incluidos o con costo? ¿hasta cuántas tallas? | FAQ y ficha | "Los ajustes se hacen en el local" |
| 6 | **Rango de tallas** (letra y número MX) | ficha de cada vestido | "Se ve en el probador" |

También hay que confirmar dos cosas:

- **El horario.** El perfil de Instagram dice **10:30**, Google Business dice **10:00**, y una
  reseña menciona que cierran a las 8. El sitio publica el de Instagram
  (L-V 10:30 a 19:00, S 10:30 a 15:00). Cuando se decida cuál es, hay que corregir Google
  también: si no coinciden, el posicionamiento local se cae.
- **Novia, madrina, bautizo, comunión y boda civil.** No hay una sola mención pública de esas
  categorías, así que **no aparecen en el sitio**. Si sí las manejan, se agregan.

El material que llenaría casi todos estos huecos está en los highlights de Instagram
(`FAQ ⁉️`, `📍Ubicación`, `CATÁLOGO ✨`), que solo se ven con la sesión de la dueña. Basta con
capturas de pantalla de esos tres.

---

## Cómo se llena un precio o una talla

Los campos existen y el sitio los muestra **solo cuando tienen valor**. Se editan en
`data/vestidos.json`:

```json
{
 "id": "azul-rey-cruzado",
 "nombre": "Azul rey, escote cruzado",
 "precioRenta": null,      →  1490
 "precioVenta": null,      →  3200
 "valorVestido": null,     →  4800   (para mostrar el ahorro)
 "tallas": null,           →  "5, 7 y 9 (MX)"
 "disponible": true
}
```

En cuanto `precioRenta` deja de ser `null`, la tarjeta cambia sola de
"Precio por WhatsApp" a "Renta $1,490", y la ficha hace lo mismo.

Para el rango general de la sección de precios, se edita el texto directamente en
`index.html`, en la sección `#precios`.

---

## Cómo agregar vestidos nuevos

1. Pon las fotos originales en `images/posts/` (una por toma, nombre libre).
2. Abre `tools/build_catalogo.py` y agrega una entrada a la lista `V`:

```python
 dict(id='verde-jade-sirena', nombre='Verde jade, corte sirena',
      color='Verde jade', colorHex='#0F7A6B', largo='Largo', tela='Satín',
      detalle='Escote corazón, corte sirena y cola corta.',
      ocasion=['noche','xv'],
      fotos=[('mi-foto-1.jpg', .5, .42), ('mi-foto-2.jpg', .5, .45)]),
```

   Los dos números después del archivo son el **centro del recorte** (x, y de 0 a 1). Sirven
   para que la cara y el escote no queden cortados: `.5, .42` recorta un poco arriba del centro.

3. Corre los dos scripts, en este orden. El primero recorta a 2:3, exporta webp
   en tres anchos bajo un techo de bytes y reescribe `data/vestidos.json`. El
   segundo escribe las tarjetas dentro de `index.html`:

```bash
python3 tools/build_catalogo.py && python3 tools/render_html.py
```

El color nuevo aparece solo en los filtros; no hay que tocar nada más.

> **El catálogo va escrito en el HTML, no lo pinta JavaScript.** Es a propósito:
> antes se armaba en el navegador a partir de un `fetch`, y eso son dos cosas que
> pueden fallar (que el JS no corra, que el fetch no llegue), dejando a la clienta
> mirando una página sin vestidos. Si editas `data/vestidos.json` a mano, corre
> `render_html.py` para que el HTML se entere.

### Videos

Igual, con `tools/build_videos.py`: pon el `.mp4` en `videos/`, agrégalo a la lista `REELS`
y corre el script. Los comprime a 720 px sin audio (para que puedan reproducirse en bucle
sin pedir permiso) y saca el póster en webp.

```bash
python3 tools/build_videos.py
```

Los `.mp4` originales pesan 67 MB y **no se suben** (están en `.gitignore`); al repo solo va
lo de `videos/web/`.

---

## Configuración

Todo lo editable vive en el bloque `CONFIG`, al principio de `app.js`:

| Campo | Qué es |
|---|---|
| `wa` | WhatsApp del negocio: **52 + 10 dígitos**, sin el `1` viejo. Hoy `525537636800` |
| `waCorto` | El enlace corto del bio, para el botón genérico del encabezado |
| `web3forms` | Vacío. Ver abajo |
| `local` | Dirección y coordenadas del pin de Google Business |
| `horario` | Horario por día. `0` es domingo, `null` es cerrado |

### Copia de las citas por correo (opcional, gratis)

El formulario abre WhatsApp con el mensaje ya escrito, pero **la clienta todavía tiene que
tocar "enviar"**. Si no lo toca, la cita se pierde. Para tener siempre una copia escrita:

1. Crea una llave gratis en [web3forms.com](https://web3forms.com) (250 envíos al mes).
2. Pégala en `CONFIG.web3forms` en `app.js`.

La llave es pública por diseño y el correo real nunca aparece en el HTML, así que los
recolectores de spam no lo encuentran. El envío sale con `keepalive` **antes** de saltar a
WhatsApp, para que sobreviva a la navegación.

---

## Ver el sitio en local

macOS bloquea servir desde `~/Documents`, así que conviene copiarlo a `/tmp`:

```bash
rsync -a --exclude '.git' ~/Documents/Claude/Projects/sofibel/ /tmp/sofibel-preview/ && cd /tmp/sofibel-preview && python3 -m http.server 8811
```

Y abrir http://127.0.0.1:8811

---

## Qué hay dentro

```
index.html          la página entera: catálogo pre-generado, sprite de iconos y JSON-LD
diagnostico.html    página de rescate: dice qué soporta un navegador y si los archivos bajan
styles.css          sistema de diseño: tokens, tipografía, componentes
app.js              catálogo, filtros, favoritos, ficha, reels y el flujo de cita
data/
  vestidos.json     catálogo (lo genera tools/build_catalogo.py)
  reels.json        videos (lo genera tools/build_videos.py)
  instagram.json    perfil y publicaciones, como respaldo del origen de las fotos
assets/
  fonts/            Cormorant Garamond y Jost, autoalojadas (168 KB, cero terceros)
  icons.svg         45 iconos de Phosphor, también en línea dentro de index.html
  logo-*.png        logotipo extraído de su propia publicación, en claro y oscuro
images/vestidos/    webp del catálogo en 420/720/1080
videos/web/         reels comprimidos y sus pósters
tools/              los scripts que regeneran todo lo anterior, más la suite de pruebas de la cita
```

### Decisiones que conviene no deshacer sin querer

- **Un solo acento: el rosa.** `--rosa` (#D8908B, el del logotipo) es **solo relleno**: da
  2.41:1 sobre el papel, así que nunca lleva texto encima. Para texto, enlaces y botones va
  `--rosa-honda` (#A2454C, 5.72:1). El dorado del logo vive dentro del PNG y no es un token.
- **Dos radios y una regla:** lo interactivo es píldora, las superficies y las fotos son de
  filo recto.
- **Nada de la interfaz pasa de 300 ms y nunca se usa `ease-in`.** Todo se apaga bajo
  `prefers-reduced-motion`.
- **Sin listeners de scroll.** El borde del encabezado, el revelado de secciones y la carga
  del mapa usan `IntersectionObserver`.
- **El cajón abre con un reflujo forzado, no con `requestAnimationFrame`:** rAF no corre en
  una pestaña oculta y el cajón se quedaría presente pero fuera de pantalla.
- **`window.location.href`, no `window.open`,** para saltar a WhatsApp: en Safari de iOS el
  bloqueador de ventanas mata la pestaña nueva abierta dentro de un manejador.
- **El contenido es visible por default.** La clase `.anima` es la que habilita el efecto de
  entrada, la pone el script del `<head>` antes de pintar y **se quita sola a los 1.8 s** si
  `app.js` no puso `window.__sofibelVivo`. Al revés (contenido invisible que JS revela)
  cualquier falla de JavaScript dejaba la página en blanco.
- **Cada bloque de `app.js` va en su propio `try`.** Eran sentencias sueltas y un error en la
  primera mataba todas las demás.
- **Las tarjetas son enlaces reales** a la publicación de Instagram; con JS el clic se
  intercepta y abre la ficha. Así sirven sin JavaScript.
- **Los `<video>` nacen sin `<source>`.** Safari no siempre respeta `preload="none"` y se
  ponía a jalar los 15 MB de reels al abrir. El archivo se pide al tocar play.
- **Respaldos de CSS moderno:** `color-mix()` cambiado por tokens rgba, `aspect-ratio` con
  respaldo de padding porcentual (sin él las fotos medían cero de alto), y `vh` antes de `dvh`.
- **Presupuesto de bytes por foto** en `build_catalogo.py`: 38 KB a 420w, 92 KB a 720w. Sin eso
  el peso lo decidía el ruido de la imagen y había fotos de 278 KB.

---

## Sobre las fotos

Las fotos y los videos son de SOFIBÉL y se bajaron de su Instagram **público**. Cada vestido
del catálogo enlaza a la publicación de la que salió, y el pie de página lo dice.

Dos cosas antes de que esto sea el sitio oficial del negocio:

1. **Pedir los originales en alta.** Lo que hay aquí son las versiones que sirve Instagram,
   suficientes para la web pero no para imprimir ni para hacer zoom.
2. **Confirmar el permiso de las clientas** que aparecen en la sección *Ustedes*. Están
   publicadas en el Instagram de la boutique, pero un sitio propio es otro contexto.

## Créditos técnicos

Fuentes: [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) y
[Jost](https://fonts.google.com/specimen/Jost), autoalojadas.
Iconos: [Phosphor](https://phosphoricons.com/). Mapa: [OpenStreetMap](https://www.openstreetmap.org/).
