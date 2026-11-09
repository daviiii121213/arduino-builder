/*
 * Configuração do site Projeto Gênesis.
 * Preencha os campos vazios somente com dados oficiais aprovados pelo grupo.
 * Enquanto um campo estiver vazio, o site mostra um aviso honesto em vez de um link falso.
 */
window.GENESIS_CONFIG = {
  // Número oficial do WhatsApp, só dígitos, com DDI 55 + DDD. Ex.: "5534900000000". [Inserir]
  whatsappNumber: "5534998593233",
  whatsappMessage: "Olá! Vim pelo site do Projeto Gênesis e quero saber mais sobre o diagnóstico.",

  // E-mail oficial de contato. [Inserir]
  email: "contato@genesisintegrativa.com.br",

  // Perfil do Instagram (@genesisintegrativa.com.br). Confirme o endereço antes de preencher,
  // ex.: "https://www.instagram.com/genesisintegrativa.com.br/". [A validar]
  instagramUrl: "https://www.instagram.com/genesisintegrativa.com.br/",
  instagramHandle: "@genesisintegrativa.com.br",

  // Envio do diagnóstico: script do próprio site, no servidor da HostGator, que envia pelo SMTP do Titan.
  // As credenciais ficam só no servidor (genesis-smtp.php, fora do public_html). Vazio = envio desligado.
  submitEndpoint: "api/enviar.php",

  // Verificação antirrobô Cloudflare Turnstile (grátis, sem quebra-cabeça na maioria das vezes).
  // Cole aqui a "Site Key" (pública). A "Secret Key" vai só no servidor, em genesis-smtp.php. Vazio = desligado.
  turnstileSiteKey: "",

  // Dados da empresa no rodapé. Troque os "x" pelo CNPJ real (14 dígitos). Razão social é opcional. [A validar]
  cnpj: "38.066.297/0001-60",
  razaoSocial: "5WS Inteligência e Compliance Ltda",

  // Prazo de retorno exibido após o envio, ex.: "2 dias úteis". Vazio = a frase sai sem prazo. [A validar]
  responseDeadline: "",

  // Proteção contra robôs: tempo mínimo entre começar o questionário e enviar, e envios aceitos por navegador em 24 horas.
  protecao: { tempoMinimoSegundos: 40, enviosPor24h: 3 },

  // Planilha do Google que recebe uma linha por diagnóstico. Cole a URL do Apps Script (termina em /exec). Vazio = desligado.
  // Passo a passo em integracoes/planilha-google.gs.
  planilhaEndpoint: "",

  // Estatísticas sem cookies (GoatCounter). Coloque só o código da conta, ex.: "genesis" para genesis.goatcounter.com. Vazio = desligado.
  estatisticas: { goatcounter: "" }
};
