/**
 * Testes das regras de negócio do backend (node --test não é necessário:
 * o arquivo roda com `npm test` e falha com código != 0 no primeiro erro).
 *
 * Cobre a especificação de serviços:
 *  - preço e duração vêm do banco, nunca do corpo da requisição;
 *  - horário de término calculado no servidor;
 *  - bloqueio de sobreposição, inclusive em pedidos simultâneos;
 *  - horários disponíveis recalculados pela duração do serviço;
 *  - regra de fechamento (só cabe o que termina até as 22:00).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'odontocare-test-'));
process.env.DATA_DIR = DATA_DIR;
process.env.DB_FILE = 'test.db';

const { db, ensureDefaultServices, ensureDefaultSettings, migrate } = require('../dist/server/db');
const { createAppointment, updateAppointment, listAppointments } = require('../dist/server/services/appointments');
const { generateSlots, endTimeOf } = require('../dist/server/services/scheduling');
const { listServices, createService } = require('../dist/server/services/catalog');
const { createPatient } = require('../dist/server/services/patients');
const { addDays, todayIso, weekdayOf } = require('../dist/server/utils/dates');

migrate();
ensureDefaultSettings();
ensureDefaultServices();

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

/**
 * Cada teste recebe uma data de atendimento exclusiva (uma semana à frente da
 * anterior), para que um teste nunca herde as consultas de outro.
 * A clínica fecha aos domingos, então a data é empurrada quando cai em um.
 */
function openDay(index) {
  let date = addDays(todayIso(), 3 + index * 7);
  while (weekdayOf(date) === 0) date = addDays(date, 1);
  return date;
}

const services = listServices(true);
const svc30 = services.find((s) => s.durationMinutes === 30);
const svc60 = services.find((s) => s.durationMinutes === 60);
const svc90 = services.find((s) => s.durationMinutes === 90);

const patient = createPatient({
  name: 'Paciente De Teste', birthDate: '1990-01-15', sex: 'feminino'
}, false);

const base = { patientId: patient.id, reason: 'Consulta de teste' };

test('catálogo tem preço e duração de 30, 60 ou 90 minutos', () => {
  assert.ok(services.length >= 5);
  services.forEach((s) => {
    assert.ok([30, 60, 90].includes(s.durationMinutes), `duração inválida em ${s.name}`);
    assert.ok(s.price >= 0);
  });
  const limpeza = services.find((s) => s.name === 'Limpeza dental');
  assert.strictEqual(limpeza.price, 150);
  assert.strictEqual(limpeza.durationMinutes, 60);
  assert.strictEqual(limpeza.durationLabel, '1 hora');
});

test('preço e duração enviados pelo cliente são ignorados', () => {
  const date = openDay(3);
  const appt = createAppointment({
    ...base, serviceId: svc60.id, date, time: '09:00',
    price: 1, durationMinutes: 15, endTime: '09:05'
  }, { origin: 'portal' });

  assert.strictEqual(appt.price, svc60.price, 'preço deve vir do banco');
  assert.strictEqual(appt.durationMinutes, 60, 'duração deve vir do banco');
  assert.strictEqual(appt.endTime, '10:00', 'término calculado no servidor');
  assert.strictEqual(appt.service.name, svc60.name);
});

test('término é sempre início + duração do serviço', () => {
  assert.strictEqual(endTimeOf('10:00', 30), '10:30');
  assert.strictEqual(endTimeOf('10:00', 60), '11:00');
  assert.strictEqual(endTimeOf('10:00', 90), '11:30');
  assert.strictEqual(endTimeOf('21:30', 30), '22:00');
});

test('serviço inexistente ou ausente é recusado', () => {
  const date = openDay(4);
  assert.throws(() => createAppointment({ ...base, date, time: '09:00' }), /serviço/i);
  assert.throws(() => createAppointment({ ...base, serviceId: 99999, date, time: '09:00' }), /não encontrado/i);
});

test('consulta de 1h30 bloqueia as três faixas de 30 minutos', () => {
  const date = openDay(5);
  createAppointment({ ...base, serviceId: svc90.id, date, time: '14:00' });

  ['14:00', '14:30', '15:00'].forEach((time) => {
    assert.throws(
      () => createAppointment({ ...base, serviceId: svc30.id, date, time }),
      /ocupado/i,
      `${time} deveria estar bloqueado`
    );
  });

  // 15:30 é o próximo horário livre
  const next = createAppointment({ ...base, serviceId: svc30.id, date, time: '15:30' });
  assert.strictEqual(next.time, '15:30');
  assert.strictEqual(next.endTime, '16:00');
});

test('sobreposição parcial é recusada (início antes do fim de outra)', () => {
  const date = openDay(6);
  createAppointment({ ...base, serviceId: svc60.id, date, time: '10:00' }); // 10:00-11:00
  assert.throws(
    () => createAppointment({ ...base, serviceId: svc90.id, date, time: '09:30' }), // 09:30-11:00
    /ocupado/i
  );
  assert.throws(
    () => createAppointment({ ...base, serviceId: svc30.id, date, time: '10:30' }),
    /ocupado/i
  );
});

test('horários disponíveis mudam conforme a duração do serviço', () => {
  const date = openDay(7);
  createAppointment({ ...base, serviceId: svc60.id, date, time: '10:00' });

  const free = (duration) => generateSlots(date, duration).slots
    .filter((s) => s.available).map((s) => s.time);

  const f30 = free(30);
  const f90 = free(90);
  assert.ok(!f30.includes('10:00') && !f30.includes('10:30'), 'faixas ocupadas somem para 30 min');
  assert.ok(f30.includes('11:00'), '11:00 fica livre para 30 min');
  assert.ok(!f90.includes('09:00'), '09:00 não comporta 90 min antes da consulta das 10:00');
  assert.ok(f90.length < f30.length, 'serviço mais longo tem menos horários');
});

test('regra de fechamento: último início depende da duração', () => {
  const date = openDay(8);
  const last = (duration) => {
    const free = generateSlots(date, duration).slots.filter((s) => s.available);
    return free[free.length - 1].time;
  };
  assert.strictEqual(last(30), '21:30');
  assert.strictEqual(last(60), '21:00');
  assert.strictEqual(last(90), '20:30');

  assert.throws(
    () => createAppointment({ ...base, serviceId: svc90.id, date, time: '21:00' }),
    /fechamento/i
  );
});

test('horários ocupados aparecem como indisponíveis, com motivo', () => {
  const date = openDay(9);
  createAppointment({ ...base, serviceId: svc60.id, date, time: '16:00' });
  const slots = generateSlots(date, 30).slots;
  const taken = slots.filter((s) => ['16:00', '16:30'].includes(s.time));
  assert.strictEqual(taken.length, 2);
  taken.forEach((s) => {
    assert.strictEqual(s.available, false);
    assert.match(s.reason, /ocupado/i);
  });
});

test('cancelamento libera o período', () => {
  const date = openDay(10);
  const appt = createAppointment({ ...base, serviceId: svc90.id, date, time: '13:00' });
  assert.strictEqual(generateSlots(date, 30).slots.find((s) => s.time === '13:30').available, false);

  updateAppointment(appt.id, { status: 'cancelada' });
  assert.strictEqual(generateSlots(date, 30).slots.find((s) => s.time === '13:30').available, true);

  const reused = createAppointment({ ...base, serviceId: svc30.id, date, time: '13:30' });
  assert.strictEqual(reused.time, '13:30');
});

test('pedidos simultâneos não criam consultas conflitantes', () => {
  const date = openDay(11);
  const attempts = [];
  for (let i = 0; i < 8; i += 1) {
    try {
      createAppointment({ ...base, serviceId: svc60.id, date, time: '08:00' });
      attempts.push('ok');
    } catch (error) {
      attempts.push('erro');
    }
  }
  assert.strictEqual(attempts.filter((a) => a === 'ok').length, 1, 'apenas um agendamento pode vencer');

  const saved = listAppointments({ date }).filter((a) => a.status !== 'cancelada');
  assert.strictEqual(saved.length, 1);
});

test('reagendar recalcula término e continua respeitando conflitos', () => {
  const date = openDay(12);
  createAppointment({ ...base, serviceId: svc60.id, date, time: '09:00' }); // 09:00-10:00
  const moving = createAppointment({ ...base, serviceId: svc90.id, date, time: '15:00' });

  assert.throws(() => updateAppointment(moving.id, { time: '09:30' }), /ocupado/i);

  const moved = updateAppointment(moving.id, { time: '10:00' });
  assert.strictEqual(moved.time, '10:00');
  assert.strictEqual(moved.endTime, '11:30');
});

test('trocar o serviço atualiza preço, duração e término', () => {
  const date = openDay(13);
  const appt = createAppointment({ ...base, serviceId: svc30.id, date, time: '11:00' });
  assert.strictEqual(appt.endTime, '11:30');

  const changed = updateAppointment(appt.id, { serviceId: svc90.id });
  assert.strictEqual(changed.durationMinutes, 90);
  assert.strictEqual(changed.price, svc90.price);
  assert.strictEqual(changed.endTime, '12:30');
});

test('serviço novo aceita apenas durações de 30, 60 ou 90 minutos', () => {
  assert.throws(
    () => createService({ name: 'Serviço inválido', price: 100, durationMinutes: 45 }),
    (error) => /30, 60 ou 90/.test(error.details?.durationMinutes ?? '')
  );
  const created = createService({
    name: 'Clareamento caseiro supervisionado', price: 420, durationMinutes: 30,
    description: 'Moldeira individual e gel de uso domiciliar.'
  });
  assert.strictEqual(created.durationMinutes, 30);
  assert.strictEqual(created.price, 420);
});

test('os valores gravados ficam no banco (preço, duração, início e fim)', () => {
  const date = openDay(14);
  const appt = createAppointment({ ...base, serviceId: svc60.id, date, time: '19:00' });
  const row = db.prepare(`
    SELECT service_id, start_time, end_time, duration_minutes, price FROM appointments WHERE id = ?
  `).get(appt.id);
  assert.deepStrictEqual(row, {
    service_id: svc60.id, start_time: '19:00', end_time: '20:00',
    duration_minutes: 60, price: svc60.price
  });
});

(async () => {
  for (const [name, fn] of tests) {
    try {
      await fn();
      passed += 1;
      console.log(`  ✓ ${name}`);
    } catch (error) {
      console.error(`  ✗ ${name}\n    ${error.message}`);
      db.close();
      fs.rmSync(DATA_DIR, { recursive: true, force: true });
      process.exit(1);
    }
  }
  console.log(`\n${passed}/${tests.length} testes passaram.`);
  db.close();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
})();
