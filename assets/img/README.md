# Fotos

Todas as fotos são **reais**, enviadas pelo cliente. Tratamento (sem alterar o conteúdo):
redução de artefatos de compressão (OpenCV NL-means), super-resolução EDSR ×4
(fachada ×2), contraste local suave (CLAHE) e nitidez leve; exportação em WebP.
Cada foto tem duas versões: grande (~1150–1600 px) e `-sm` (560–800 px).

| Arquivo | Uso |
|---------|-----|
| `fachada.webp` / `fachada-sm.webp` | Imagem de compartilhamento e dados estruturados (o topo agora usa vídeo) |
| `junior.webp` | Foto do Junior no cartão de Profissionais (enviada pelo cliente) |
| `og-image.jpg` | Compartilhamento (recorte do letreiro da fachada) |

Logo oficial: `../logo-light.webp|png` (fundo escuro), `../logo-dark.png` (fundo claro),
`../brand-bar.webp` (faixa do logo, usada no Agendamento), `../favicon.png`.

As originais têm ~290 × 425 px (exceto a fachada). A super-resolução melhora bastante,
mas fotos originais em alta resolução continuam sendo a melhor opção.

## Vídeo

`../video/hero-*` (vídeo do topo, 13 s), `../video/profissionais-*` (vídeo da seção Profissionais, 21 s), `../video/galeria-{a,b}-720.*` (galeria: os dois vídeos lado a lado) e `../video/experiencia-{1080,720}.{webm,mp4}` — vídeo enviado pelo cliente (4K, 12 s),
sem áudio, comprimido para a web. O site escolhe WebM (menor) ou MP4 conforme o
navegador, e 1080p ou 720p conforme a tela. `experiencia-poster.webp` é a capa.
