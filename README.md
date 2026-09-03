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

## Modo operador: editar el sitio desde el navegador

Se entra agregando `?editar` a la dirección:

```
https://cmartinezdj.github.io/sofibel/?editar
```

Aparece una barra arriba con todo lo que se puede mover.

| Qué | Cómo |
|---|---|
| **Textos** | Botón "Textos". Tocas cualquier texto de la página y lo escribes encima. |
| **Mover** | Botón "Mover". Arrastras las tarjetas del catálogo, los mosaicos de ocasión y las fotos de clientas. |
| **Fotos** | Pasas el puntero sobre una foto y sale "Cambiar foto": eliges otra del sitio o subes una nueva desde el teléfono. La nueva se recorta a 2:3 y se guarda en tres tamaños, todo en el navegador. |
| **Colores** | Los seis tokens que se pueden mover sin romper contrastes. Se ven al momento. |
| **Catálogo** | Nombre, precio de renta, precio de venta y tallas de cada pieza. En cuanto pones un precio, la tarjeta deja de decir "Precio por WhatsApp". |
| **Ocultar** | Cada sección trae su etiqueta con "ocultar" y "mostrar". Útil mientras el sitio está en construcción. |

Todo se guarda **en tu navegador** conforme editas, así que puedes cerrar y volver
al día siguiente. Nada es público hasta que le das a **Publicar**.

### Cómo publica

GitHub Pages es estático: no hay servidor donde guardar. El editor escribe de
vuelta al repositorio, y hay una decisión que sostiene todo:

> **No se serializa la página viva. Se pide el `index.html` original, se parsea
> aparte, y los cambios se aplican sobre esa copia limpia.**

Es necesario porque `app.js` le mete cosas a la página que no van en el archivo
(los corazones, la segunda foto del hover, el contenido de la ficha, los chips de
filtro) y le quita otras (el `data-src` de cada imagen, que se vuelve `src` al
cargarla). Guardar la página viva congelaría todo eso dentro del HTML: el sitio
publicado quedaría roto y volvería a pesar megabytes. Con la copia limpia, lo que
se publica es el archivo de verdad más las ediciones, y nada más.

Antes de publicar corre una **revisión** que se niega si el HTML salió mutilado:
comprueba que estén los marcadores del catálogo, el sprite de iconos, los enlaces
a `app.js` y `styles.css`, que haya al menos 30 tarjetas, y que no se haya colado
nada del editor. Si algo falta, no publica y dice qué.

Los cambios del catálogo se escriben **en los dos lados**: en `data/vestidos.json`
y en las tarjetas del HTML. El JSON es el que manda para `tools/render_html.py`,
así que si solo se tocara el HTML, la próxima corrida del script borraría todo.

Se publica en **un solo commit** con la API de Git de GitHub, no archivo por
archivo, para que el sitio nunca quede a medias.

### El token

Para publicar hace falta un token propio de GitHub. Conviene que sea:

- de **acceso preciso** (fine-grained), no clásico
- limitado **solo** al repositorio `cmartinezdj/sofibel`
- con un único permiso: **Contents → Read and write**
- con fecha de caducidad

Se guarda en la sesión del navegador y solo viaja hacia `api.github.com`. Si
marcas "recordarlo en este dispositivo" pasa a almacenamiento permanente: **no lo
hagas en una computadora compartida**, porque quien la use podría escribir en el
repositorio.

Si prefieres no usar token, el botón **Descargar** baja el `index.html` y el
`vestidos.json` ya con los cambios, y esos archivos se pueden subir a mano.

### Lo que hay que saber

- **La dirección del editor es pública.** Cualquiera que la adivine ve los
  controles, pero sus cambios se quedan en su propio navegador y no puede
  publicar sin token. El token es el candado de verdad, no la dirección.
- El sitio normal **no carga nada del editor**: sin `?editar` no se piden
  `editor.js` ni `editor.css`. Verificado.
- Si el editor avisa que "la página viva y el archivo no coinciden", la edición
  de texto se apaga sola. Pasa si alguien tocó el HTML a mano de una forma que el
  editor no puede seguir; lo demás sigue funcionando.
- `window.__ed` queda disponible en modo editor para diagnóstico.

---

## Cómo se escribe en el sitio

El texto está en español de México neutro y profesional. Si vas a cambiar una
frase (a mano o desde el modo operador), estas son las reglas que ya sigue todo
el sitio:

1. **Una sola voz: la boutique en primera persona del plural.** «te recibimos»,
   «lo ajustamos», «abrimos de lunes a sábado». Nunca hablar del negocio en
   tercera persona («abren», «sus clientas», «te dicen»): la página *es* de
   SOFIBÉL, no habla de SOFIBÉL. A la clienta siempre de **tú**.
2. **Sin coloquialismos.** Ya se quitaron: batallar, acomodar como «convenir»,
   «le das enviar», «ahí mismo», «traes una idea», «que no se te olvide»,
   «descolgados». Tampoco españolismos: en México es *celular*, no *móvil*.
3. **Nunca hablar del sitio frente a la clienta.** Nada de «esto es lo que sí
   está publicado» o «este sitio no lo inventa». Si un dato se define en la
   cita, se dice así de simple: «lo acordamos al apartar tu vestido».
4. **No inventes datos del negocio.** Ver la tabla de arriba. El único precio
   que existe es el `$499` y es de **venta** de pre-loved en la venta anual,
   nunca de renta.
5. **Sin guiones largos** (`—`, `–`). Coma, punto, paréntesis o dos puntos.
6. **Mismo largo.** La página ya está maquetada; una frase que crece más de
   ~15 % rompe el diseño en móvil.
7. **Un solo nombre por cosa:** renta, probador, **showroom** (no «el local»),
   cita, ajustes, tintorería, **talla** (no «talle», que en el catálogo sí se
   usa pero como término de confección: «drapeado al talle»), clutch, bolsa de
   noche, celular, apartar, anticipo, garantía, pre-loved, valet parking.

El lema del pie, **«Amamos verlas brillar.»**, es de SOFIBÉL: aparece en varias
publicaciones suyas de Instagram. No es texto inventado y se conserva tal cual.

Ojo: el mismo texto vive en tres lugares y hay que cambiarlo en los tres.
El visible en `index.html`, el de los mensajes de WhatsApp y errores en
`app.js`, y el de los `meta` y el JSON-LD del `<head>` y del final de
`index.html` (ese sí va en tercera persona, nombrando a SOFIBÉL: es para
Google, no para la clienta).

## Referencia visual: hauteline.com

Carlos pidio "una pagina parecida a esta" apuntando a [hauteline.com](https://hauteline.com).
Lo que se tomo de ahi y lo que no:

**Se tomo:**
- **Barra de anuncio** arriba de todo, en color de marca, con una linea en mayusculas.
- **Logotipo centrado y nav de dos filas**, todo en mayusculas rastreadas (0.14-0.16em).
  Es lo que mas cambia el registro: de folleto a tienda.
- **Heroe a sangre**, sin marco ni sombra: la foto llega hasta la orilla.
- **Mosaicos de ocasion con foto** en vez de una fila de chips. La clienta busca
  por evento ("voy a una boda"), no por tela, y una foto decide mas rapido.
  Cada mosaico filtra el catalogo al tocarlo.
- **Banda editorial** a sangre: foto grande, rotulo y boton a una parte del catalogo.
- **Titulos de seccion en mayusculas y sans.** El serif se reserva para el titular
  de portada y los momentos editoriales.
- **Fondos alternados** papel y blush, que separan secciones sin lineas.
- **Cuatro pasos en tarjetas** en escritorio, no una lista larga.

**No se tomo, a proposito:**
- Su **verde olivo** (#808160). Es la identidad de Hauteline; SOFIBEL tiene la suya,
  el rosa #D8908B que sale de su propio logotipo.
- **Designers, Sale, Rewards, carrito y checkout.** Hauteline es e-commerce nacional
  con miles de piezas de disenador y envios. SOFIBEL es una boutique de una sola
  ubicacion que trabaja con cita. Copiar esos menus seria prometer lo que no hay.
- El formato de precio **"Rent from $X / Retail $Y"** esta bien y es el patron que
  mas convierte, pero necesita precios. La estructura ya esta lista en la tarjeta;
  falta que la dueña los de.

---

## El orden de la pagina, y por que

El sitio NO sigue el orden de Instagram. Sigue el flujo de las rentadoras que
convierten (Rent the Runway, TrenLend, 1NS, Anaelle, Miami Dress Rental), que es
distinto porque rentar un vestido es un proceso que la clienta no conoce:

| # | Seccion | Por que ahi |
|---|---|---|
| 1 | Portada | Dice **que es** el negocio, no un eslogan. "El vestido de tu evento, en renta." |
| 2 | Lo que incluye | Cinco iconos de confianza, como Miami Dress Rental. Contesta "y esto que me da". |
| 3 | Como funciona | **Arriba, no al final.** Es lo primero que pregunta quien nunca ha rentado. |
| 4 | Vestidos | El catalogo, con los clutches como riel al final de la seccion. |
| 5 | Talla y ajuste | La duda que mas frena. RTR lo trata como pestaña de primer nivel. |
| 6 | Precios | Que cuesta y que incluye. |
| 7 | Agendar cita | **Antes del FAQ.** Quien ya se decidio no deberia tener que pasar por las dudas. |
| 8 | Preguntas | Manejo de objeciones para quien todavia duda. |
| 9 | Visitanos | Direccion, horario y ruta. |
| 10 | Clientas | Prueba social, al final. Refuerza, no vende. |

**Lo que se quito a proposito:** el manifiesto "wtf is comprar un vestido..." y la
reja de reels. Las dos son voz de Instagram, no de una boutique. El video no se
tiro: se movio **adentro de la ficha del vestido**, que es donde resuelve la duda
real ("como cae la falda al caminar"). Cinco vestidos tienen el suyo.

### Movil primero

- **Barra fija abajo** con "Agendar cita" y WhatsApp. En un negocio que vive de la
  cita, ese boton no puede quedarse arriba y perderse.
- **Los filtros viven en una hoja que sube.** Color, largo y tela son 30 chips; en
  una fila envuelta se comen media pantalla. Solo la ocasion queda a la vista,
  porque es el eje por el que la clienta busca.
- **Dos columnas de vestidos en telefono**, como en Instagram, no una.
- La ficha del vestido es una hoja desde abajo en movil y un cajon lateral en
  escritorio.

---

## Peso: la regla que no hay que romper

Carlos reporto que en **WiFi si abria y en 4G no**. Era peso, no red. Historial de la
primera carga en un telefono, medido:

| | Primera carga | 4G malo (1.5 Mbps) |
|---|---|---|
| Al principio | 5,350 KB | 29 s |
| Con carga diferida propia | 434 KB | 2.3 s |
| Sin prioridad en fotos de abajo | **214 KB** | **1.1 s** |

El error grande, y el que mas costo encontrar: **seis fotos del catalogo salian con
`fetchpriority="high"`**, y el catalogo esta a 20,000 caracteres del inicio del
documento. Eran ~350 KB compitiendo con la portada antes de que se viera nada. En WiFi
no se nota; en 4G mata la carga.

**Regla:** con prioridad alta va **solo** la foto grande de la portada. Todo lo demas
se difiere. `tools/render_html.py` ya lo hace (`ya = False` para todas las tarjetas);
si alguien lo cambia, hay que volver a medir.

---

## Si la red de alguien no alcanza `github.io`

Pasa, y no hay nada que arreglar en el codigo: **GitHub Pages sirve desde las IPs
`185.199.108-111.153`, y muchos filtros de operadora y de red corporativa bloquean el
dominio `github.io` completo** porque ahi vive contenido de cualquiera. Sintoma tipico:
la pagina se tarda mucho y termina en blanco, sin error.

Para esos casos hay una version en **un solo archivo**, sin ninguna peticion externa:
fuentes, fotos y logos van como data URI, y el CSS y el JS en linea.

```bash
python3 tools/build_artifact.py
```

Genera `sofibel-un-archivo.html` (1.9 MB). Se puede abrir con doble clic, mandar por
correo o publicar en cualquier otro dominio. Diferencias con el sitio completo: una foto
por pieza a 320 px, los reels enlazan a Instagram en vez de reproducirse, el mapa es una
tarjeta de texto, y no hay descarga de `.ics` (solo Google Calendar).

**La solucion de fondo es un dominio propio** (por ejemplo `sofibel.mx`) apuntado a
GitHub Pages: los filtros casi siempre bloquean por nombre de dominio, no por IP, asi que
un dominio propio pasa. Ojo con el orden, que ya nos morfio antes: no pongas el dominio
en la configuracion de Pages antes de que el DNS resuelva, porque el 301 rompe el enlace
de `github.io` mientras tanto.

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
