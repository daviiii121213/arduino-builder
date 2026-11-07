/*
 * Termômetro Organizacional Gênesis: apuração do questionário.
 * Reproduz as fórmulas da planilha oficial (Planilha_Completa_Questionario_Projeto_Genesis_V4.xlsx):
 *
 *   Questionário Quantitativo
 *     G (gravidade ponderada) = IF(ISBLANK(nota), 0, nota * peso)
 *     E25 (média simples)     = AVERAGE(notas)
 *     G25 (média ponderada)   = SUM(gravidades) / SUM(pesos)
 *   Laudo & Plano de Tratamento
 *     C (pilar, média simples)        = AVERAGE(notas do pilar)
 *     D (pilar, gravidade ponderada)  = SUM(gravidades do pilar) / SUM(pesos do pilar)
 *     E/F/G (temperatura, status, prescrição) = faixas D >= 8 | >= 5,5 | >= 3 | abaixo
 *     IGVO (V5): C10 = E25 (média simples das 20 notas), D10 = G25 (média ponderada global), com as mesmas faixas
 *     Matriz (V5): gravidade de cada dimensão = SUM(gravidades)/SUM(pesos) das próprias perguntas (B15:B20); modalidade = faixas >= 8 | >= 5,5 | abaixo
 *
 * "Pontos positivos" e "problemas identificados" aplicam a tabela de referência clínica da própria
 * planilha (faixas 0–2,9 / 3,0–5,4 / 5,5–7,9 / 8,0–10) à nota de cada indicador.
 */
(function (root) {
  "use strict";

  var D = typeof module === "object" && module.exports ? require("./termometro-dados.js") : root.TERMOMETRO_DADOS;
  var CORES = ["vermelho", "amarelo", "branco", "verde"];

  // Index of the first threshold the value reaches (0 = most severe); past the last one = healthiest.
  // Like the spreadsheet, the value is compared at 15 significant digits, so 2.9999999999999996 counts as 3.
  function faixa(valor, limites) {
    var v = Number(valor.toPrecision(15));
    for (var i = 0; i < limites.length; i++) if (v >= limites[i]) return i;
    return limites.length;
  }

  function soma(lista) { return lista.reduce(function (a, b) { return a + b; }, 0); }
  function media(lista) { return lista.length ? soma(lista) / lista.length : null; }

  // Rounds like a spreadsheet cell format ("0.0" / "0.00"): half away from zero, after 15 significant digits.
  function arredondar(valor, casas) {
    if (valor === null || valor === undefined || isNaN(valor)) return null;
    var p = Math.pow(10, casas);
    var y = Math.abs(Number((valor * p).toPrecision(15)));
    return (valor < 0 ? -1 : 1) * Math.round(y) / p;
  }

  function formatar(valor, casas) {
    var r = arredondar(valor, casas);
    return r === null ? "—" : r.toFixed(casas).replace(".", ",");
  }

  // "TÍTULO: texto" or "TÍTULO (prazo):\ntexto" -> { titulo, texto }
  function separar(frase) {
    var m = frase.match(/^([^:\n]+):\s*\n?([\s\S]*)$/);
    return m ? { titulo: m[1].trim(), texto: m[2].trim() } : { titulo: "", texto: frase };
  }

  function nivel(valor) {
    var k = faixa(valor, D.limites);
    return { nivel: k, cor: CORES[k], temperatura: D.temperaturas[k], status: D.status[k] };
  }

  function respondida(nota) { return typeof nota === "number" && !isNaN(nota); }

  function calcular(notas) {
    notas = notas || {};
    var itens = D.indicadores.map(function (ind) {
      var n = notas[ind.codigo];
      var ok = respondida(n);
      return {
        codigo: ind.codigo, pilar: ind.pilar, dimensao: ind.dimensao, pergunta: ind.pergunta, peso: ind.peso,
        nota: ok ? n : null,
        gravidade: ok ? n * ind.peso : 0
      };
    });
    var porCodigo = {};
    itens.forEach(function (i) { porCodigo[i.codigo] = i; });
    var notasDadas = function (lista) { return lista.filter(function (i) { return i.nota !== null; }).map(function (i) { return i.nota; }); };

    var pilares = D.pilares.map(function (p, idx) {
      var its = p.codigos.map(function (c) { return porCodigo[c]; });
      var ponderada = soma(its.map(function (i) { return i.gravidade; })) / soma(its.map(function (i) { return i.peso; }));
      var n = nivel(ponderada);
      return {
        indice: idx, nome: p.nome, especialistas: p.especialistas, itens: its,
        mediaSimples: media(notasDadas(its)),
        ponderada: ponderada,
        nivel: n.nivel, cor: n.cor, temperatura: n.temperatura, status: n.status,
        prescricao: separar(p.prescricoes[n.nivel])
      };
    });

    var pesoTotal = soma(itens.map(function (i) { return i.peso; }));
    var questionario = {
      respondidas: notasDadas(itens).length,
      total: itens.length,
      mediaSimples: media(notasDadas(itens)),
      pesoTotal: pesoTotal,
      mediaPonderada: soma(itens.map(function (i) { return i.gravidade; })) / pesoTotal
    };

    // V5: D10 = G25 (global weighted mean), C10 = E25 (simple mean of the answered notes).
    var igvoPonderado = questionario.mediaPonderada;
    var nIgvo = nivel(igvoPonderado);
    var igvo = {
      nome: D.igvo.nome, responsaveis: D.igvo.responsaveis,
      mediaSimples: questionario.mediaSimples,
      ponderada: igvoPonderado,
      nivel: nIgvo.nivel, cor: nIgvo.cor, temperatura: nIgvo.temperatura, status: nIgvo.status,
      prescricao: separar(D.igvo.prescricoes[nIgvo.nivel])
    };

    var matriz = D.matriz.map(function (m) {
      // V5: each matrix row has its own weighted severity, from its own questions (B15:B20 in the spreadsheet).
      var its = (m.codigos || D.pilares[m.pilar].codigos).map(function (c) { return porCodigo[c]; });
      var g = soma(its.map(function (i) { return i.gravidade; })) / soma(its.map(function (i) { return i.peso; }));
      var n = nivel(g);
      return {
        dimensao: m.dimensao, pilar: pilares[m.pilar].nome, gravidade: g,
        nivel: n.nivel, cor: n.cor, temperatura: n.temperatura,
        gatilhos: m.gatilhos, causas: m.causas, beneficios: m.beneficios, conselheiros: m.conselheiros,
        modalidade: separar(m.modalidades[faixa(g, D.limitesMatriz)])
      };
    });

    var respondidos = itens.filter(function (i) { return i.nota !== null; });
    var classificados = respondidos.map(function (i) {
      var n = nivel(i.nota);
      return Object.assign({}, i, { nivel: n.nivel, cor: n.cor, faixa: D.referencia[3 - n.nivel] });
    });
    var porGravidade = function (a, b) { return b.gravidade - a.gravidade || b.nota - a.nota; };
    var positivos = classificados.filter(function (i) { return i.nivel === 3; })
      .sort(function (a, b) { return a.nota - b.nota || b.peso - a.peso; });
    var problemas = classificados.filter(function (i) { return i.nivel <= 1; }).sort(porGravidade);
    var atencao = classificados.filter(function (i) { return i.nivel === 2; }).sort(porGravidade);

    return {
      itens: itens, pilares: pilares, questionario: questionario, igvo: igvo,
      matriz: matriz.slice().sort(function (a, b) { return b.gravidade - a.gravidade; }),
      matrizNaOrdemDaPlanilha: matriz,
      positivos: positivos, problemas: problemas, atencao: atencao,
      referencia: D.referencia
    };
  }

  var api = {
    dados: D, calcular: calcular, faixa: faixa, nivel: nivel,
    arredondar: arredondar, formatar: formatar, separar: separar, CORES: CORES
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Termometro = api;
})(this);
