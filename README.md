# OdontoCare — Sistema de Gestão para Clínica Odontológica

Sistema completo (pt-BR) com **site público**, **portal do paciente** e **painel do dentista**
compartilhando a mesma base de dados.

O projeto existe em duas execuções:

| Versão | Onde roda | Persistência |
|---|---|---|
| **Artifact** (`artifact/odontocare.html`) | navegador, publicado no claude.ai | base de dados do artefato (capability `db`), com fallback local |
| **Full-stack** (`src/`) | Node.js em `localhost:3000` | SQLite (`data/clinic.db`) |

## Full-stack (Node + TypeScript + SQLite)

```bash
npm install
npm run build        # compila servidor (dist/) e cliente (public/js/)
npm run seed -- --reset   # dados fictícios de demonstração
npm start            # http://localhost:3000
```

- Site público: `http://localhost:3000/`
- Portal do cliente: `http://localhost:3000/cliente`
- Painel do dentista: `http://localhost:3000/dentista` — senha de demonstração `123`

### Arquitetura

```
src/server/
  db.ts                 conexão SQLite + migrações (users, patients, appointments,
                        clinic_settings, notifications)
  index.ts              Express: rotas de página, estáticos, tratamento de erro
  middleware.ts         cookies, proteção das rotas do dentista, erros em JSON
  routes/api.ts         REST JSON: /api/public/* (portal) e /api/dentist/* (protegido)
  routes/auth.ts        login/logout por sessão assinada (HMAC) em cookie httpOnly
  services/
    auth.ts             senha com scrypt + salt, comparação em tempo constante
    patients.ts         CRUD, busca, filtros, ordenação, idade automática
    appointments.ts     CRUD, status, dashboard, sincronização cliente↔dentista
    scheduling.ts       regras de negócio e geração dinâmica de horários
    settings.ts         configurações da clínica
    notifications.ts    notificações internas persistidas
  utils/dates.ts        idade exata (bissextos, meses irregulares), fusos civis
```

### Regras de negócio (validadas no servidor e no cliente)

- Segunda a sábado, 08:00–22:00; domingo fechado
- Último horário inicia às 21:30 (intervalo padrão de 30 min, configurável: 15/30/45/60)
- Bloqueio de data passada, domingo, fora do horário e horário ocupado
  (com índice único no banco garantindo o slot)
- Idade calculada automaticamente no formato "X anos e Y meses"

### API

Todas as respostas seguem `{ ok, data }` ou `{ ok: false, error: { code, message, details } }`.
Erros de banco e stack traces nunca são expostos ao cliente.

## Dados de demonstração

Fictícios e removíveis: `npm run seed -- --reset` (ou apagar `data/clinic.db`).
Na versão Artifact, "Configurações → Remover dados de demonstração".
