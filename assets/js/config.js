/*
 * Configuração do site Projeto Gênesis.
 * Preencha os campos vazios somente com dados oficiais aprovados pelo grupo.
 * Enquanto um campo estiver vazio, o site mostra um aviso honesto em vez de um link falso.
 */
window.GENESIS_CONFIG = {
  // Número oficial do WhatsApp, só dígitos, com DDI 55 + DDD. Ex.: "5534900000000". [Inserir]
  whatsappNumber: "",
  whatsappMessage: "Olá! Vim pelo site do Projeto Gênesis e quero saber mais sobre o diagnóstico.",

  // E-mail oficial de contato. [Inserir]
  email: "",

  // Perfil do Instagram (@genesisintegrativa.com.br). Confirme o endereço antes de preencher,
  // ex.: "https://www.instagram.com/genesisintegrativa.com.br/". [A validar]
  instagramUrl: "",
  instagramHandle: "@genesisintegrativa.com.br",

  // Endpoint HTTPS que recebe o diagnóstico (POST JSON). Vazio = modo de demonstração (nada é enviado). [A validar]
  submitEndpoint: "",

  // Prazo de retorno exibido após o envio. [A validar]
  responseDeadline: "[X dias úteis]"
};
