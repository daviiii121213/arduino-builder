# Projeto Gênesis — site institucional

Site estático (HTML, CSS e JavaScript puro, sem dependências nem etapa de build) com duas abas principais:

- **Landing Page**, com apresentação, os 4 pilares e o Conselho.
- **Diagnóstico** (`#formulario`): Termômetro Organizacional em 5 etapas: identificação → questionário (20 perguntas, uma por tela) → cenário atual → processamento → laudo com resultado.

Detalhes anteriores:


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
| `assets/js/app.js` | Navegação, menu, FAQ, diagnóstico em etapas, salvamento automático, laudo e envio |
| `assets/js/termometro.js` | Motor de cálculo: reproduz as fórmulas da planilha oficial |
| `assets/js/termometro-dados.js` | Perguntas, pesos, faixas e textos copiados da planilha (gerado, não editar à mão) |
| `tools/` | Planilha oficial, gerador dos dados e verificação automática contra a planilha |
| `assets/img/` | Logo oficial (extraída do documento), símbolo, favicon, imagem de compartilhamento 1200×630 |

## Pendências antes de publicar

Preencha em `assets/js/config.js`. Enquanto um campo estiver vazio, o site mostra um aviso (“a configurar”) em vez de um link falso.

| Item | Situação |
| --- | --- |
| E-mail oficial (`email`) | **[Inserir]** — em verificação; o botão "Enviar e-mail" fica com aviso até ser preenchido |
| Prazo de retorno (`responseDeadline`) | **[A validar]** — enquanto estiver vazio, a mensagem de sucesso diz só que um conselheiro vai entrar em contato, sem prazo |
| Política de Privacidade | **Pendente de aprovação** — a janela mostra um texto provisório e marcado como pendente (revisão sugerida: Dr. Roberto) |
| CNPJ (`cnpj`) | **A validar** — o rodapé mostra `CNPJ xx.xxx.xxx/xxxx-xx` até o número real ser colocado em `config.js`; a razão social (`razaoSocial`) é opcional e fica sem exibir |
| Vídeo institucional (versão A, 16:9, com legenda) | Não fornecido — há um comentário de marcação no fim da seção `#o-que-e` |
| Minicurrículos dos conselheiros (formação, registro) | **[A validar]** — exibidos nome e foto. As fotos foram ampliadas a partir de originais de ~120 px; trocar pelas originais em alta resolução quando possível (`assets/img/conselho/`) |

## Termômetro Organizacional (metodologia oficial)

Fonte única: `tools/Planilha_Completa_Questionario_Projeto_Genesis_V4.xlsx`, abas **Questionário Quantitativo** e **Laudo & Plano de Tratamento**.

- 20 indicadores em 4 pilares: Gestão, Finanças & Comercial (inclui Estratégia e Comercial) · Liderança, Cultura & Pessoas · Saúde Integrativa & Comportamento · Auditoria & Compliance Trabalhista.
- Gravidade ponderada = nota × peso. Média geral = soma das gravidades ÷ soma dos pesos.
- Pilar: média simples e gravidade ponderada. IGVO: média dos 4 pilares.
- Faixas: ≥ 8 vermelho (39.5°C+), ≥ 5,5 amarelo (38.5°C), ≥ 3 branco (37.2°C), abaixo verde (36.2°C), com a prescrição de cada faixa.
- Plano de tratamento: 6 dimensões, modalidade por gravidade (≥ 8 choque, ≥ 5,5 tática, abaixo governança).
- Pontos positivos e problemas: tabela de referência da planilha aplicada a cada nota (0–2,9 saudável; 5,5–10 problema; 3,0–5,4 atenção).

**Se a planilha mudar:** substitua o arquivo em `tools/`, rode `python3 tools/gerar_termometro.py` e depois `bash tools/verificar_termometro.sh` (recalcula 76 casos no LibreOffice e compara cada número e texto com o site).

**Salvamento:** as respostas ficam salvas no navegador do visitante (localStorage) enquanto ele responde e podem ser retomadas; "Recomeçar" e "Fazer um novo diagnóstico" apagam.

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
| `{{respostas}}` | Laudo completo em texto: identificação, IGVO (gravidade, temperatura, status e prescrição), médias, os 4 pilares, plano de tratamento, problemas, pontos positivos, as 20 respostas (nota × peso = gravidade) e o cenário atual |
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
- **Falha** (sem internet, identificador errado, domínio não autorizado, limite atingido): o laudo aparece mesmo assim, com o aviso de que não foi enviado ao Conselho e um botão "Tentar enviar novamente"; as respostas continuam salvas. Quando o EmailJS recusa o envio, a mensagem mostra também o motivo que ele devolveu (“Detalhe técnico”).
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
