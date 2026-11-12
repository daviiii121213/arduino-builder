# Guia de recursos visuais — PERSONAL LIFE ULTRA

Todos os recursos visuais foram **criados para o projeto**, ficam **armazenados localmente** em `assets/`
e são empacotados pelo Vite no build. Nenhuma imagem, fonte ou ícone é carregado da internet.

## Organização

| Pasta | Conteúdo |
|---|---|
| `assets/onboarding/<etapa>/` | Uma ilustração por etapa do manual inicial (welcome, profile, workspaces, family, personalization, modules, security, first-access) |
| `assets/icons/` | Ícone do aplicativo (fonte vetorial do `app-icon.ico`). Os ícones da interface são SVG da biblioteca lucide-react, empacotados localmente |
| `assets/backgrounds/` | Fundos discretos e transparentes |
| `assets/decorative/` | Elementos decorativos e ilustração de estado vazio |
| `assets/mockups/` | Mockups simplificados de telas usados na ajuda |
| `assets/documentation/` | Este guia, `ASSET_CATALOG.json` (finalidade e uso de cada recurso) e `IMAGE_MANIFEST.json` (lista técnica) |

## Por que SVG em vez de WebP

A especificação sugere WebP para ilustrações. Optamos por **SVG** em todas as ilustrações porque:

- são vetoriais: ficam nítidas em qualquer resolução/escala do Windows (100%–200%) sem múltiplos arquivos;
- são muito menores que bitmaps equivalentes (poucos KB), favorecendo o hardware alvo (i3 + gráficos integrados);
- cada ilustração tem fundo próprio ou cores de baixa opacidade, funcionando nos temas claro e escuro;
- podem ser editadas em qualquer editor vetorial.

WebP/PNG continuam previstos para fotografias e para o ícone `.ico/.png` gerado no empacotamento.

## Regras

- Não usar emojis como substitutos de ilustrações.
- Toda ilustração possui `role="img"` e `aria-label` descritivo em português; quando usada em `<img>`, o `alt` também é preenchido.
- Paleta: primária `#4f46e5`/`#6366f1`, destaque `#0d9488`, aviso `#f59e0b`, neutros `#334155`/`#94a3b8`.
- Ao adicionar um recurso, registre-o em `ASSET_CATALOG.json` e `IMAGE_MANIFEST.json`.
