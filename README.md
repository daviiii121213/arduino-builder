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
| `assets/js/config.js` | **Dados a configurar** (WhatsApp, e-mail, Instagram, endpoint, prazo) |
| `assets/js/app.js` | Navegação entre abas, menu móvel, FAQ, escalas 0–10, validação e envio |
| `assets/img/` | Logo oficial (extraída do documento), símbolo, favicon, imagem de compartilhamento 1200×630 |

## Pendências antes de publicar

Preencha em `assets/js/config.js`. Enquanto um campo estiver vazio, o site mostra um aviso (“a configurar”) em vez de um link falso.

| Item | Situação |
| --- | --- |
| Número do WhatsApp (`whatsappNumber`) | **[Inserir]** — botões desativados com aviso; o botão flutuante só aparece quando configurado |
| E-mail oficial (`email`) | **[Inserir]** |
| Link do Instagram (`instagramUrl`) | **[A validar]** — o @genesisintegrativa.com.br é exibido, mas o link só é ativado depois de confirmado |
| Destino do formulário (`submitEndpoint`) | **[A validar]** — ver “Envio do formulário” |
| Prazo de retorno (`responseDeadline`) | **[A validar]** — hoje aparece como “[X dias úteis]” na mensagem de sucesso |
| Política de Privacidade | **Pendente de aprovação** — a janela mostra um texto provisório e marcado como pendente (revisão sugerida: Dr. Roberto) |
| CNPJ e razão social | **A validar** — rodapé |
| Vídeo institucional (versão A, 16:9, com legenda) | Não fornecido — há um comentário de marcação no fim da seção `#o-que-e` |
| Fotos e minicurrículos dos conselheiros | **[A validar]** — exibidos só nomes e iniciais |
| Imagem/vídeo de fundo do hero | Não fornecido — usado fundo azul-noite com arco dourado em CSS/SVG |

## Envio do formulário

- **Sem `submitEndpoint` (estado atual): modo de demonstração.** O formulário valida tudo e mostra “Modo de demonstração: respostas não enviadas”. Nada é transmitido e os dados continuam preenchidos.
- **Com `submitEndpoint`:** `POST` em JSON. A mensagem “Recebemos suas respostas!” só aparece após resposta 2xx. Em caso de erro, os dados são mantidos e a pessoa pode tentar de novo. O botão fica bloqueado durante o envio (evita duplicidade).

Formato enviado:

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
