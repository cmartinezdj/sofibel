#!/usr/bin/env python3
"""Mete assets/icons.svg dentro de index.html, en lugar del marcador <!--SPRITE-->.

El sprite va en linea a proposito: un <use href="archivo.svg#id"> externo falla
en file:// y ahorra una peticion inutil para 18 KB. Si vuelves a generar el
sprite, corre este script otra vez; es idempotente.
"""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
sprite = open(os.path.join(ROOT, 'assets', 'icons.svg'), encoding='utf-8').read().strip()
bloque = ('<!--SPRITE-->\n' + sprite + '\n<!--/SPRITE-->')
if '<!--/SPRITE-->' in html:
    html = re.sub(r'<!--SPRITE-->.*?<!--/SPRITE-->', lambda m: bloque, html, flags=re.S)
elif '<!--SPRITE-->' in html:
    html = html.replace('<!--SPRITE-->', bloque)
else:
    raise SystemExit('no encontre el marcador <!--SPRITE--> en index.html')
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(html)
print('sprite en linea:', len(sprite) // 1024, 'KB,', sprite.count('<symbol'), 'iconos')
