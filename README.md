# Essence Pause Uberlândia — Landing Page

Site institucional da Essence Pause Uberlândia ("Sua pausa para cuidar da
sua essência" — Cabelo, Unhas, Massagem, Depilação, Botox).

## Rodando localmente

```bash
npm install
npm start
```

Acesse http://localhost:3000. Se a porta 3000 já estiver em uso por outro
programa na sua máquina, rode em outra porta:

```bash
# Windows (cmd)
set PORT=3001 && npm start
# Windows (PowerShell)
$env:PORT=3001; npm start
# Linux/Mac
PORT=3001 npm start
```

O site é totalmente estático (HTML/CSS/JS) — o `npm start` só sobe um
servidor simples pra servir os arquivos. Também é possível abrir os
arquivos de `public/` diretamente no navegador, sem servidor nenhum.

## Estrutura

- `public/` — frontend (Início, Sobre, Serviços, Localização, Contato)
- `public/js/contact-form.js` — formulário de contato: valida os campos e
  abre o WhatsApp da Essence Pause com a mensagem já preenchida
- `server.js` — servidor estático (Express), só pra rodar localmente

## Formulário de contato

Não há agendamento automático nem banco de dados: o cliente preenche o
formulário na aba Contato (nome, telefone/WhatsApp, e-mail, serviço,
preferência de data/horário, assunto, observações) e marca a caixa de
autorização de contato. Ao enviar, o site monta a mensagem e abre o
WhatsApp oficial da Essence Pause com o texto pronto — o cliente só
confirma o envio por lá, e a equipe combina o horário diretamente na
conversa.

## Dados pendentes de confirmação

- **Horário de funcionamento** — exibido na aba Localização como estimativa
- **Duração de cada serviço** — exibida na aba Serviços como estimativa
- **Preços** — atualmente "Consulte"
- **Fotos reais do ambiente e dos serviços** — os espaços de imagem em
  `public/*.html` estão prontos para receber fotos reais (atualmente usam
  composições ilustrativas na paleta da marca)

## Dados confirmados (fonte: Instagram @essencepause.uberlandia)

- Endereço: Av. Rondon Pacheco, 2300 - Loja 136, Uberlândia - MG
- WhatsApp: (34) 98403-6999
- Instagram: [@essencepause.uberlandia](https://www.instagram.com/essencepause.uberlandia/)
