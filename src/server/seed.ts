/**
 * Popula o banco com dados fictícios de demonstração.
 * Todos os dados são inventados; basta apagar o arquivo data/clinic.db
 * (ou rodar `npm run seed -- --reset`) para remover a demonstração.
 */
import { db, ensureDefaultServices, ensureDefaultSettings, migrate } from './db';
import { ensureDentistUser } from './services/auth';
import { addDays, todayIso, weekdayOf } from './utils/dates';
import { AppointmentStatus } from './types';

migrate();
ensureDefaultSettings();
ensureDefaultServices();
ensureDentistUser();

const reset = process.argv.includes('--reset');
if (reset) {
  db.exec(`
    DELETE FROM payments;
    DELETE FROM treatment_plan_items;
    DELETE FROM treatment_plans;
    DELETE FROM clinical_records;
    DELETE FROM anamneses;
    DELETE FROM odontograms;
    DELETE FROM notifications;
    DELETE FROM appointments;
    DELETE FROM patients;
  `);
}

const existing = db.prepare('SELECT COUNT(*) AS total FROM patients').get() as { total: number };
if (existing.total > 0 && !reset) {
  console.log('Banco já possui dados. Use "npm run seed -- --reset" para recriar a demonstração.');
  process.exit(0);
}

const patients = [
  ['Mariana Alves Ribeiro', '1991-04-12', 'feminino', '(11) 98812-4477', 'mariana.ribeiro@exemplo.com.br', 'Sensibilidade no molar superior direito.'],
  ['Carlos Eduardo Nunes', '1984-11-03', 'masculino', '(11) 99741-2093', 'carlos.nunes@exemplo.com.br', 'Uso de aparelho ortodôntico desde 2024.'],
  ['Beatriz Carvalho Lima', '2000-02-29', 'feminino', '(11) 99123-8876', 'beatriz.lima@exemplo.com.br', 'Nascida em ano bissexto - paciente de clareamento.'],
  ['João Pedro Meireles', '2016-08-21', 'masculino', '(11) 98444-1120', null, 'Odontopediatria. Acompanhado pela mãe.'],
  ['Sofia Nakamura', '1978-06-09', 'feminino', '(11) 97555-3321', 'sofia.nakamura@exemplo.com.br', 'Implante na arcada inferior concluído.'],
  ['Rodrigo Teixeira Braga', '1995-12-30', 'masculino', '(11) 98090-7766', 'rodrigo.braga@exemplo.com.br', null],
  ['Helena Duarte Campos', '1966-03-17', 'feminino', '(11) 99688-4512', 'helena.campos@exemplo.com.br', 'Controle periodontal semestral.'],
  ['Lucas Andrade Figueiredo', '2003-09-05', 'masculino', '(11) 98237-6644', 'lucas.figueiredo@exemplo.com.br', 'Extração de sisos programada.'],
  ['Patrícia Moreira Sant\'Anna', '1988-07-24', 'feminino', '(11) 99012-3345', 'patricia.santanna@exemplo.com.br', 'Prefere atendimento no período noturno.'],
  ['Antônio Vieira Lopes', '1959-01-08', 'masculino', '(11) 97441-9987', null, 'Prótese total superior em acompanhamento.']
];

const insertPatient = db.prepare(`
  INSERT INTO patients (name, birth_date, sex, phone, email, notes)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const patientIds: number[] = [];
db.transaction(() => {
  for (const p of patients) {
    const info = insertPatient.run(...p);
    patientIds.push(Number(info.lastInsertRowid));
  }
})();

/** Cada motivo aponta para um serviço do catálogo: é ele que define preço e duração. */
const reasons: [string, string][] = [
  ['Limpeza e profilaxia', 'Limpeza dental'],
  ['Avaliação de clareamento dental', 'Clareamento dental'],
  ['Restauração no molar superior', 'Restauração dentária'],
  ['Manutenção de aparelho ortodôntico', 'Manutenção ortodôntica'],
  ['Tratamento de canal - sessão 2', 'Tratamento de canal (por sessão)'],
  ['Avaliação inicial', 'Avaliação odontológica'],
  ['Extração de siso inferior', 'Extração dentária'],
  ['Consulta de rotina e raio-x', 'Avaliação odontológica'],
  ['Aplicação de flúor (odontopediatria)', 'Aplicação de flúor'],
  ['Raspagem periodontal', 'Raspagem periodontal (por quadrante)']
];

interface SeedService { id: number; name: string; price: number; duration_minutes: number }
const services = db.prepare('SELECT id, name, price, duration_minutes FROM services')
  .all() as SeedService[];
const serviceByName = new Map(services.map((s) => [s.name, s]));

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fromMinutes = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

/** Próximo dia útil (a clínica não atende aos domingos). */
function nextOpenDay(from: string, offset: number): string {
  let date = addDays(from, offset);
  while (weekdayOf(date) === 0) date = addDays(date, 1);
  return date;
}

const today = todayIso();
const slots = ['08:00', '09:00', '09:30', '10:30', '11:00', '14:00', '15:00', '16:30', '18:00', '19:30', '20:00'];

const insertAppointment = db.prepare(`
  INSERT INTO appointments
    (patient_id, service_id, date, start_time, end_time, duration_minutes, price,
     reason, notes, status, origin, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);

/** Guarda os períodos já ocupados por dia para não gerar sobreposição. */
const busy = new Map<string, [number, number][]>();
function book(date: string, time: string, patientIndex: number, reasonIndex: number,
              status: AppointmentStatus, origin: string, notes: string | null) {
  const [reason, serviceName] = reasons[reasonIndex % reasons.length];
  const service = serviceByName.get(serviceName);
  if (!service) return;

  const start = toMinutes(time);
  const end = start + service.duration_minutes;
  const ranges = busy.get(date) ?? [];
  if (status !== 'cancelada' && ranges.some(([s0, e0]) => start < e0 && s0 < end)) return;
  ranges.push([start, end]);
  busy.set(date, ranges);

  insertAppointment.run(
    patientIds[patientIndex % patientIds.length],
    service.id,
    date, time, fromMinutes(end), service.duration_minutes, service.price,
    reason, notes, status, origin
  );
}

db.transaction(() => {
  // Consultas de hoje
  book(today, '08:00', 0, 0, 'atendida', 'clinica', 'Paciente compareceu no horário.');
  book(today, '09:30', 1, 3, 'confirmada', 'portal', null);
  book(today, '11:00', 2, 1, 'aguardando', 'portal', 'Solicitou orçamento de clareamento a laser.');
  book(today, '14:00', 4, 5, 'confirmada', 'clinica', null);
  book(today, '19:30', 8, 7, 'aguardando', 'portal', 'Prefere horário noturno.');

  // Próximos dias
  const upcoming: [number, number, number, AppointmentStatus, string][] = [
    [1, 3, 2, 'confirmada', 'portal'],
    [1, 5, 4, 'aguardando', 'clinica'],
    [2, 6, 6, 'confirmada', 'clinica'],
    [3, 7, 8, 'aguardando', 'portal'],
    [4, 9, 9, 'confirmada', 'clinica'],
    [5, 0, 0, 'aguardando', 'portal'],
    [6, 2, 1, 'confirmada', 'portal'],
    [8, 4, 5, 'aguardando', 'clinica']
  ];
  upcoming.forEach(([offset, patientIndex, reasonIndex, status, origin], i) => {
    book(nextOpenDay(today, offset), slots[(i + 1) % slots.length], patientIndex, reasonIndex, status, origin, null);
  });

  // Histórico
  const history: [number, number, number, AppointmentStatus][] = [
    [-3, 0, 0, 'atendida'],
    [-5, 1, 3, 'atendida'],
    [-8, 3, 8, 'atendida'],
    [-12, 6, 7, 'cancelada'],
    [-15, 5, 2, 'atendida'],
    [-21, 9, 9, 'atendida'],
    [-28, 7, 6, 'cancelada'],
    [-35, 2, 1, 'atendida']
  ];
  history.forEach(([offset, patientIndex, reasonIndex, status], i) => {
    let date = addDays(today, offset);
    while (weekdayOf(date) === 0) date = addDays(date, -1);
    book(date, slots[i % slots.length], patientIndex, reasonIndex, status, i % 2 ? 'portal' : 'clinica', null);
  });
})();

/* ---------------------------------------------------------------- odontogramas */
const setChart = db.prepare(`
  INSERT INTO odontograms (patient_id, teeth) VALUES (?, ?)
  ON CONFLICT(patient_id) DO UPDATE SET teeth = excluded.teeth, updated_at = datetime('now')
`);
setChart.run(patientIds[0], JSON.stringify({
  16: { status: 'restaurado', faces: { O: 'restaurado' }, note: 'Resina em bom estado.' },
  26: { status: 'cariado', faces: { O: 'cariado', M: 'cariado' }, note: 'Cárie oclusal profunda.' },
  36: { status: 'canal', faces: {}, note: 'Canal tratado em 2024.' },
  47: { status: 'higido', faces: { D: 'restaurado' }, note: '' }
}));
setChart.run(patientIds[4], JSON.stringify({
  46: { status: 'implante', faces: {}, note: 'Implante instalado, osseointegrado.' },
  45: { status: 'coroa', faces: {}, note: 'Coroa de porcelana.' },
  18: { status: 'ausente', faces: {}, note: 'Extraído em 2019.' },
  28: { status: 'ausente', faces: {}, note: 'Extraído em 2019.' }
}));
setChart.run(patientIds[7], JSON.stringify({
  38: { status: 'extrair', faces: {}, note: 'Siso incluso, extração programada.' },
  48: { status: 'extrair', faces: {}, note: 'Siso incluso, extração programada.' }
}));

/* ------------------------------------------------------------------- anamneses */
const yes = (detail = '') => ({ value: 'sim', detail });
const no = () => ({ value: 'nao', detail: '' });
const setAnamnesis = db.prepare(`
  INSERT INTO anamneses (patient_id, answers, filled_by) VALUES (?, ?, ?)
  ON CONFLICT(patient_id) DO UPDATE SET answers = excluded.answers, updated_at = datetime('now')
`);
setAnamnesis.run(patientIds[0], JSON.stringify({
  saude_geral: no(), alergia: yes('Dipirona'), medicacao: no(), anticoagulante: no(),
  diabetes: no(), pressao: no(), gestante: no(), hemorragia: no(), fumante: no(),
  bruxismo: yes('À noite'), anestesia: no(), cirurgia: no()
}), 'paciente');
setAnamnesis.run(patientIds[6], JSON.stringify({
  saude_geral: yes('Acompanhamento cardiológico'), alergia: no(), medicacao: yes('Losartana 50mg'),
  anticoagulante: yes('AAS 100mg'), diabetes: yes(), pressao: yes('Hipertensão controlada'),
  gestante: no(), hemorragia: no(), fumante: no(), bruxismo: no(), anestesia: no(), cirurgia: no()
}), 'clinica');
setAnamnesis.run(patientIds[4], JSON.stringify({
  saude_geral: no(), alergia: no(), medicacao: no(), anticoagulante: no(), diabetes: no(),
  pressao: no(), gestante: no(), hemorragia: no(), fumante: yes('10 cigarros/dia'),
  bruxismo: no(), anestesia: no(), cirurgia: yes('Implante em 2025')
}), 'paciente');

/* ------------------------------------------------------- evolução clínica */
const attended = db.prepare(`
  SELECT id, patient_id, service_id, date FROM appointments
  WHERE status = 'atendida' ORDER BY date DESC LIMIT 5
`).all() as { id: number; patient_id: number; service_id: number | null; date: string }[];

const evolutions: [string, string][] = [
  ['Profilaxia realizada', 'Raspagem supragengival, polimento e aplicação de flúor. Orientada quanto ao uso de fio dental.'],
  ['Manutenção ortodôntica', 'Troca de elásticos e ativação do arco superior. Sem intercorrências.'],
  ['Restauração concluída', 'Remoção de tecido cariado no 26, isolamento absoluto e restauração em resina composta A2.'],
  ['Consulta de rotina', 'Exame clínico e radiografia interproximal. Nenhuma lesão nova identificada.'],
  ['Aplicação de flúor', 'Profilaxia e flúor em moldeira. Paciente colaborativo durante o atendimento.']
];
const insertRecord = db.prepare(`
  INSERT INTO clinical_records (patient_id, appointment_id, service_id, date, title, description, teeth)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
attended.forEach((a, i) => {
  const [title, description] = evolutions[i % evolutions.length];
  insertRecord.run(a.patient_id, a.id, a.service_id, a.date, title, description, i === 2 ? '26' : '');
});

/* ------------------------------------------------- planos de tratamento */
const serviceByNameSeed = new Map(services.map((s) => [s.name, s]));
const insertPlan = db.prepare(`
  INSERT INTO treatment_plans (patient_id, title, status, discount) VALUES (?, ?, ?, ?)
`);
const insertItem = db.prepare(`
  INSERT INTO treatment_plan_items (plan_id, service_id, name, tooth, price, status, position)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

function addPlan(patientIndex: number, title: string, status: string, discount: number,
                 items: [string, string, string][]) {
  const planId = Number(insertPlan.run(patientIds[patientIndex], title, status, discount).lastInsertRowid);
  items.forEach(([serviceName, tooth, itemStatus], position) => {
    const service = serviceByNameSeed.get(serviceName);
    if (!service) return;
    insertItem.run(planId, service.id, service.name, tooth, service.price, itemStatus, position);
  });
  return planId;
}

const plan1 = addPlan(0, 'Reabilitação dos molares superiores', 'em_andamento', 100, [
  ['Restauração dentária', '26', 'concluido'],
  ['Tratamento de canal (por sessão)', '26', 'pendente'],
  ['Limpeza dental', '', 'concluido']
]);
const plan2 = addPlan(4, 'Prótese sobre implante — inferior direito', 'aprovado', 0, [
  ['Restauração dentária', '46', 'concluido'],
  ['Clareamento dental', '', 'pendente']
]);
addPlan(7, 'Extração dos sisos inclusos', 'proposto', 150, [
  ['Extração dentária', '38', 'pendente'],
  ['Extração dentária', '48', 'pendente']
]);

/* ------------------------------------------------------------- financeiro */
const insertPayment = db.prepare(`
  INSERT INTO payments (patient_id, plan_id, description, amount, method, installment, due_date, paid_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const dueIn = (offset: number) => addDays(today, offset);

insertPayment.run(patientIds[0], plan1, 'Entrada — reabilitação', 500, 'pix', '1/3', dueIn(-20), dueIn(-20));
insertPayment.run(patientIds[0], plan1, 'Parcela 2/3 — reabilitação', 400, 'credito', '2/3', dueIn(-2), null);
insertPayment.run(patientIds[0], plan1, 'Parcela 3/3 — reabilitação', 370, 'credito', '3/3', dueIn(28), null);
insertPayment.run(patientIds[4], plan2, 'Entrada — prótese sobre implante', 500, 'pix', '1/2', dueIn(-45), dueIn(-45));
insertPayment.run(patientIds[4], plan2, 'Parcela 2/2 — prótese sobre implante', 370, 'boleto', '2/2', dueIn(12), null);
insertPayment.run(patientIds[1], null, 'Manutenção ortodôntica — mês corrente', 220, 'debito', '', dueIn(-6), dueIn(-6));
insertPayment.run(patientIds[5], null, 'Limpeza dental', 150, 'dinheiro', '', dueIn(-12), dueIn(-12));
insertPayment.run(patientIds[9], null, 'Avaliação odontológica', 80, 'pix', '', dueIn(-30), null);

db.prepare(`
  INSERT INTO notifications (type, title, message, created_at)
  VALUES ('novo_agendamento', 'Novo agendamento pelo portal',
          'Beatriz Carvalho Lima solicitou uma avaliação de clareamento.', datetime('now', '-25 minutes'))
`).run();
db.prepare(`
  INSERT INTO notifications (type, title, message, created_at)
  VALUES ('consulta_proxima', 'Consulta próxima',
          'Carlos Eduardo Nunes tem manutenção ortodôntica hoje às 09:30.', datetime('now', '-2 hours'))
`).run();

const totals = db.prepare(`
  SELECT (SELECT COUNT(*) FROM patients) AS pacientes,
         (SELECT COUNT(*) FROM appointments) AS consultas,
         (SELECT COUNT(*) FROM services) AS servicos,
         (SELECT COUNT(*) FROM odontograms) AS odontogramas,
         (SELECT COUNT(*) FROM anamneses) AS anamneses,
         (SELECT COUNT(*) FROM clinical_records) AS evolucoes,
         (SELECT COUNT(*) FROM treatment_plans) AS planos,
         (SELECT COUNT(*) FROM payments) AS lancamentos
`).get();
console.log('Dados de demonstração criados:', totals);
