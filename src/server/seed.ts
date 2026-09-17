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
  db.exec('DELETE FROM notifications; DELETE FROM appointments; DELETE FROM patients;');
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
         (SELECT COUNT(*) FROM services) AS servicos
`).get();
console.log('Dados de demonstração criados:', totals);
