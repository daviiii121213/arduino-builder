# Projeto Gênesis — site institucional

Site estático (HTML, CSS e JavaScript puro, sem dependências nem etapa de build) com duas abas principais:

- **Landing Page** (`#inicio` e âncoras das seções) — todas as seções do documento *Textos_Site_Projeto_Genesis.docx* (v1.1).
- **Formulário** (`#formulario`) — diagnóstico inicial completo, com validação.

## Como rodar

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Qualquer servidor estático serve (Netlify, Vercel, GitHub Pages, Apache, nginx). Use HTTPS em produção.

## Arquivos

| Arquivo | Conteúdo |
| --- | --- |
| `index.html` | Marcação das duas abas, SEO/Open Graph, ícones SVG, janela da Política de Privacidade |
| `assets/css/styles.css` | Sistema visual (cores da marca, Montserrat + Inter), layout responsivo |
| `assets/js/config.js` | **Dados a configurar** (WhatsApp, e-mail, Instagram, EmailJS, prazo) |
| `emailjs/template-diagnostico.html` | Versão em código do modelo do EmailJS (opcional, ver abaixo) |
| `assets/js/app.js` | Navegação entre abas, menu móvel, FAQ, escalas 0–10, validação e envio |
| `assets/img/` | Logo oficial (extraída do documento), símbolo, favicon, imagem de compartilhamento 1200×630 |

## Pendências antes de publicar

Preencha em `assets/js/config.js`. Enquanto um campo estiver vazio, o site mostra um aviso (“a configurar”) em vez de um link falso.

| Item | Situação |
| --- | --- |
| E-mail oficial (`email`) | **[Inserir]** |
| Link do Instagram (`instagramUrl`) | **[A validar]** — o @genesisintegrativa.com.br é exibido, mas o link só é ativado depois de confirmado |
| Prazo de retorno (`responseDeadline`) | **[A validar]** — enquanto estiver vazio, a mensagem de sucesso diz só que um conselheiro vai entrar em contato, sem prazo |
| Política de Privacidade | **Pendente de aprovação** — a janela mostra um texto provisório e marcado como pendente (revisão sugerida: Dr. Roberto) |
| CNPJ e razão social | **A validar** — rodapé |
| Vídeo institucional (versão A, 16:9, com legenda) | Não fornecido — há um comentário de marcação no fim da seção `#o-que-e` |
| Minicurrículos dos conselheiros (formação, registro) | **[A validar]** — exibidos nome e foto. As fotos foram ampliadas a partir de originais de ~120 px; trocar pelas originais em alta resolução quando possível (`assets/img/conselho/`) |

## Envio por e-mail (EmailJS)

O formulário já está ligado ao EmailJS. Quando o visitante conclui o diagnóstico, o site envia as respostas para o modelo do EmailJS, que encaminha o e-mail para o destinatário configurado no modelo, pelo serviço Gmail conectado.

### Configuração em uso (`assets/js/config.js`)

```js
emailjs: {
  serviceId: "service_tjhss8o",
  templateId: "template_rfrabpi",         // e-mail para a equipe
  visitorTemplateId: "template_qpw7gwk",  // cópia para o visitante
  publicKey: "_rU-yZOFmbrAa4Rok"
},
```

Para trocar de modelo ou de serviço no futuro, basta alterar esses valores.

### Variáveis enviadas ao modelo

O site envia exatamente as variáveis do modelo `template_rfrabpi`:

| Variável | Conteúdo |
| --- | --- |
| `{{empresa}}` | Nome da empresa |
| `{{responsavel}}` | Nome de quem preencheu |
| `{{respostas}}` | Todas as respostas, em três blocos: dados da empresa e contato, as cinco notas de 0 a 10 com a pergunta de cada uma, e as respostas finais com o consentimento |
| `{{data}}` | Data e hora do envio no horário de Brasília, ex.: `30/10/2026, 14:05 (horário de Brasília)` |

O destinatário fica configurado no próprio modelo, no painel do EmailJS, e não aparece no código do site.

### Cópia para o visitante (`template_qpw7gwk`)

Depois que o e-mail da equipe é confirmado, o site envia uma cópia ao visitante com as mesmas variáveis e mais `{{email}}` (o e-mail que ele digitou). No painel, esse modelo usa **To Email** = `{{email}}` e **Reply To** = o e-mail da equipe. A aba *Auto-Reply* do `template_rfrabpi` deve ficar desligada, senão o visitante recebe duas cópias.

- O diagnóstico conta como enviado assim que o e-mail da equipe é confirmado; se só a cópia do visitante falhar, ele ainda vê a mensagem de sucesso.
- Cada diagnóstico usa 2 envios da cota do EmailJS (cerca de 100 diagnósticos por mês no plano gratuito).
- Para desligar a cópia, deixe `visitorTemplateId` vazio.

**Se as respostas chegarem todas numa linha só:** o editor visual do EmailJS pode juntar as quebras de linha de `{{respostas}}`. Nesse caso, abra o modelo em *Edit Content* > *Code Editor* e cole o conteúdo de [`emailjs/template-diagnostico.html`](emailjs/template-diagnostico.html). É o mesmo texto e as mesmas variáveis do seu modelo, só com a formatação que preserva as linhas.

### Segurança

- O site usa só a **Public Key**, o **Service ID** e o **Template ID**. O EmailJS foi feito para que esses três fiquem no navegador; eles não dão acesso à conta.
- A **Private Key** (Access Token) e a senha do Gmail **nunca** entram no código do site.
- Recomendado em *Account* > *Security*: restringir o uso ao domínio `https://www.genesisintegrativa.com.br` (e ao endereço de testes, se usar) e manter **desligado** “Allow EmailJS API for non-browser applications”.
- Limite do plano gratuito: 200 e-mails por mês (cada diagnóstico usa 2: o da equipe e a cópia do visitante).

### Como o site se comporta

- **Sucesso:** “Recebemos suas respostas!” só aparece depois que o EmailJS confirma o envio (resposta 200). O formulário é então limpo.
- **Falha** (sem internet, identificador errado, domínio não autorizado, limite atingido): aparece “Não foi possível enviar agora”, as respostas continuam preenchidas e a pessoa pode tentar de novo. Quando o EmailJS recusa o envio, a mensagem mostra também o motivo que ele devolveu (“Detalhe técnico”).
- O botão fica bloqueado durante o envio, o que impede envios duplicados.
- **Prévia no Claude (artifact):** a página publicada como artifact não consegue acessar a API do EmailJS, por segurança da plataforma. O envio real só funciona no site hospedado ou rodando no seu computador.

### Como testar

1. Na pasta do site, rode `python3 -m http.server 8000` e abra http://localhost:8000/#formulario (se tiver restringido domínios no EmailJS, inclua `http://localhost:8000`).
2. Preencha e envie. Deve aparecer “Recebemos suas respostas!” e o e-mail deve chegar na caixa configurada no modelo (confira o spam na primeira vez).
3. Se aparecer “Não foi possível enviar agora”, abra o console do navegador (F12) > aba *Network* > requisição `send`: a resposta do EmailJS diz o motivo (ex.: modelo não encontrado, domínio não permitido).

### Alternativa: endpoint próprio

Se um dia o envio passar para um servidor ou CRM, deixe os campos de `emailjs` vazios e preencha `submitEndpoint` com uma URL HTTPS que receba `POST` em JSON neste formato:

```json
{
  "contact": { "name", "role", "company", "segment", "employee_range", "city", "whatsapp", "email" },
  "ratings": { "financeiro_gestao_operacoes": 0-10, "estrategia_continuidade": 0-10, "pessoas_lideranca_cultura": 0-10,
               "saude_integrativa_alta_performance": 0-10, "reeducacao_corporativa_comportamental": 0-10 },
  "closing": { "principal_preocupacao", "comentario_adicional": "string | null", "preferencia_contato", "consentimento": true },
  "meta": { "source": "site", "submitted_at": "ISO 8601" }
}
```

**Armazenamento:** as respostas ficam só na memória da página (são mantidas ao trocar de aba, perdidas ao recarregar). Nada é gravado em `localStorage`, na URL ou no console.
