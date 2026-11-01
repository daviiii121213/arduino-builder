#!/usr/bin/env python3
"""Reconstrói os apps Planta 3D a partir de src/.

  planta-3d.html          versão online (bibliotecas via CDN; é o conteúdo do artefato no claude.ai)
  planta-3d-offline.html  mesma página com todas as bibliotecas embutidas (inclusive pdf.js)

As bibliotecas do offline vêm do npm, nas mesmas versões das URLs de CDN:
  npm i --prefix .lib three@0.147.0 fflate@0.8.2 jspdf@2.5.1 pdfjs-dist@3.11.174
Uso: python3 build.py [pasta node_modules]   (padrão: .lib/node_modules)
"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
NM = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '.lib', 'node_modules')
rd = lambda p: open(os.path.join(SRC, p), encoding='utf-8').read()

def once(s, old, new):
    assert s.count(old) == 1, 'âncora não encontrada (ou repetida): ' + old[:60]
    return s.replace(old, new)

base = rd('planta-3d.base.html')
s = base
s = once(s, '</style>\n\n<div id="stage">', rd('pdf-import.css') + rd('home.css') + '</style>\n\n<div id="stage">')
s = once(s, '<div id="walkhud" hidden>', rd('pdf-import.html') + rd('home.html') + '<div id="walkhud" hidden>')
s = once(s, '<input id="ed-imp" type="file" accept=".json,application/json" hidden>',
         '<input id="ed-imp" type="file" accept=".json,application/json" hidden><label class="chip" for="pi-input">Importar PDF</label>')
s = once(s, '<button id="p2-pdf" class="chip">Exportar PDF 1:50</button>',
         '<button id="p2-pdf" class="chip">Exportar PDF 1:50</button><label class="chip" for="pi-input">Importar PDF</label>')
s = once(s, '<button id="v-both" aria-pressed="true">Lado a lado</button>', '<button id="v-home" aria-pressed="false">Início</button><span class="sep"></span><button id="v-both" aria-pressed="true">Lado a lado</button>')
s = once(s, '<script>\n// Wall cross-sections', '<script>\n' + rd('pdf-import-core.js') + '</script>\n<script>\n// Wall cross-sections')
i = s.rindex('})();\n</script>')
s = s[:i] + rd('pdf-import-ui.js') + rd('home-ui.js') + s[i:]
open(os.path.join(HERE, 'planta-3d.html'), 'w', encoding='utf-8').write(s)

# ---- offline ----
MAP = [('https://cdn.jsdelivr.net/npm/three@0.147.0/', 'three/'), ('https://cdn.jsdelivr.net/npm/fflate@0.8.2/', 'fflate/'),
       ('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/', 'jspdf/dist/')]
def lib(url):
    for pre, d in MAP:
        if url.startswith(pre):
            return open(os.path.join(NM, d + url[len(pre):]), encoding='utf-8').read()
    raise SystemExit('sem cópia local para ' + url)
def inline(code):
    assert '</script' not in code.lower(), 'o código contém </script>'
    return '<script>\n' + code + '\n</script>'
off = re.sub(r'<script src="([^"]+)"></script>', lambda m: inline(lib(m.group(1))), s)
pdfjs = inline(open(os.path.join(NM, 'pdfjs-dist/build/pdf.min.js'), encoding='utf-8').read()) + '\n' + \
        inline(open(os.path.join(NM, 'pdfjs-dist/build/pdf.worker.min.js'), encoding='utf-8').read()) + '\n'
off = once(off, '<script>\n/* Planta 3D – Importador', pdfjs + '<script>\n/* Planta 3D – Importador')
head = ('<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<style>[hidden]{display:none!important}body{margin:0}</style></head><body>\n')
open(os.path.join(HERE, 'planta-3d-offline.html'), 'w', encoding='utf-8').write(head + off + '\n</body></html>')
print('planta-3d.html', len(s.encode()), 'bytes · planta-3d-offline.html', len((head + off).encode()), 'bytes')
