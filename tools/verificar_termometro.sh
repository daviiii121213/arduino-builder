#!/usr/bin/env bash
# Confere o motor (assets/js/termometro.js) contra a planilha oficial recalculada pelo LibreOffice.
# Requer: python3 + openpyxl, LibreOffice (soffice) e Node.js.
# Uso: bash tools/verificar_termometro.sh
set -euo pipefail
cd "$(dirname "$0")/.."
T="$(mktemp -d)"
mkdir -p "$T/in" "$T/out"
python3 - "$T" <<'PY'
import sys, json, random, openpyxl
T = sys.argv[1]; random.seed(7)
src = 'tools/Planilha_Completa_Questionario_Projeto_Genesis_V4.xlsx'
cods = [openpyxl.load_workbook(src)['Questionário Quantitativo'][f'A{r}'].value for r in range(5, 25)]
casos = [{c: v for c, v in zip(cods, [9] * 17 + [7, 5, 6])}]
casos += [{c: v for c in cods} for v in range(11)]
casos += [{c: random.randint(0, 10) for c in cods} for _ in range(40)]
casos += [{c: random.choice([2, 3, 5, 6, 7, 8]) for c in cods} for _ in range(10)]
for a in range(11):
    for b in range(11):
        for c in range(11):
            g = (a * 1.5 + b * 1.2 + c * 1.2) / 3.9
            if min(abs(g - 5.5), abs(g - 8), abs(g - 3)) < 1e-9:
                d = {k: 5 for k in cods}; d.update({'A1': a, 'A2': b, 'A3': c}); casos.append(d)
json.dump(casos, open(f'{T}/casos.json', 'w'))
for i, cs in enumerate(casos):
    wb = openpyxl.load_workbook(src); ws = wb['Questionário Quantitativo']
    for r in range(5, 25): ws[f'E{r}'] = cs[ws[f'A{r}'].value]
    wb.save(f'{T}/in/caso{i:03d}.xlsx')
PY
(cd "$T/in" && soffice --headless --calc --convert-to xlsx --outdir "$T/out" caso*.xlsx >/dev/null 2>&1)
python3 - "$T" <<'PY'
import sys, json, glob, re, openpyxl
T = sys.argv[1]; out = []
strip = lambda s: re.sub(r'^[^\wÀ-ÿ]+', '', s).strip()
for f in sorted(glob.glob(f'{T}/out/caso*.xlsx')):
    wb = openpyxl.load_workbook(f, data_only=True); q = wb['Questionário Quantitativo']; l = wb['Laudo & Plano de Tratamento']
    out.append({'E25': q['E25'].value, 'F25': q['F25'].value, 'G25': q['G25'].value,
                'G': [q[f'G{r}'].value for r in range(5, 25)],
                'pil': [{'C': l[f'C{r}'].value, 'D': l[f'D{r}'].value, 'E': l[f'E{r}'].value, 'F': strip(l[f'F{r}'].value), 'G': l[f'G{r}'].value} for r in range(6, 11)],
                'mat': [{'B': l[f'B{r}'].value, 'G': l[f'G{r}'].value} for r in range(15, 21)]})
json.dump(out, open(f'{T}/planilha.json', 'w'), ensure_ascii=False)
PY
node tools/comparar_com_planilha.js "$T"
