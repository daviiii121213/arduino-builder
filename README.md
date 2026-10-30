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
| `emailjs/template-diagnostico.html` | Modelo do e-mail a colar no painel do EmailJS |
| `assets/js/app.js` | Navegação entre abas, menu móvel, FAQ, escalas 0–10, validação e envio |
| `assets/img/` | Logo oficial (extraída do documento), símbolo, favicon, imagem de compartilhamento 1200×630 |

## Pendências antes de publicar

Preencha em `assets/js/config.js`. Enquanto um campo estiver vazio, o site mostra um aviso (“a configurar”) em vez de um link falso.

| Item | Situação |
| --- | --- |
| Número do WhatsApp (`whatsappNumber`) | **[Inserir]** — botões desativados com aviso; o botão flutuante só aparece quando configurado |
| E-mail oficial (`email`) | **[Inserir]** |
| Link do Instagram (`instagramUrl`) | **[A validar]** — o @genesisintegrativa.com.br é exibido, mas o link só é ativado depois de confirmado |
| Identificadores do EmailJS (`emailjs`) | **[Inserir]** — ver “Envio por e-mail (EmailJS)”. Sem eles o formulário avisa que o envio não está configurado |
| Prazo de retorno (`responseDeadline`) | **[A validar]** — hoje aparece como “[X dias úteis]” na mensagem de sucesso |
| Política de Privacidade | **Pendente de aprovação** — a janela mostra um texto provisório e marcado como pendente (revisão sugerida: Dr. Roberto) |
| CNPJ e razão social | **A validar** — rodapé |
| Vídeo institucional (versão A, 16:9, com legenda) | Não fornecido — há um comentário de marcação no fim da seção `#o-que-e` |
| Minicurrículos dos conselheiros (formação, registro) | **[A validar]** — exibidos nome e foto. As fotos foram ampliadas a partir de originais de ~120 px; trocar pelas originais em alta resolução quando possível (`assets/img/conselho/`) |

## Envio por e-mail (EmailJS)

Cada diagnóstico enviado chega por e-mail, organizado em três blocos (empresa e responsável, as cinco notas de 0 a 10 com barra visual, respostas finais) e com data e hora do envio no horário de Brasília. O assunto é **Novo diagnóstico | Projeto Gênesis** e o botão “Responder” do Gmail responde direto para o visitante.

### Configuração (uma vez, no painel do EmailJS)

1. **Serviço:** em *Email Services*, abra o serviço **Gmail** já conectado e copie o **Service ID** (ex.: `service_abc123`).
2. **Modelo:** em *Email Templates* > *Create New Template*:
   - *Subject*: `Novo diagnóstico | Projeto Gênesis`
   - *To Email*: `davi.devgenius@gmail.com`
   - *From Name*: `Site Projeto Gênesis`
   - *Reply To*: `{{reply_to}}`
   - *Content*: clique em *Edit Content* > *Code Editor*, apague o conteúdo padrão e cole todo o arquivo [`emailjs/template-diagnostico.html`](emailjs/template-diagnostico.html).
   - Salve e copie o **Template ID** (ex.: `template_xyz789`).
3. **Chave pública:** em *Account* > *General*, copie a **Public Key**.
4. **Segurança:** em *Account* > *Security*:
   - em *Allowed origins* (ou *Domains*), adicione `https://www.genesisintegrativa.com.br` (e o endereço de testes, se usar), para que só o site possa usar a conta;
   - mantenha **desligado** “Allow EmailJS API for non-browser applications”.
5. **No site:** preencha os três valores em `assets/js/config.js`:

   ```js
   emailjs: {
     serviceId: "service_abc123",
     templateId: "template_xyz789",
     publicKey: "SUA_PUBLIC_KEY"
   },
   ```

6. **Teste:** publique o site, envie um diagnóstico e confira a caixa de entrada (e o spam, na primeira vez).

### Segurança das credenciais

- O site usa só a **Public Key**, o **Service ID** e o **Template ID**. O EmailJS foi feito para que esses três fiquem no navegador; eles não dão acesso à conta.
- A **Private Key** (Access Token) e a senha do Gmail **nunca** entram no código do site.
- O e-mail de destino fica só no modelo do EmailJS, fora do código público. Assim ele não fica exposto a robôs de spam.
- O limite de envios e a proteção contra abuso ficam no painel do EmailJS (plano gratuito: 200 e-mails por mês; a restrição de domínio do passo 4 impede uso por outros sites).

### Como o site se comporta

- **Sucesso:** a mensagem “Recebemos suas respostas!” só aparece depois que o EmailJS confirma o envio (resposta 200). O formulário é então limpo.
- **Falha** (sem internet, identificador errado, domínio não autorizado, limite atingido): aparece “Não foi possível enviar agora”, as respostas continuam preenchidas e a pessoa pode tentar de novo.
- **Sem configuração:** aparece “Envio ainda não configurado” e nada é transmitido. Não há envio simulado.
- O botão fica bloqueado durante o envio, o que impede envios duplicados.
- **Prévia no Claude (artifact):** a página publicada como artifact não consegue acessar a API do EmailJS, por segurança da plataforma. O envio real só funciona no site hospedado.

Variáveis enviadas ao modelo: `empresa`, `responsavel`, `cargo`, `segmento`, `colaboradores`, `cidade`, `whatsapp`, `email`, `reply_to`, `dimensao_1..5`, `pergunta_1..5`, `nota_1..5`, `barra_1..5`, `principal_preocupacao`, `comentario_adicional`, `preferencia_contato`, `consentimento`, `data_envio`.

### Alternativa: endpoint próprio

Se um dia o envio passar para um servidor ou CRM, deixe `emailjs` vazio e preencha `submitEndpoint` com uma URL HTTPS que receba `POST` em JSON neste formato:

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
