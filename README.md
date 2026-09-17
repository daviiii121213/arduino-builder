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

## Módulos clínicos e de gestão (versão Artifact)

**Núcleo clínico**
- **Odontograma interativo** — 32 dentes permanentes e 20 decíduos em SVG, notação FDI,
  com as 5 faces (oclusal, mesial, distal, vestibular e lingual) clicáveis. Cada face alterna
  entre sem alteração → cárie → restaurada; o dente inteiro recebe condição (hígido, cárie,
  restaurado, canal, coroa, implante, ausente, extração indicada) e observação.
  Um documento por paciente.
- **Prontuário / evolução clínica** — registro por atendimento com título, procedimento,
  dentes envolvidos e descrição. Ao marcar uma consulta como "Atendida", o formulário de
  evolução abre já preenchido.
- **Anamnese digital** — 12 perguntas de saúde preenchidas pelo paciente no portal
  ("Minha saúde") ou pela clínica. As respostas de risco (alergia, anticoagulante, diabetes,
  cardiopatia, gestação, hemorragia, reação à anestesia) viram alertas vermelhos na ficha,
  no cartão do paciente e no detalhe da consulta.
- **Planos de tratamento** — orçamento com itens por dente, valor por procedimento, desconto
  e status (proposto, aprovado, em andamento, concluído, recusado). O paciente vê e aceita o
  orçamento pelo portal, e a aprovação gera notificação para a clínica.

**Gestão**
- **Tabela de procedimentos** — 17 procedimentos com categoria, duração e valor. A duração
  passa a reservar o tempo real na agenda: a verificação de horário ocupado usa sobreposição
  de intervalos, e horários que não cabem até o fechamento são ocultados.
- **Financeiro** — lançamentos com vencimento, forma de pagamento e parcelas; geração de
  cobrança a partir de um plano aprovado; baixa e estorno de pagamentos; totais de recebido,
  a receber, em aberto e vencido.
- **Relatórios** — faturamento por mês, procedimentos mais realizados, situação das consultas,
  ocupação por faixa de horário, novos pacientes por mês, recall de pacientes sem retorno há
  6 meses e aniversariantes do mês.

## Serviços, orçamento e duração

Cada serviço tem **preço e duração próprios** (30, 60 ou 90 minutos) cadastrados no banco.
Eles são a única fonte do orçamento e do tempo reservado na agenda:

| Serviço | Preço | Duração |
|---|---|---|
| Avaliação odontológica | R$ 80,00 | 30 minutos |
| Limpeza dental | R$ 150,00 | 1 hora |
| Restauração dentária | R$ 220,00 | 1 hora |
| Clareamento dental | R$ 650,00 | 1 hora e 30 minutos |
| Extração dentária | R$ 350,00 | 1 hora e 30 minutos |

- **Orçamento automático** — ao escolher o serviço, o portal mostra na hora o preço, a duração,
  o início e o término. O cliente não edita o preço; ele é gravado junto com o agendamento e
  aparece nos detalhes da consulta para o dentista.
- **Duração define o término** — `end_time = start_time + duration_minutes`, calculado no servidor.
- **Grade de 30 minutos** — uma consulta ocupa quantas faixas forem necessárias: 1h30 iniciando
  às 14:00 bloqueia 14:00, 14:30 e 15:00, e o próximo horário livre é 15:30.
- **Conflitos** — a checagem é por sobreposição de períodos (`início_A < fim_B e início_B < fim_A`),
  não por igualdade de horário, então uma consulta não pode começar no meio de outra.
- **Regra de fechamento** — com fechamento às 22:00, o último início é 21:30 (30 min),
  21:00 (1 hora) e 20:30 (1h30). Horários sem tempo suficiente aparecem como indisponíveis.
- **Agenda proporcional** — na visão de dia, a consulta ocupa visualmente o tempo que dura:
  30 min = 1 faixa, 1 hora = 2 faixas, 1h30 = 3 faixas.

### Garantias do backend (`npm test`)

O servidor nunca confia no que o formulário envia: busca o serviço no banco, obtém preço e
duração de lá, calcula o término e refaz a verificação de conflito **dentro da transação que
grava a consulta** — como as transações do better-sqlite3 são serializadas, dois pedidos
simultâneos para o mesmo período não criam consultas conflitantes. São 15 testes cobrindo
essas regras, incluindo a tentativa de forçar preço e duração pelo corpo da requisição.

Endpoints relacionados:

```
GET    /api/public/services              catálogo ativo (preço, duração, descrição)
GET    /api/public/slots?date=&serviceId= horários já filtrados pela duração do serviço
POST   /api/public/appointments          agendamento do portal (preço/duração vêm do banco)
GET    /api/dentist/services             catálogo completo
POST   /api/dentist/services             cadastro (duração restrita a 30, 60 ou 90)
PUT    /api/dentist/services/:id         edição
DELETE /api/dentist/services/:id         remove, ou desativa se já houver consultas
```

## Módulos clínicos no backend (API + SQLite)

Os mesmos módulos da versão Artifact existem na versão Node, com a regra rodando
no servidor e persistência em SQLite:

| Módulo | Tabelas | Garantias do servidor |
|---|---|---|
| Odontograma | `odontograms` | numeração FDI validada (11-48 e 51-85), condições e faces restritas ao vocabulário do sistema, dente hígido sem marcação não ocupa espaço |
| Anamnese | `anamneses` | exige as 12 respostas, aceita apenas sim/não, e os **alertas de risco são derivados no servidor** (o cliente não envia alertas) |
| Prontuário | `clinical_records` | título e descrição mínimos, data não futura, e a consulta vinculada precisa ser do próprio paciente |
| Planos de tratamento | `treatment_plans`, `treatment_plan_items` | nome e preço do item vêm do catálogo de serviços, **total recalculado a partir dos itens** (valor enviado pelo cliente é ignorado), desconto não pode superar o total |
| Financeiro | `payments` | status (pago/pendente/vencido) derivado da data e da baixa, data do pagamento definida pelo servidor, parcelamento fecha o centavo exato e não permite cobrar duas vezes o mesmo plano |
| Relatórios | agregações | faturamento por mês, serviços mais realizados, situação das consultas, ocupação por faixa, novos pacientes, recall e aniversariantes |

Excluir um paciente remove odontograma, anamnese, prontuário, planos, itens e
lançamentos em cascata.

### Endpoints

```
# odontograma
GET    /api/dentist/patients/:id/odontogram
PUT    /api/dentist/patients/:id/odontogram          substitui o mapa inteiro
PUT    /api/dentist/patients/:id/odontogram/:tooth   grava um dente
DELETE /api/dentist/patients/:id/odontogram/:tooth   limpa o registro do dente

# anamnese, prontuário
GET    /api/dentist/patients/:id/anamnesis
PUT    /api/dentist/patients/:id/anamnesis
GET    /api/dentist/patients/:id/records
POST   /api/dentist/patients/:id/records
PUT    /api/dentist/records/:id
DELETE /api/dentist/records/:id

# planos e financeiro
GET    /api/dentist/plans?patientId=&status=
POST   /api/dentist/patients/:id/plans
PUT    /api/dentist/plans/:id
PUT    /api/dentist/plans/:id/items/:itemId          conclui ou reabre um item
GET    /api/dentist/plans/:id/billing                total, lançado e restante
POST   /api/dentist/plans/:id/billing                gera as parcelas
GET    /api/dentist/payments?status=&patientId=
POST   /api/dentist/patients/:id/payments
POST   /api/dentist/payments/:id/settle              baixa ou estorno
GET    /api/dentist/payments/summary?from=&to=
GET    /api/dentist/reports

# portal do paciente (exige nome + data de nascimento no corpo)
GET    /api/public/anamnesis/questions
POST   /api/public/anamnesis        salva as respostas do próprio paciente
POST   /api/public/anamnesis/read   lê a própria ficha de saúde
POST   /api/public/plans            orçamentos e pagamentos do próprio paciente
POST   /api/public/plans/:id/accept aceita o próprio orçamento
```

`npm test` roda 32 testes: 15 de serviços/agendamento e 17 dos módulos clínicos.

## Dados de demonstração

Fictícios e removíveis: `npm run seed -- --reset` (ou apagar `data/clinic.db`).
Na versão Artifact, "Configurações → Remover dados de demonstração".
