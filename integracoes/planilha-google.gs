/**
 * Projeto Gênesis — registro dos diagnósticos numa planilha do Google.
 *
 * COMO INSTALAR (uma vez, cerca de 5 minutos)
 * 1. No Google Drive, crie uma planilha nova, por exemplo "Diagnósticos Gênesis".
 * 2. Na planilha: Extensões > Apps Script. Apague o código que aparecer e cole este arquivo inteiro. Salve.
 * 3. Clique em Implantar > Nova implantação > engrenagem > "App da Web".
 *      Executar como: Eu (sua conta)
 *      Quem pode acessar: Qualquer pessoa
 *    Clique em Implantar e autorize o acesso quando o Google pedir.
 * 4. Copie a "URL do app da Web" (termina em /exec) e cole em assets/js/config.js, no campo planilhaEndpoint.
 *
 * Cada diagnóstico concluído no site vira uma linha na aba "Diagnósticos". As colunas são criadas sozinhas.
 * Se mudar este código depois, use Implantar > Gerenciar implantações > editar > Nova versão (a URL continua a mesma).
 */
const ABA = 'Diagnósticos';
const LIMITE_POR_HORA = 30; // proteção simples: no máximo 30 linhas por hora

function doPost(e) {
  const trava = LockService.getScriptLock();
  trava.waitLock(10000);
  try {
    const dados = JSON.parse(e.postData.contents);
    if (!dados || typeof dados !== 'object' || !dados.empresa) return resposta('ignorado');

    const cache = CacheService.getScriptCache();
    const contagem = Number(cache.get('linhas-hora') || 0);
    if (contagem >= LIMITE_POR_HORA) return resposta('limite');
    cache.put('linhas-hora', String(contagem + 1), 3600);

    const planilha = SpreadsheetApp.getActiveSpreadsheet();
    const aba = planilha.getSheetByName(ABA) || planilha.insertSheet(ABA);
    const colunas = Object.keys(dados).slice(0, 80);
    let cabecalho = aba.getLastColumn() ? aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0] : [];
    colunas.forEach(function (c) {
      if (cabecalho.indexOf(c) === -1) {
        cabecalho.push(c);
        aba.getRange(1, cabecalho.length).setValue(c).setFontWeight('bold');
      }
    });
    aba.setFrozenRows(1);
    aba.appendRow(cabecalho.map(function (c) { return seguro(dados[c]); }));
    return resposta('ok');
  } finally {
    trava.releaseLock();
  }
}

// Texto que começa com = + - @ viraria fórmula na planilha; o apóstrofo o mantém como texto.
function seguro(valor) {
  if (valor === undefined || valor === null) return '';
  if (typeof valor === 'number') return valor;
  const texto = String(valor).slice(0, 2000);
  return /^[=+\-@]/.test(texto) ? "'" + texto : texto;
}

function resposta(texto) {
  return ContentService.createTextOutput(texto);
}
