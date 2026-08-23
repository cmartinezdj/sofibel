#!/usr/bin/env python3
"""Construye el catalogo del sitio a partir de las fotos reales de @sofibelmx.

Recorta cada foto a 2:3 (retrato de vestido), exporta webp en 3 anchos y escribe
data/vestidos.json. Los campos de precio y talla se dejan en null a proposito:
no hay dato publico y el sitio los muestra solo cuando existen.

Uso:  python3 tools/build_catalogo.py
"""
import json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'images', 'posts')
OUT  = os.path.join(ROOT, 'images', 'vestidos')
ANCHOS = (420, 720, 1080)
RATIO  = 2 / 3          # ancho / alto

# ---------------------------------------------------------------- catalogo
# foto: (archivo, focus_x, focus_y)  focus en 0..1 sobre la imagen original
V = [
 dict(id='azul-rey-cruzado', nombre='Azul rey, escote cruzado',
      color='Azul rey', colorHex='#1E3FA8', largo='Largo', tela='Satín',
      detalle='Escote cruzado, tirantes finos y abertura lateral.',
      ocasion=['noche','graduacion','dia'],
      fotos=[('DXcl1MqlMDS-1.jpg',.5,.42),('DXcl1MqlMDS-2.jpg',.5,.42),('DXcl1MqlMDS-3.jpg',.5,.45)],
      caption='Vestido ideal para eventos de día o de noche.'),
 dict(id='verde-esmeralda-tul', nombre='Verde esmeralda en tul',
      color='Verde esmeralda', colorHex='#0B6B4F', largo='Largo', tela='Tul',
      detalle='Escote en V profundo, falda de tul con doble abertura.',
      ocasion=['noche','graduacion'],
      fotos=[('Day00i0BYo8-1.jpg',.5,.44)],
      caption='El vestido y la bolsa son de Sofibél.'),
 dict(id='menta-lentejuela', nombre='Menta con corpiño de lentejuela',
      color='Menta', colorHex='#8FE3C8', largo='Largo', tela='Lentejuela',
      detalle='Corpiño de lentejuela y falda de gasa plisada.',
      ocasion=['xv','graduacion','dia'],
      fotos=[('DcKWiMKsfFx-1.jpg',.5,.44)],
      caption='El vestido y color ideal para esta temporada.'),
 dict(id='terracota-halter', nombre='Terracota satinado, halter',
      color='Terracota', colorHex='#B65A2B', largo='Largo', tela='Satín',
      detalle='Halter con espalda descubierta y caída fluida.',
      ocasion=['noche','boda'],
      fotos=[('DYikSvXvkyq-1.jpg',.5,.42)],
      caption='Ese brillo satinado bajo las luces. Vestido terracota disponible en Sofibél.'),
 dict(id='terracota-drapeado', nombre='Terracota de cuello drapeado',
      color='Terracota', colorHex='#C0632F', largo='Largo', tela='Satín',
      detalle='Cuello drapeado, tirantes de lazo y abertura al frente.',
      ocasion=['noche','boda'],
      fotos=[('Dbre6V6tpPk-1.jpg',.5,.45)]),
 dict(id='naranja-un-hombro', nombre='Naranja de un hombro',
      color='Naranja', colorHex='#F0602B', largo='Largo', tela='Satín',
      detalle='Un hombro, cintura fruncida y corte sirena.',
      ocasion=['noche','boda'],
      fotos=[('DaeF2J6P32r-1.jpg',.5,.46)],
      caption='El vestido perfecto te está esperando.'),
 dict(id='fucsia-halter', nombre='Fucsia satinado, halter',
      color='Fucsia', colorHex='#C4166B', largo='Largo', tela='Satín',
      detalle='Halter cruzado con abertura lateral alta.',
      ocasion=['noche'],
      fotos=[('Dbo2qKnRTpD-1.jpg',.5,.42)],
      caption='Nos encanta ser parte de cada uno de sus eventos.'),
 dict(id='morado-hombros-caidos', nombre='Morado de hombros caídos',
      color='Morado', colorHex='#5B2A78', largo='Largo', tela='Crepé',
      detalle='Hombros caídos, drapeado al talle y pedrería lateral.',
      ocasion=['boda','noche'],
      fotos=[('DawP7I0OnXe-1.jpg',.5,.40)],
      caption='Amamos verlas brillar en sus eventos.'),
 dict(id='azul-un-hombro', nombre='Azul rey de un hombro',
      color='Azul rey', colorHex='#26489E', largo='Largo', tela='Satín',
      detalle='Un hombro con drapeado al talle y abertura lateral.',
      ocasion=['noche','graduacion'],
      fotos=[('DaJqe7zPO5C-1.jpg',.5,.45)],
      caption='Blue never looked this good.'),
 dict(id='vino-midi-manga', nombre='Vino midi de manga suelta',
      color='Vino', colorHex='#7E1F45', largo='Midi', tela='Crepé',
      detalle='Manga suelta, talle a la cintura y falda amplia.',
      ocasion=['dia','boda'],
      fotos=[('DamDbQjnJcz-1.jpg',.5,.45),('DamDbQjnJcz-2.jpg',.5,.45)],
      caption='El vestido ideal para cualquier ocasión.'),
 dict(id='verde-olivo-halter', nombre='Verde olivo, halter',
      color='Verde olivo', colorHex='#6B6B23', largo='Largo', tela='Satín',
      detalle='Halter de escote profundo y espalda descubierta.',
      ocasion=['noche','boda'],
      fotos=[('DY3NX-MlMi--2.jpg',.5,.40),('DY3NX-MlMi--3.jpg',.55,.42)],
      caption='Mom & daughter wearing SOFIBÉL.'),
 dict(id='negro-plisado-halter', nombre='Negro plisado, halter',
      color='Negro', colorHex='#141414', largo='Largo', tela='Plisado',
      detalle='Halter plisado con escote en V y abertura frontal.',
      ocasion=['noche'],
      fotos=[('DY3NX-MlMi--1.jpg',.30,.40)]),
 dict(id='bronce-lentejuela-midi', nombre='Bronce de lentejuela, midi',
      color='Bronce', colorHex='#7A4B2A', largo='Midi', tela='Lentejuela',
      detalle='Midi de lentejuela con manga larga y lazo al talle.',
      ocasion=['boda','noche'],
      fotos=[('DYdkiA0nGME-1.jpg',.5,.44)],
      caption='Amamos verlas brillar.'),
 dict(id='champagne-espalda', nombre='Champagne de espalda descubierta',
      color='Champagne', colorHex='#C8A98A', largo='Largo', tela='Satín',
      detalle='Espalda descubierta con tirantes cruzados y cola suave.',
      ocasion=['noche','boda'],
      fotos=[('DYVy2gLyi1x-1.jpg',.5,.46)],
      caption='EL vestido que amarás ya está en SOFIBÉL.'),
 dict(id='azul-marino-encaje', nombre='Azul marino con encaje',
      color='Azul marino', colorHex='#1B2A4A', largo='Largo', tela='Encaje',
      detalle='Manga larga de encaje, escote en V y falda cruzada.',
      ocasion=['noche','boda'],
      fotos=[('DYQihG1J62V-1.jpg',.5,.40)],
      caption='Mangas largas más brillos, la combinación más classy del momento.'),
 dict(id='rojo-olanes-sirena', nombre='Rojo con olanes, corte sirena',
      color='Rojo', colorHex='#B3121C', largo='Largo', tela='Satín',
      detalle='Corte sirena con cascada de olanes y escote corazón.',
      ocasion=['noche','xv'],
      fotos=[('DYN_uxMN0HE-1.jpg',.42,.42)],
      caption='Amamos verlas brillar.'),
 dict(id='rojo-hombros-caidos', nombre='Rojo de hombros caídos',
      color='Rojo', colorHex='#C21D24', largo='Largo', tela='Satín',
      detalle='Hombros caídos y espalda abierta con lazo.',
      ocasion=['noche','graduacion'],
      fotos=[('DYDnAcIBK_D-1.jpg',.5,.42)],
      caption='NEW ARRIVAL. Ven a rentarlo ya.'),
 dict(id='verde-esmeralda-maxi', nombre='Verde esmeralda, maxi de gasa',
      color='Verde esmeralda', colorHex='#0E7A55', largo='Largo', tela='Gasa',
      detalle='Escote en V, tirantes anchos y falda amplia de gasa.',
      ocasion=['dia','boda'],
      fotos=[('DX-mVjhlF_h-2.jpg',.6,.42)],
      caption='Guapísima.'),
 dict(id='rojo-halter-abertura', nombre='Rojo halter con abertura',
      color='Rojo', colorHex='#D81E1E', largo='Largo', tela='Satín',
      detalle='Halter con escote cruzado y abertura lateral.',
      ocasion=['noche','xv'],
      fotos=[('DX7mVDPBpnv-1.jpg',.5,.42)]),
 dict(id='rojo-halter-cruzado', nombre='Rojo halter cruzado',
      color='Rojo', colorHex='#E02020', largo='Largo', tela='Satín',
      detalle='Halter cruzado al frente con falda recta.',
      ocasion=['noche'],
      fotos=[('DXngEKzj-Si-1.jpg',.5,.44)],
      caption='Ya llegó el vestido de la temporada.'),
 dict(id='fucsia-manga-larga', nombre='Fucsia de manga larga',
      color='Fucsia', colorHex='#BE1E6E', largo='Largo', tela='Satín',
      detalle='Manga larga, escote corazón y corte sirena.',
      ocasion=['noche','xv'],
      fotos=[('DXvKHCQP5PU-1.jpg',.5,.44)],
      caption='EL vestido soñado. Ven a Sofibél y réntalo ya.'),
 dict(id='negro-drapeado', nombre='Negro drapeado con abertura',
      color='Negro', colorHex='#17171A', largo='Largo', tela='Satín',
      detalle='Drapeado al cuerpo, un hombro y abertura lateral.',
      ocasion=['noche'],
      fotos=[('DXsh-6WFIWL-1.jpg',.45,.44),('DXsh-6WFIWL-2.jpg',.5,.44)],
      caption='Amamos verlas brillar.'),
 dict(id='vino-manga-lazo', nombre='Vino de manga larga con lazo',
      color='Vino', colorHex='#7C1226', largo='Largo', tela='Satín',
      detalle='Manga larga, cuello alto y lazo drapeado al talle.',
      ocasion=['noche','boda'],
      fotos=[('DZGuiY4lNdL-1.jpg',.5,.44),('DZGuiY4lNdL-2.jpg',.5,.44)],
      caption='Nos encanta ser parte de sus eventos.'),
 dict(id='magenta-abertura', nombre='Magenta satinado con abertura',
      color='Magenta', colorHex='#B5185F', largo='Largo', tela='Satín',
      detalle='Escote asimétrico y abertura lateral alta.',
      ocasion=['noche'],
      fotos=[('DZEE_E0SOWt-1.jpg',.5,.46)],
      caption='El vestido soñado.'),
 dict(id='rosa-mexicano-tul', nombre='Rosa mexicano, tul de capas',
      color='Rosa mexicano', colorHex='#DE2170', largo='Largo', tela='Tul',
      detalle='Strapless con falda de capas de tul.',
      ocasion=['xv','graduacion','boda'],
      fotos=[('DZlrDj_jHdM-3.jpg',.5,.42)],
      caption='Friends wearing SOFIBÉL.'),
 dict(id='azul-marino-olanes', nombre='Azul marino de un hombro con olanes',
      color='Azul marino', colorHex='#1F2B45', largo='Largo', tela='Satín',
      detalle='Un hombro con olán en cascada y abertura.',
      ocasion=['noche','boda'],
      fotos=[('DZTlvr6lKmt-2.jpg',.62,.42),('DZTlvr6lKmt-3.jpg',.5,.42)],
      caption='Amamos verlas brillar.'),
 dict(id='verde-olivo-satin', nombre='Verde olivo satinado',
      color='Verde olivo', colorHex='#77762F', largo='Largo', tela='Satín',
      detalle='Escote drapeado, tirantes finos y abertura lateral.',
      ocasion=['dia','noche'],
      fotos=[('DZ8wsdcsYUm-1.jpg',.5,.46)],
      caption='Los colores más usados para esta temporada.'),
]

A = [
 dict(id='clutch-dorado-tejido', nombre='Clutch dorado tejido',
      color='Dorado', colorHex='#C9A227', tipo='Bolsa de mano',
      detalle='Tejido de esferas doradas con asa de mano.',
      fotos=[('DcPotrfnNJL-1.jpg',.5,.5)]),
 dict(id='clutch-fucsia-plisado', nombre='Clutch fucsia plisado',
      color='Fucsia', colorHex='#B4185C', tipo='Clutch',
      detalle='Plisado en satín con cierre de solapa.',
      fotos=[('DcPotrfnNJL-2.jpg',.5,.5)]),
 dict(id='clutch-negro-brillos', nombre='Clutch negro con brillos',
      color='Negro', colorHex='#161616', tipo='Clutch',
      detalle='Tejido con hilo brillante y solapa curva.',
      fotos=[('DcPotrfnNJL-3.jpg',.5,.5)]),
 dict(id='clutch-plata-pedreria', nombre='Clutch plata con pedrería',
      color='Plata', colorHex='#B9BDC4', tipo='Clutch',
      detalle='Satín plisado con orilla de pedrería.',
      fotos=[('DcPotrfnNJL-4.jpg',.5,.5)]),
 dict(id='clutch-verde-terciopelo', nombre='Clutch verde en terciopelo',
      color='Verde esmeralda', colorHex='#0B5B44', tipo='Clutch',
      detalle='Terciopelo con nudo al centro.',
      fotos=[('DcPotrfnNJL-5.jpg',.5,.5)]),
 dict(id='clutch-champagne-mono', nombre='Clutch champagne con moño',
      color='Champagne', colorHex='#C3A481', tipo='Clutch',
      detalle='Satín con moño al frente.',
      fotos=[('DcPotrfnNJL-6.jpg',.5,.5)]),
]

# Fotos de clientas en sus eventos. Sin las piezas de campaña con texto
# sobreimpreso: aquí la sección promete clientas reales, no publicidad.
LOOK = [
 ('DbE_s6tOAG8-1.jpg', .5,.42, 'Dos invitadas en una boda de jardín, una en terracota satinado y otra en negro con espalda de tiras.'),
 ('DZ3vaZ_nNKO-1.jpg', .5,.42, 'Dos amigas de gala, una en vino y otra en verde botella.'),
 ('DZ3vaZ_nNKO-2.jpg', .5,.42, 'Dos amigas en un jardín, vestidos largos en rosa y verde.'),
 ('DZlrDj_jHdM-1.jpg', .5,.44, 'Grupo de invitados en una boda, vestidos largos en rosa mexicano y estampado.'),
 ('DYvh1-qlFN4-1.jpg', .5,.42, 'Dos invitadas en vestidos largos vino y color topo.'),
 ('DYvh1-qlFN4-2.jpg', .5,.42, 'Dos amigas en una fiesta, vestidos largos en vino y café.'),
 ('DZTlvr6lKmt-1.jpg', .5,.42, 'Pareja en un jardín, vestido azul marino de un hombro con olanes.'),
 ('DX-mVjhlF_h-1.jpg', .5,.44, 'Pareja en una terraza con palmeras, vestido verde esmeralda maxi.'),
 ('DYN_uxMN0HE-1.jpg', .5,.42, 'Pareja de gala, vestido rojo de olanes con corte sirena.'),
 ('DY3NX-MlMi--4.jpg', .5,.42, 'Madre e hija en vestidos halter negro y verde olivo.'),
 ('DYdkiA0nGME-2.jpg', .5,.44, 'Invitada en una boda con vestido midi de lentejuela bronce.'),
 ('DZlrDj_jHdM-2.jpg', .55,.44, 'Pareja en una boda, vestido largo rosa mexicano de tul en capas.'),
]

# Recortes especiales que no son ficha de producto. Viven aquí para que no se
# borren cuando el script limpia images/vestidos/ al empezar.
EXTRAS = [
 # (archivo, x0, y0, x1, y1, slug)  recorte manual en píxeles de la foto original
 ('Db6nJ0NFJEI-1.jpg', 95, 380, 742, 1350, 'manifiesto-1'),
]

def crop_23(im, fx, fy):
    w, h = im.size
    if w / h > RATIO:                     # demasiado ancho -> recortar ancho
        nw = int(round(h * RATIO)); nh = h
    else:                                 # demasiado alto -> recortar alto
        nw = w; nh = int(round(w / RATIO))
    x = min(max(int(round(fx * w - nw / 2)), 0), w - nw)
    y = min(max(int(round(fy * h - nh / 2)), 0), h - nh)
    return im.crop((x, y, x + nw, y + nh))

def export(archivo, fx, fy, slug, i):
    src = os.path.join(SRC, archivo)
    im = crop_23(Image.open(src).convert('RGB'), fx, fy)
    out = []
    for a in ANCHOS:
        if a > im.width * 1.06 and a != ANCHOS[0]:
            continue
        r = im.resize((a, int(round(a / RATIO))), Image.LANCZOS)
        f = f'{slug}-{i}-{a}.webp'
        r.save(os.path.join(OUT, f), 'WEBP', quality=80, method=6)
        out.append({'w': a, 'src': f'images/vestidos/{f}',
                    'kb': round(os.path.getsize(os.path.join(OUT, f)) / 1024)})
    return out

def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.webp'): os.remove(os.path.join(OUT, f))

    def build(items, kind):
        salida = []
        for it in items:
            fotos = []
            for i, (arch, fx, fy) in enumerate(it['fotos'], 1):
                fotos.append({'variantes': export(arch, fx, fy, it['id'], i),
                              'origen': f'https://www.instagram.com/p/{arch.split("-")[0]}/'})
            e = {k: v for k, v in it.items() if k != 'fotos'}
            e['tipoItem'] = kind
            e['fotos'] = fotos
            # campos que solo la dueña puede llenar; el sitio los muestra si existen
            e.setdefault('precioRenta', None)
            e.setdefault('precioVenta', None)
            e.setdefault('valorVestido', None)
            e.setdefault('tallas', None)
            e.setdefault('disponible', True)
            salida.append(e)
            print(f"  {e['id']:28s} {len(fotos)} foto(s)  {sum(len(f['variantes']) for f in fotos)} webp")
        return salida

    print('Extras:')
    for arch, x0, y0, x1, y1, slug in EXTRAS:
        im = Image.open(os.path.join(SRC, arch)).convert('RGB').crop((x0, y0, x1, y1))
        for a in (420, 720):
            im.resize((a, int(round(a / RATIO))), Image.LANCZOS).save(
                os.path.join(OUT, f'{slug}-{a}.webp'), 'WEBP', quality=82, method=6)
        print(f'  {slug}  {im.size}')

    print('Vestidos:'); vestidos = build(V, 'vestido')
    print('Accesorios:'); accesorios = build(A, 'accesorio')
    print('Lookbook:')
    look = []
    for i, (arch, fx, fy, alt) in enumerate(LOOK, 1):
        look.append({'id': f'look-{i:02d}', 'alt': alt,
                     'variantes': export(arch, fx, fy, 'look', i),
                     'origen': f'https://www.instagram.com/p/{arch.split("-")[0]}/'})
        print(f"  look-{i:02d}  {arch}")

    data = {
      'generado': 'tools/build_catalogo.py',
      'nota': ('Fotos públicas de @sofibelmx recortadas a 2:3. precioRenta, precioVenta, '
               'valorVestido y tallas están en null porque no hay dato público: llénalos y '
               'el sitio los muestra solo. Vuelve a correr el script si cambias las fotos.'),
      'ocasiones': [
        {'id': 'noche',      'nombre': 'Noche y gala'},
        {'id': 'graduacion', 'nombre': 'Graduación'},
        {'id': 'xv',         'nombre': 'XV años'},
        {'id': 'boda',       'nombre': 'Boda de invitada'},
        {'id': 'dia',        'nombre': 'Evento de día'},
      ],
      'vestidos': vestidos, 'accesorios': accesorios, 'lookbook': look,
    }
    with open(os.path.join(ROOT, 'data', 'vestidos.json'), 'w') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    total = sum(1 for f in os.listdir(OUT) if f.endswith('.webp'))
    peso = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) / 1048576
    print(f"\n{len(vestidos)} vestidos, {len(accesorios)} accesorios, {len(look)} lookbook")
    print(f"{total} webp, {peso:.1f} MB en images/vestidos/")

if __name__ == '__main__':
    main()
