# Essence Pause Uberlândia — Landing Page

Site institucional e sistema de agendamento da Essence Pause Uberlândia
("Sua pausa para cuidar da sua essência" — Cabelo, Unhas, Massagem,
Depilação, Botox).

## Rodando localmente

Requer Node.js 22.5 ou superior (usa o módulo `node:sqlite` embutido —
não precisa instalar Visual Studio Build Tools/compilador C++, nem nada
além do próprio Node).

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

## Estrutura

- `public/` — frontend estático (Início, Sobre, Serviços, Localização, Contato)
- `server.js` — servidor Express, serve o frontend e a API
- `src/config/business.js` — dados da marca, serviços e horário de funcionamento
- `src/availability.js` — motor de disponibilidade (única fonte de verdade,
  usada tanto para listar horários livres quanto para validar uma reserva)
- `src/routes/booking.js` — API de agendamento
- `data/essence-pause.db` — banco SQLite (criado automaticamente via `node:sqlite`, persiste os agendamentos)

## Sistema de agendamento

A verificação de disponibilidade é feita **no servidor**, não só na
interface: antes de confirmar, o backend garante que o horário está dentro
do funcionamento, não é no passado e não conflita com nenhuma reserva já
existente (considerando a duração de cada serviço). A checagem e a
gravação da reserva acontecem dentro de uma transação atômica no SQLite,
o que impede que dois clientes reservem o mesmo horário simultaneamente.

## Dados pendentes de confirmação

Alguns dados não estavam disponíveis publicamente e foram deixados como
estimativa editável (nunca inventados como fato definitivo):

- **Horário de funcionamento** — `src/config/business.js` (`businessHours`)
- **Duração de cada serviço** — `src/config/business.js` (`services[].durationMinutes`)
- **Preços** — atualmente "Consulte"; edite `services[].price` / `priceLabel`
- **Fotos reais do ambiente e dos serviços** — os espaços de imagem em
  `public/*.html` estão prontos para receber fotos reais (atualmente usam
  composições ilustrativas na paleta da marca)

## Dados confirmados (fonte: Instagram @essencepause.uberlandia)

- Endereço: Av. Rondon Pacheco, 2300 - Loja 136, Uberlândia - MG
- WhatsApp: (34) 98403-6999
- Instagram: [@essencepause.uberlandia](https://www.instagram.com/essencepause.uberlandia/)
