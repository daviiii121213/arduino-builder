"""Gera assets/js/termometro-dados.js a partir da planilha oficial do Projeto Gênesis.

Uso: python3 tools/gerar_termometro.py
Lê tools/Planilha_Completa_Questionario_Projeto_Genesis_V4.xlsx e copia, sem reescrever,
os textos, pesos e faixas das abas "Questionário Quantitativo" e "Laudo & Plano de Tratamento".
"""
import json
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "tools" / "Planilha_Completa_Questionario_Projeto_Genesis_V4.xlsx"
OUT = ROOT / "assets" / "js" / "termometro-dados.js"

wb = openpyxl.load_workbook(XLSX)
q = wb["Questionário Quantitativo"]
l = wb["Laudo & Plano de Tratamento"]


def textos_if(formula):
    """Strings de uma fórmula IF aninhada, na ordem em que aparecem."""
    return re.findall(r'"((?:[^"]|"")*)"', formula)


def faixas(formula):
    """Limites numéricos de uma fórmula IF aninhada (ex.: 8, 5.5, 3)."""
    return [float(x) for x in re.findall(r">=\s*([0-9.]+)", formula)]


def topicos(texto):
    return [t.strip().lstrip("•").strip() for t in texto.split("\n") if t.strip()]


def sem_emoji(texto):
    return re.sub(r"^[^\wÀ-ÿ]+", "", texto).strip()


# Questionário: linhas 5 a 24
indicadores = []
for r in range(5, 25):
    indicadores.append({
        "codigo": q[f"A{r}"].value,
        "pilar": q[f"B{r}"].value,
        "dimensao": q[f"C{r}"].value,
        "pergunta": q[f"D{r}"].value,
        "peso": float(q[f"F{r}"].value),
        "linha": r,
    })
for i in indicadores:
    assert q[f"G{i['linha']}"].value == f"=IF(ISBLANK(E{i['linha']}), 0, E{i['linha']}*F{i['linha']})", i

# Pilares: linhas 6 a 9 do laudo; o intervalo de linhas vem da própria fórmula da média simples
pilares = []
for r in range(6, 10):
    ini, fim = map(int, re.search(r"E(\d+):E(\d+)", l[f"C{r}"].value).groups())
    assert l[f"D{r}"].value == f"=SUM('Questionário Quantitativo'!G{ini}:G{fim})/SUM('Questionário Quantitativo'!F{ini}:F{fim})"
    pilares.append({
        "nome": l[f"A{r}"].value,
        "especialistas": l[f"B{r}"].value,
        "codigos": [i["codigo"] for i in indicadores if ini <= i["linha"] <= fim],
        "prescricoes": textos_if(l[f"G{r}"].value),
    })
    assert faixas(l[f"E{r}"].value) == faixas(l[f"F{r}"].value) == faixas(l[f"G{r}"].value) == [8, 5.5, 3]

limites = faixas(l["E6"].value)
temperaturas = textos_if(l["E6"].value)
status = [sem_emoji(s) for s in textos_if(l["F6"].value)]
assert l["C10"].value == "=AVERAGE(C6:C9)" and l["D10"].value == "=AVERAGE(D6:D9)"
igvo = {"nome": l["A10"].value, "responsaveis": l["B10"].value, "prescricoes": textos_if(l["G10"].value)}

# Matriz do plano de tratamento: linhas 15 a 20 (a gravidade de cada linha aponta para um pilar)
mapa_pilar = {"=D6": 0, "=D7": 1, "=D8": 2, "=D9": 3}
matriz = []
for r in range(15, 21):
    assert faixas(l[f"G{r}"].value) == [8, 5.5]
    matriz.append({
        "dimensao": l[f"A{r}"].value,
        "pilar": mapa_pilar[l[f"B{r}"].value],
        "gatilhos": topicos(l[f"C{r}"].value),
        "causas": topicos(l[f"D{r}"].value),
        "beneficios": topicos(l[f"E{r}"].value),
        "conselheiros": topicos(l[f"F{r}"].value),
        "modalidades": textos_if(l[f"G{r}"].value),
    })
limites_matriz = faixas(l["G15"].value)

referencia = []
for r in range(25, 29):
    referencia.append({
        "faixa": l[f"A{r}"].value, "temperatura": l[f"C{r}"].value, "cor": sem_emoji(l[f"D{r}"].value),
        "classificacao": l[f"E{r}"].value, "conduta": l[f"F{r}"].value,
    })

dados = {
    "fonte": XLSX.name,
    "titulo": q["A1"].value,
    "diretriz": q["A2"].value,
    "tituloLaudo": l["A1"].value,
    "conselho": l["A2"].value,
    "indicadores": [{k: v for k, v in i.items() if k != "linha"} for i in indicadores],
    "pilares": pilares,
    "limites": limites,
    "temperaturas": temperaturas,
    "status": status,
    "igvo": igvo,
    "matriz": matriz,
    "limitesMatriz": limites_matriz,
    "referencia": referencia,
}
OUT.write_text(
    "/* Gerado por tools/gerar_termometro.py a partir de " + XLSX.name + ". Não edite à mão. */\n"
    "(function (root) {\n  var DADOS = " + json.dumps(dados, ensure_ascii=False, indent=2).replace("\n", "\n  ")
    + ";\n  if (typeof module === \"object\" && module.exports) module.exports = DADOS;\n  else root.TERMOMETRO_DADOS = DADOS;\n})(this);\n",
    encoding="utf-8",
)
print("ok:", OUT.relative_to(ROOT), "|", len(indicadores), "indicadores,", len(pilares), "pilares,", len(matriz), "dimensões na matriz")
print("limites:", limites, "| limites da matriz:", limites_matriz)
print("status:", status)
