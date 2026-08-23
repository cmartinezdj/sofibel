#!/usr/bin/env python3
"""Empaqueta el sitio en UN archivo autocontenido, sin ninguna peticion externa.

Para que sirve: si la red de la clienta no alcanza github.io (pasa: los filtros
de operadora bloquean el dominio completo porque ahi vive contenido de
cualquiera), el sitio no abre y no hay nada que arreglar en el codigo. Este
archivo se puede publicar en otro dominio y se ve igual.

Todo va adentro: fuentes, fotos y logos como data URI, CSS y JS en linea. Se
recomprimen las fotos a 320 px de ancho, que es de sobra para una rejilla de dos
columnas en un telefono, y se deja una sola foto por pieza.

Uso:  python3 tools/build_artifact.py
"""
import base64, io, json, os, re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RATIO = 2 / 3

def datauri(b, mime):
    return f'data:{mime};base64,' + base64.b64encode(b).decode('ascii')

def webp(ruta, ancho, calidad=72):
    """Reencoda a `ancho` px y devuelve un data URI."""
    im = Image.open(os.path.join(ROOT, ruta)).convert('RGB')
    if im.width != ancho:
        im = im.resize((ancho, round(im.height * ancho / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=calidad, method=6)
    return datauri(buf.getvalue(), 'image/webp'), len(buf.getvalue())

def png(ruta):
    b = open(os.path.join(ROOT, ruta), 'rb').read()
    return datauri(b, 'image/webp' if ruta.endswith('.webp') else 'image/png'), len(b)

def main():
    doc = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    css = open(os.path.join(ROOT, 'styles.css'), encoding='utf-8').read()
    js  = open(os.path.join(ROOT, 'app.js'), encoding='utf-8').read()
    datos = json.load(open(os.path.join(ROOT, 'data', 'vestidos.json'), encoding='utf-8'))

    pesos = {'fuentes': 0, 'fotos': 0, 'logos': 0}

    # ---- fuentes dentro del CSS
    def mete_fuente(m):
        ruta = 'assets/' + m.group(1)
        b = open(os.path.join(ROOT, ruta), 'rb').read()
        pesos['fuentes'] += len(b)
        return "url('" + datauri(b, 'font/woff2') + "')"
    css = re.sub(r"url\('(?:assets/)?(fonts/[^']+\.woff2)'\)", mete_fuente, css)

    # ---- una sola foto por pieza, y a 320 px
    cache = {}
    def foto320(src):
        if src not in cache:
            uri, n = webp(src, 320)
            pesos['fotos'] += n
            cache[src] = uri
        return cache[src]

    # Los datos NO llevan la foto. Si la llevaran, cada imagen quedaria escrita dos
    # veces en el archivo (una en la tarjeta y otra aqui) y eso son ~900 KB de mas.
    # La ficha clona la imagen que ya esta en la tarjeta, con el parche de abajo.
    for grupo in ('vestidos', 'accesorios'):
        for p in datos[grupo]:
            p['fotos'] = [{'origen': p['fotos'][0]['origen'], 'variantes': []}]
    for l in datos['lookbook']:
        l['variantes'] = []

    # ---- las fotos que ya estan escritas en el HTML
    def cambia_img(m):
        etiqueta = m.group(0)
        # de srcset se toma la variante mas chica disponible y se tira el resto
        ruta = None
        mm = re.search(r'(?:data-)?src="(images/[^"]+|videos/[^"]+)"', etiqueta)
        if mm:
            ruta = mm.group(1)
        if not ruta:
            return etiqueta
        ancho = 640 if ('manifiesto' in ruta or 'azul-rey-cruzado-1' in ruta
                        or 'rosa-mexicano-tul-1' in ruta) else 320
        base = re.sub(r'-\d+\.webp$', '', ruta)
        for cand in (f'{base}-420.webp', f'{base}-720.webp', ruta):
            if os.path.exists(os.path.join(ROOT, cand)):
                ruta = cand
                break
        uri, n = webp(ruta, ancho)
        pesos['fotos'] += n
        etiqueta = re.sub(r'\s(?:data-)?srcset="[^"]*"', '', etiqueta)
        etiqueta = re.sub(r'\sdata-src="[^"]*"', '', etiqueta)
        etiqueta = re.sub(r'\ssrc="[^"]*"', '', etiqueta)
        etiqueta = re.sub(r'\sloading="lazy"', '', etiqueta)
        return etiqueta[:4] + f' src="{uri}"' + etiqueta[4:]

    # fuera las copias de <noscript>: aqui el JS siempre corre y duplicarian el peso
    doc = re.sub(r'<noscript><img[^>]*></noscript>', '', doc)
    # fuera la foto de hover: en un telefono no hay hover y pesa igual que la principal
    doc = re.sub(r'<img[^>]*class="reverso"[^>]*>', '', doc)
    doc = re.sub(r'<img[^>]*(?:data-)?src="(?:images|videos)/[^"]*"[^>]*>', cambia_img, doc)

    # ---- logos
    for ruta in ('assets/wordmark-solo.webp', 'assets/wordmark-solo-dark.webp',
                 'assets/logo-sofibel.webp', 'assets/logo-sofibel-dark.webp'):
        uri, n = png(ruta)
        pesos['logos'] += n
        doc = doc.replace(f'src="{ruta}"', f'src="{uri}"')

    # ---- el mapa es un iframe externo: la politica de seguridad lo bloquea
    doc = re.sub(r'<div class="mapa revela">.*?</div>', '''<div class="mapa revela" style="display:grid;place-items:center;padding:2rem;text-align:center">
      <div><p class="rotulo">Cómo llegar</p>
      <p style="font-family:var(--display);font-size:1.6rem;line-height:1.2;margin:.6rem 0 1rem">Av. Jesús del Monte 16, local 2</p>
      <p style="color:var(--tinta-suave);font-size:.9rem">Justo enfrente del Fraccionamiento Fuentes de las Lomas.<br>Plus Code <span class="num">9PR5+7H</span>. Hay valet parking.</p></div>
    </div>''', doc, flags=re.S)

    # ---- los reels quedan como enlace a Instagram (el mp4 no cabe en linea)
    doc = re.sub(r'<video[^>]*></video>\s*', '', doc)
    def reel_a_enlace(m):
        code = m.group(1)
        return (f'<a class="reel-play" href="https://www.instagram.com/reel/{code}/" '
                f'target="_blank" rel="noopener" aria-label="Ver el reel en Instagram">')
    doc = re.sub(r'<button class="reel-play" type="button" aria-label="Reproducir: [^"]*">', 
                 lambda m: '<a class="reel-play" href="#reels-ig" aria-label="Ver en Instagram">', doc)
    doc = doc.replace('</span></button>', '</span></a>')
    for fig in re.findall(r'<figure class="reel" data-code="([^"]+)"', doc):
        doc = doc.replace('<a class="reel-play" href="#reels-ig"',
                          f'<a class="reel-play" href="https://www.instagram.com/reel/{fig}/" target="_blank" rel="noopener"', 1)

    # ---- datos en linea, ya con las fotos convertidas
    crudo = json.dumps(datos, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    doc = re.sub(r'(<!--DATOS-->).*?(<!--/DATOS-->)',
                 lambda m: m.group(1) + f'<script type="application/json" id="datos-sofibel">{crudo}</script>' + m.group(2),
                 doc, flags=re.S)

    # ---- solo el cuerpo: el publicador pone su propio <head>
    cuerpo = doc[doc.index('<body>') + 6: doc.index('</body>')]
    cabeza = doc[:doc.index('</head>')]
    arranque = re.search(r'<script>\s*\(function \(\) \{.*?</script>', cabeza, re.S).group(0)
    jsonld = re.search(r'<script type="application/ld\+json">.*?</script>', doc, re.S)

    # El visor de artifacts nunca da permiso de descarga a la pagina, asi que el
    # boton del .ics no haria nada. Se queda solo el de Google Calendar, que es
    # una navegacion normal.
    cuerpo = re.sub(r'<a class="btn btn-secundario" id="bajar-ics".*?</a>\s*', '', cuerpo, flags=re.S)
    js = js.replace(
        "    const blob = new Blob([armaIcs()], { type: 'text/calendar;charset=utf-8' });\n"
        "    $('#bajar-ics').href = URL.createObjectURL(blob);",
        '    /* sin .ics en esta version: el visor no permite entregar archivos */')

    # aqui no hay archivos que pedir: los reels ya vienen escritos en el HTML
    js = js.replace(
        "    const r = await fetch('data/reels.json').then((x) => x.json()).catch(() => ({ reels: [] }));",
        "    const r = { reels: [] };   /* version de un solo archivo: nada que pedir */")

    # parche: la galeria de la ficha clona la foto de la tarjeta
    js = js.replace(
        '''    <div class="cajon-galeria${esAcc ? ' contenida' : ''}">
      ${p.fotos.map((f, i) => img(f, '(min-width:40rem) 28rem, 92vw', altDe(p, i))).join('')}
    </div>''',
        '''    <div class="cajon-galeria${esAcc ? ' contenida' : ''}" data-clonar="${p.id}"></div>''')
    js = js.replace(
        "  const cajon = $('#cajon'), scrim = $('#scrim');",
        '''  /* La foto se clona de la tarjeta en vez de volver a escribirla: en la
     version de un solo archivo, repetirla costaria cientos de KB. */
  const galeria = $('#cajon-cuerpo .cajon-galeria[data-clonar]');
  if (galeria) {
    const fuente = document.querySelector('.pieza[data-id="' + id + '"] .pieza-foto img');
    if (fuente) {
      const copia = fuente.cloneNode(false);
      copia.removeAttribute('class'); copia.removeAttribute('sizes');
      galeria.appendChild(copia);
    }
  }

  const cajon = $('#cajon'), scrim = $('#scrim');''')

    salida = ['<title>SOFIBÉL Interlomas</title>',
              arranque,
              '<style>\n' + css + '\n</style>',
              cuerpo.replace('<script src="app.js" defer></script>', ''),
              '<script>\n' + js + '\n</script>']
    if jsonld:
        salida.append(jsonld.group(0))
    html = '\n'.join(salida)
    # ya no hay archivos que pedir
    html = re.sub(r'<link rel="(icon|apple-touch-icon|manifest)"[^>]*>', '', html)

    destino = os.path.join(ROOT, 'sofibel-un-archivo.html')
    open(destino, 'w', encoding='utf-8').write(html)
    mb = len(html.encode('utf-8')) / 1048576
    print(f"{destino}")
    print(f"  {mb:.2f} MB en un solo archivo, cero peticiones externas")
    print(f"  fuentes {pesos['fuentes']/1024:.0f} KB · fotos {pesos['fotos']/1024:.0f} KB · logos {pesos['logos']/1024:.0f} KB")
    print(f"  {html.count('data:image')} imagenes y {html.count('data:font')} fuentes en linea")
    for mal in ('src="images/', 'src="videos/', 'href="styles.css', 'src="app.js', '<iframe'):
        if mal in html:
            print(f"  OJO: quedo una referencia externa -> {mal}")

if __name__ == '__main__':
    main()
