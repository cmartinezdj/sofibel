#!/usr/bin/env python3
"""Comprime los reels de @sofibelmx a loops web y saca su poster en WebP.

Los originales viven en videos/ (94 MB) y NO se publican: quedan fuera del repo
por .gitignore. Aqui se generan videos/web/*.mp4 (h264, 720 de ancho, sin audio,
para autoplay silencioso) y su poster.

Uso:  python3 tools/build_videos.py
"""
import os, subprocess, json, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'videos')
OUT  = os.path.join(SRC, 'web')

# reel -> (titulo, texto alternativo). Seleccion curada, no los 16.
REELS = [
 ('DYlGdEAiy40', 'Tu graduación',
  'Reel de graduación: varias clientas posando con vestidos largos de SOFIBÉL.'),
 ('DYVy2gLyi1x', 'El vestido que amarás',
  'Reel de un vestido largo champagne con la espalda descubierta, girando.'),
 ('DYDnAcIBK_D', 'Nuevo en el showroom',
  'Reel de un vestido rojo de hombros caidos recien llegado al showroom.'),
 ('DcKWiMKsfFx', 'El color de la temporada',
  'Reel de un vestido menta con corpiño de lentejuela a la luz del día.'),
 ('Day00i0BYo8', 'Vestido y bolsa',
  'Reel de un vestido verde esmeralda de tul con clutch a juego.'),
 ('DaeF2J6P32r', 'Naranja de un hombro',
  'Reel de un vestido naranja de un hombro con corte sirena.'),
]

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print('  ERROR', ' '.join(cmd[:6]), r.stderr[-400:]); return False
    return True

def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for code, titulo, alt in REELS:
        src = os.path.join(SRC, f'{code}.mp4')
        if not os.path.exists(src):
            print('  falta', code); continue
        mp4 = os.path.join(OUT, f'{code}.mp4')
        jpg = os.path.join(OUT, f'{code}.jpg')
        webp = os.path.join(OUT, f'{code}.webp')
        ok = run(['ffmpeg','-y','-loglevel','error','-i',src,
                  '-vf','scale=720:-2:flags=lanczos','-an',
                  '-c:v','libx264','-profile:v','high','-crf','30','-preset','slow',
                  '-pix_fmt','yuv420p','-movflags','+faststart','-r','30', mp4])
        if not ok: continue
        run(['ffmpeg','-y','-loglevel','error','-i',src,'-vf',
             'scale=720:-2:flags=lanczos','-frames:v','1','-q:v','3', jpg])
        # poster en webp (mas ligero, es el elemento visible antes de reproducir)
        from PIL import Image
        Image.open(jpg).convert('RGB').save(webp,'WEBP',quality=78,method=6)
        os.remove(jpg)
        dur = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration',
                              '-of','default=nw=1:nk=1',mp4],capture_output=True,text=True).stdout.strip()
        manifest.append({'code':code,'titulo':titulo,'alt':alt,
                         'mp4':f'videos/web/{code}.mp4','poster':f'videos/web/{code}.webp',
                         'segundos':round(float(dur)) if dur else None,
                         'instagram':f'https://www.instagram.com/reel/{code}/',
                         'kb':round(os.path.getsize(mp4)/1024)})
        print(f"  {code}  {manifest[-1]['kb']:5d} KB  {manifest[-1]['segundos']}s  {titulo}")
    with open(os.path.join(ROOT,'data','reels.json'),'w') as fh:
        json.dump({'nota':'Reels publicos de @sofibelmx, recomprimidos sin audio para loop en el sitio.',
                   'reels':manifest}, fh, ensure_ascii=False, indent=1)
    tot = sum(m['kb'] for m in manifest)
    print(f"\n{len(manifest)} reels, {tot/1024:.1f} MB en videos/web/")

if __name__ == '__main__':
    main()
