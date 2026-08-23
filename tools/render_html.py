#!/usr/bin/env python3
"""Escribe el catálogo dentro de index.html, en vez de dejar que lo pinte el JS.

Por qué: el catálogo se armaba en el navegador a partir de un fetch. Eso son dos
cosas que pueden fallar (que el JS no corra, que el fetch no llegue) y en las dos
la clienta se queda mirando una página sin vestidos. Aquí quedan escritos en el
HTML, así que se ven siempre. JavaScript deja de ser el que los dibuja y pasa a
ser el que los mejora: filtros, favoritos y la ficha en cajón.

Las tarjetas son enlaces de verdad a la publicación de Instagram. Con JS, el clic
se intercepta y abre la ficha; sin JS, el enlace lleva a la foto original.

Uso:  python3 tools/render_html.py     (corre después de build_catalogo.py)
"""
import json, os, re, html as H

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def esc(s):
    return H.escape(str(s if s is not None else ''), quote=True)

def img(foto, sizes, alt, extra='', ya=False):
    """Dos copias de la misma foto, y es a propósito.

    La que cuenta sale con data-src y la carga el observador de app.js. Se hace
    así y no con loading="lazy" nativo porque las fotos también se pueden
    inyectar desde JS, y en ese caso el navegador las considera todas visibles
    y se baja el catálogo completo (5.35 MB medidos).

    Dentro de <noscript> va la misma foto con src real y lazy nativo, para quien
    tenga JavaScript apagado o roto: ahí el navegador sí difiere bien, porque la
    etiqueta viene escrita en el HTML desde el principio.
    """
    v = foto['variantes']
    grande = v[-1]
    srcset = ', '.join(f"{x['src']} {x['w']}w" for x in v)
    comun = (f'sizes="{sizes}" width="{grande["w"]}" height="{round(grande["w"] * 1.5)}" '
             f'alt="{esc(alt)}" decoding="async" {extra}')
    if ya:
        return f'<img src="{grande["src"]}" srcset="{srcset}" {comun} fetchpriority="high">'
    # Sin copia en <noscript>: duplicaba 51 etiquetas <img> en un documento que ya
    # era de 157 KB, y en un iPhone eso pesa mas de lo que valia el caso.
    return f'<img data-src="{grande["src"]}" data-srcset="{srcset}" {comun}>'

def alt_de(p, i=0):
    que = p['tipo'].lower() if p['tipoItem'] == 'accesorio' else 'vestido'
    cola = ', otra toma' if i else ''
    return f"{p['nombre']}, {que} {p['color'].lower()} en renta en SOFIBÉL{cola}."

SIZES_REJILLA = '(min-width:64rem) 20vw, (min-width:40rem) 30vw, 46vw'

def tarjeta(p, i):
    """El corazon de favoritos NO se escribe aqui: lo pone app.js.

    Eran 33 botones con 67 referencias <use> de SVG, o sea mas de la mitad del
    documento, y sin JavaScript el boton no hace nada. Ponerlo desde JS baja el
    peso del HTML sin perder nada.
    """
    ya = i < 6
    f1 = p['fotos'][0]
    f2 = p['fotos'][1] if len(p['fotos']) > 1 else None
    meta = (f"{p['tipo']} · {p['color']}" if p['tipoItem'] == 'accesorio'
            else f"{p['largo']} · {p['tela']} · {p['color']}")
    if p.get('precioRenta'):
        precio = f'<span class="precio num">Renta ${p["precioRenta"]:,}</span>'.replace(',', ',')
    else:
        precio = '<span class="sin-precio">Precio por WhatsApp</span>'
    # La segunda foto (la del hover) va como atributo, no como <img>. En un
    # telefono no hay hover, y una etiqueta completa cuesta cinco veces mas que
    # su ruta. app.js la monta solo en aparatos con puntero fino.
    rev = ''
    if f2:
        v = f2['variantes']
        conjunto = ', '.join('%s %dw' % (x['src'], x['w']) for x in v)
        rev = ' data-rev="%s" data-rev-set="%s"' % (esc(v[-1]['src']), esc(conjunto))
    return f'''<article class="pieza" data-id="{esc(p['id'])}"
      data-ocasion="{esc(' '.join(p.get('ocasion') or []))}" data-color="{esc(p['color'])}"
      data-largo="{esc(p.get('largo') or '')}" data-tela="{esc(p.get('tela') or '')}"{rev}>
    <a class="pieza-boton" href="{esc(f1['origen'])}" data-abre="{esc(p['id'])}">
      <span class="pieza-foto">
        {img(f1, SIZES_REJILLA, alt_de(p), 'class="frente"', ya)}
      </span>
      <span class="pieza-pie">
        <span class="nombre">{esc(p['nombre'])}</span>
        <span class="meta">{esc(meta)}</span>
        {precio}
      </span>
    </a>
  </article>'''

def figura_look(l, i):
    return f'''<figure style="--i:{i % 4}">
      <a href="{esc(l['origen'])}" target="_blank" rel="noopener" aria-label="Ver esta foto en el Instagram de SOFIBÉL">
        {img(l, '(min-width:52rem) 23vw, 46vw', l['alt'])}
      </a>
    </figure>'''

def figura_reel(r):
    return f'''<figure class="reel" data-code="{esc(r['code'])}" data-mp4="{esc(r['mp4'])}">
      <div class="lienzo">
        <img data-src="{esc(r['poster'])}" width="720" height="1280" decoding="async" alt="{esc(r['alt'])}">
        <noscript><img src="{esc(r['poster'])}" width="720" height="1280" loading="lazy" decoding="async" alt="{esc(r['alt'])}"></noscript>
        <video muted loop playsinline preload="none" aria-label="{esc(r['alt'])}"></video>
        <button class="reel-play" type="button" aria-label="Reproducir: {esc(r['titulo'])}">
          <span><svg class="icono" aria-hidden="true"><use href="#i-play"></use></svg></span></button>
      </div>
      <figcaption>{esc(r['titulo'])}</figcaption>
    </figure>'''

def chip_ocasion(o, n):
    return (f'<button class="chip" type="button" aria-pressed="false" data-f="ocasion" '
            f'data-v="{esc(o["id"])}">{esc(o["nombre"])}</button>')

def mete(doc, marca, contenido):
    """Reemplaza lo que haya entre <!--MARCA--> y <!--/MARCA-->."""
    patron = re.compile(r'(<!--%s-->).*?(<!--/%s-->)' % (marca, marca), re.S)
    if not patron.search(doc):
        raise SystemExit(f'no encontre el marcador {marca} en index.html')
    return patron.sub(lambda m: m.group(1) + '\n' + contenido + '\n      ' + m.group(2), doc)

def main():
    d = json.load(open(os.path.join(ROOT, 'data', 'vestidos.json'), encoding='utf-8'))
    try:
        rl = json.load(open(os.path.join(ROOT, 'data', 'reels.json'), encoding='utf-8'))['reels']
    except Exception:
        rl = []
    doc = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

    doc = mete(doc, 'CATALOGO', '\n'.join(tarjeta(p, i) for i, p in enumerate(d['vestidos'])))
    doc = mete(doc, 'ACCESORIOS', '\n'.join(tarjeta(p, 99) for p in d['accesorios']))
    doc = mete(doc, 'LOOKBOOK', '\n'.join(figura_look(l, i) for i, l in enumerate(d['lookbook'])))
    doc = mete(doc, 'REELS', '\n'.join(figura_reel(r) for r in rl))

    # chips de ocasión: se escriben aquí para que la fila no aparezca vacía
    usadas = [o for o in d['ocasiones']
              if any(o['id'] in (v.get('ocasion') or []) for v in d['vestidos'])]
    chips = ('<button class="chip" type="button" aria-pressed="true" data-f="ocasion" data-v="">Todos</button>\n'
             + '\n'.join(chip_ocasion(o, 0) for o in usadas))
    doc = mete(doc, 'CHIPS', chips)

    # los datos, en línea: la ficha del cajón los necesita y así no hay un fetch
    # más que pueda fallar. Se escapa < para que nada pueda cerrar el <script>.
    # Se van las rutas de las fotos: la ficha clona las imagenes que ya estan en la
    # tarjeta, asi que repetirlas aqui eran 15 KB de HTML por nada.
    liviano = json.loads(json.dumps(d))
    for grupo in ('vestidos', 'accesorios'):
        for it in liviano[grupo]:
            it['fotos'] = [{'origen': f['origen']} for f in it['fotos']]
    for l in liviano['lookbook']:
        l.pop('variantes', None)
    crudo = json.dumps(liviano, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    doc = mete(doc, 'DATOS', f'<script type="application/json" id="datos-sofibel">{crudo}</script>')

    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(doc)
    kb = len(doc) / 1024
    print(f"index.html reescrito: {len(d['vestidos'])} vestidos, {len(d['accesorios'])} accesorios, "
          f"{len(d['lookbook'])} lookbook, {len(rl)} reels")
    print(f"pesa {kb:.0f} KB (con los datos en línea, que sustituyen una petición de "
          f"{len(crudo)/1024:.0f} KB)")

if __name__ == '__main__':
    main()
