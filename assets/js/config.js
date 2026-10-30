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
  email: "",

  // Perfil do Instagram (@genesisintegrativa.com.br). Confirme o endereço antes de preencher,
  // ex.: "https://www.instagram.com/genesisintegrativa.com.br/". [A validar]
  instagramUrl: "https://www.instagram.com/genesisintegrativa.com.br/",
  instagramHandle: "@genesisintegrativa.com.br",

  // Envio do diagnóstico por e-mail via EmailJS (https://www.emailjs.com). Passo a passo no README.
  // Use somente estes três identificadores, que o EmailJS foi feito para expor no navegador.
  // NUNCA coloque aqui a Private Key (Access Token) da conta. O destinatário fica no modelo, no painel do EmailJS.
  emailjs: {
    serviceId: "service_tjhss8o",   // Email Services > Gmail > Service ID (ex.: "service_xxxxxxx")
    templateId: "template_rfrabpi",  // E-mail que chega para a equipe (destinatário fixo no modelo)
    visitorTemplateId: "template_qpw7gwk",  // Cópia para o visitante (no modelo, "To Email" = {{email}}). Vazio = não envia cópia.
    publicKey: "_rU-yZOFmbrAa4Rok"    // Account > General > Public Key
  },

  // Alternativa ao EmailJS: endpoint HTTPS próprio que recebe o diagnóstico em JSON. Opcional.
  submitEndpoint: "",

  // Dados da empresa no rodapé. Troque os "x" pelo CNPJ real (14 dígitos) e preencha a razão social. [A validar]
  cnpj: "xx.xxx.xxx/xxxx-xx",
  razaoSocial: "",

  // Prazo de retorno exibido após o envio, ex.: "2 dias úteis". Vazio = a frase sai sem prazo. [A validar]
  responseDeadline: ""
};
