/**
 * Testes dos módulos clínicos no backend:
 * odontograma, anamnese, prontuário, planos de tratamento, financeiro e relatórios.
 *
 * O foco é o que só o servidor pode garantir: validação do formato, valores
 * derivados (total do plano, status do pagamento, alertas da anamnese) e
 * proteção contra dados forjados pelo cliente.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'odontocare-clinico-'));
process.env.DATA_DIR = DATA_DIR;
process.env.DB_FILE = 'clinical.db';

const { db, ensureDefaultServices, ensureDefaultSettings, migrate } = require('../dist/server/db');
const { createPatient } = require('../dist/server/services/patients');
const { listServices, createService, updateService } = require('../dist/server/services/catalog');
const { createAppointment } = require('../dist/server/services/appointments');
const {
  getOdontogram, setTooth, clearTooth, replaceOdontogram
} = require('../dist/server/services/odontogram');
const { getAnamnesis, saveAnamnesis, QUESTIONS } = require('../dist/server/services/anamnesis');
const {
  createRecord, listRecords, updateRecord, deleteRecord
} = require('../dist/server/services/records');
const {
  createPlan, getPlan, updatePlan, listPlans, setItemStatus, acceptPlan
} = require('../dist/server/services/plans');
const {
  createPayment, getPayment, updatePayment, listPayments, settlePayment,
  billPlan, planBilling, financeSummary
} = require('../dist/server/services/payments');
const { reportsOverview } = require('../dist/server/services/reports');
const { addDays, todayIso, weekdayOf } = require('../dist/server/utils/dates');

migrate();
ensureDefaultSettings();
ensureDefaultServices();

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

const services = listServices(true);
const svc60 = services.find((s) => s.durationMinutes === 60);
const svc90 = services.find((s) => s.durationMinutes === 90);

const patient = createPatient({
  name: 'Clara Do Prontuário', birthDate: '1987-04-22', sex: 'feminino'
}, false);
const other = createPatient({
  name: 'Outro Paciente Qualquer', birthDate: '1975-11-02', sex: 'masculino'
}, false);

/** Respostas completas da anamnese, com os ajustes recebidos. */
const fullAnswers = (overrides = {}) => {
  const answers = {};
  QUESTIONS.forEach((q) => { answers[q.id] = { value: 'nao', detail: '' }; });
  return { ...answers, ...overrides };
};

/* ------------------------------------------------------------- odontograma */

test('odontograma aceita condição do dente, faces e observação', () => {
  const chart = setTooth(patient.id, 26, {
    status: 'cariado',
    faces: { O: 'cariado', M: 'restaurado' },
    note: 'Cárie oclusal profunda.'
  });
  assert.strictEqual(chart.teeth['26'].status, 'cariado');
  assert.deepStrictEqual(chart.teeth['26'].faces, { O: 'cariado', M: 'restaurado' });
  assert.strictEqual(chart.teeth['26'].note, 'Cárie oclusal profunda.');
  assert.strictEqual(chart.markedTeeth, 1);
});

test('odontograma recusa dente, condição e face inválidos', () => {
  const detail = (fn, field, pattern) => assert.throws(fn, (error) =>
    pattern.test(error.details?.[field] ?? ''));

  detail(() => setTooth(patient.id, 99, { status: 'cariado' }), 'tooth', /FDI/);
  detail(() => setTooth(patient.id, 27, { status: 'inventado' }), 'status', /condições/i);
  detail(() => setTooth(patient.id, 27, { status: 'higido', faces: { Z: 'cariado' } }), 'faces', /válidas/i);
  detail(() => setTooth(patient.id, 27, { status: 'higido', faces: { O: 'quebrado' } }), 'faces', /válidas/i);
});

test('dente hígido sem faces sai do odontograma, e limpar remove o registro', () => {
  setTooth(patient.id, 36, { status: 'canal', faces: {}, note: 'Canal em 2024.' });
  assert.ok(getOdontogram(patient.id).teeth['36']);

  setTooth(patient.id, 36, { status: 'higido', faces: {}, note: '' });
  assert.strictEqual(getOdontogram(patient.id).teeth['36'], undefined);

  setTooth(patient.id, 46, { status: 'implante' });
  clearTooth(patient.id, 46);
  assert.strictEqual(getOdontogram(patient.id).teeth['46'], undefined);
});

test('odontograma é por paciente e sobrevive à substituição em lote', () => {
  assert.strictEqual(Object.keys(getOdontogram(other.id).teeth).length, 0);

  replaceOdontogram(other.id, {
    teeth: {
      11: { status: 'restaurado', faces: { V: 'restaurado' } },
      21: { status: 'higido', faces: {} }
    }
  });
  const chart = getOdontogram(other.id);
  assert.ok(chart.teeth['11'], 'dente marcado permanece');
  assert.strictEqual(chart.teeth['21'], undefined, 'dente hígido não ocupa espaço');
  assert.ok(getOdontogram(patient.id).teeth['26'], 'o outro paciente não é afetado');
});

/* ---------------------------------------------------------------- anamnese */

test('anamnese exige todas as respostas e só aceita sim/não', () => {
  assert.throws(() => saveAnamnesis(patient.id, { answers: { alergia: { value: 'sim' } } }, 'clinica'),
    /Responda todas/);
  assert.throws(
    () => saveAnamnesis(patient.id, { answers: fullAnswers({ diabetes: { value: 'talvez' } }) }, 'clinica'),
    /respostas/i
  );
  assert.throws(
    () => saveAnamnesis(patient.id, { answers: fullAnswers({ pergunta_inventada: { value: 'sim' } }) }, 'clinica'),
    /respostas/i
  );
});

test('alertas de risco são derivados no servidor', () => {
  const saved = saveAnamnesis(patient.id, {
    answers: fullAnswers({
      alergia: { value: 'sim', detail: 'Dipirona' },
      anticoagulante: { value: 'sim', detail: '' },
      fumante: { value: 'sim', detail: '10 cigarros/dia' }
    })
  }, 'paciente');

  const ids = saved.riskFlags.map((f) => f.id).sort();
  assert.deepStrictEqual(ids, ['alergia', 'anticoagulante'], 'fumar não é alerta de risco clínico');
  assert.strictEqual(saved.riskFlags.find((f) => f.id === 'alergia').detail, 'Dipirona');
  assert.strictEqual(saved.complete, true);
  assert.strictEqual(saved.filledBy, 'paciente');

  // as mesmas respostas voltam na leitura
  assert.strictEqual(getAnamnesis(patient.id).riskFlags.length, 2);
  assert.strictEqual(getAnamnesis(other.id).riskFlags.length, 0);
});

/* -------------------------------------------------------------- prontuário */

test('evolução exige título, descrição e data não futura', () => {
  assert.throws(() => createRecord(patient.id, { title: 'ok', description: 'curta' }), /evolução/i);
  assert.throws(
    () => createRecord(patient.id, {
      title: 'Restauração', description: 'Descrição suficientemente longa.', date: addDays(todayIso(), 5)
    }),
    /evolução/i
  );
});

test('evolução vincula consulta do próprio paciente e aparece no prontuário', () => {
  let date = addDays(todayIso(), 2);
  while (weekdayOf(date) === 0) date = addDays(date, 1);
  const appt = createAppointment({
    patientId: patient.id, serviceId: svc60.id, date, time: '09:00', reason: 'Restauração'
  });

  assert.throws(
    () => createRecord(other.id, {
      title: 'Registro cruzado', description: 'Tentativa de vincular consulta alheia.',
      appointmentId: appt.id
    }),
    (error) => /outro paciente/.test(error.details?.appointmentId ?? '')
  );

  const record = createRecord(patient.id, {
    title: 'Restauração concluída',
    description: 'Remoção de tecido cariado no 26 e restauração em resina composta A2.',
    appointmentId: appt.id, serviceId: svc60.id, teeth: '26', date: todayIso()
  });
  assert.strictEqual(record.appointmentId, appt.id);
  assert.strictEqual(record.serviceName, svc60.name);

  const updated = updateRecord(record.id, { title: 'Restauração concluída (revisada)' });
  assert.strictEqual(updated.title, 'Restauração concluída (revisada)');

  assert.strictEqual(listRecords(patient.id).length, 1);
  deleteRecord(record.id);
  assert.strictEqual(listRecords(patient.id).length, 0);
});

/* ------------------------------------------------- planos de tratamento */

test('total do plano é calculado no servidor a partir dos itens', () => {
  const plan = createPlan(patient.id, {
    title: 'Reabilitação superior',
    discount: 100,
    total: 1, // valor forjado pelo cliente: deve ser ignorado
    items: [
      { serviceId: svc60.id, tooth: '26' },
      { serviceId: svc90.id, tooth: '' }
    ]
  });

  assert.strictEqual(plan.itemsTotal, svc60.price + svc90.price);
  assert.strictEqual(plan.total, svc60.price + svc90.price - 100);
  assert.strictEqual(plan.items[0].name, svc60.name, 'nome vem do catálogo');
  assert.strictEqual(plan.items[0].price, svc60.price, 'preço padrão vem do catálogo');
  assert.strictEqual(plan.status, 'proposto');
});

test('plano recusa item sem serviço, desconto maior que o total e status inválido', () => {
  assert.throws(() => createPlan(patient.id, { title: 'Sem itens', items: [] }), /item/i);
  assert.throws(
    () => createPlan(patient.id, { title: 'Serviço inexistente', items: [{ serviceId: 99999 }] }),
    /não encontrado/i
  );
  assert.throws(
    () => createPlan(patient.id, {
      title: 'Desconto absurdo', discount: 99999, items: [{ serviceId: svc60.id }]
    }),
    (error) => /desconto/i.test(error.message) || /desconto/i.test(error.details?.discount ?? '')
  );
  assert.throws(
    () => createPlan(patient.id, {
      title: 'Status inválido', status: 'pago', items: [{ serviceId: svc60.id }]
    }),
    /plano/i
  );
});

test('itens concluídos e aceite do orçamento pelo paciente', () => {
  const plan = createPlan(other.id, {
    title: 'Extrações', items: [{ serviceId: svc90.id, tooth: '38' }, { serviceId: svc90.id, tooth: '48' }]
  });
  assert.strictEqual(plan.completedItems, 0);

  const afterItem = setItemStatus(plan.id, plan.items[0].id, 'concluido');
  assert.strictEqual(afterItem.completedItems, 1);
  assert.throws(() => setItemStatus(plan.id, plan.items[1].id, 'quase'),
    (error) => /status/i.test(error.message));

  const accepted = acceptPlan(plan.id);
  assert.strictEqual(accepted.status, 'aprovado');
  assert.throws(() => acceptPlan(plan.id), /aguardando aprovação/);

  const changed = updatePlan(plan.id, { status: 'concluido' });
  assert.strictEqual(changed.status, 'concluido');
  assert.strictEqual(listPlans({ patientId: other.id }).length, 1);
});

/* -------------------------------------------------------------- financeiro */

test('status do pagamento é derivado da data e da baixa', () => {
  const pendente = createPayment(patient.id, {
    description: 'Consulta avulsa', amount: 200, method: 'pix', dueDate: addDays(todayIso(), 10)
  });
  assert.strictEqual(pendente.status, 'pendente');

  const vencido = createPayment(patient.id, {
    description: 'Cobrança atrasada', amount: 150, method: 'boleto', dueDate: addDays(todayIso(), -5)
  });
  assert.strictEqual(vencido.status, 'vencido');

  const pago = settlePayment(vencido.id, true);
  assert.strictEqual(pago.status, 'pago');
  assert.strictEqual(pago.paidAt, todayIso(), 'a data da baixa vem do servidor');

  const estornado = settlePayment(pago.id, false);
  assert.strictEqual(estornado.status, 'vencido');
  assert.strictEqual(estornado.paidAt, null);
});

test('pagamento recusa valor zero, forma desconhecida e data inválida', () => {
  assert.throws(() => createPayment(patient.id, {
    description: 'Zero', amount: 0, dueDate: todayIso()
  }), /lançamento/i);
  assert.throws(() => createPayment(patient.id, {
    description: 'Forma inválida', amount: 100, method: 'cheque', dueDate: todayIso()
  }), /lançamento/i);
  assert.throws(() => createPayment(patient.id, {
    description: 'Data inválida', amount: 100, dueDate: '2026-13-45'
  }), /lançamento/i);
  assert.throws(() => createPayment(patient.id, {
    description: 'Pagamento no futuro', amount: 100, dueDate: todayIso(), paidAt: addDays(todayIso(), 3)
  }), /lançamento/i);
});

test('parcelamento do plano fecha exatamente o valor, sem sobra de centavos', () => {
  const plan = createPlan(patient.id, {
    title: 'Plano parcelado', items: [{ serviceId: svc60.id, price: 100 }]
  });
  const parcels = billPlan(plan.id, { amount: 100, parts: 3, method: 'credito', dueDate: todayIso() });

  assert.strictEqual(parcels.length, 3);
  const soma = parcels.reduce((s, p) => s + p.amount, 0);
  assert.strictEqual(Math.round(soma * 100), 10000, 'a soma das parcelas bate com o total');
  assert.deepStrictEqual(parcels.map((p) => p.installment), ['1/3', '2/3', '3/3']);

  const billing = planBilling(plan.id);
  assert.strictEqual(billing.total, 100);
  assert.strictEqual(billing.billed, 100);
  assert.strictEqual(billing.remaining, 0);

  // não é possível cobrar duas vezes o mesmo plano
  assert.throws(() => billPlan(plan.id, { amount: 50, parts: 1, dueDate: todayIso() }),
    (error) => /restam/.test(error.details?.amount ?? ''));
});

test('resumo financeiro separa recebido, a receber, em aberto e vencido', () => {
  const summary = financeSummary(`${todayIso().slice(0, 7)}-01`, `${todayIso().slice(0, 7)}-31`);
  ['received', 'expected', 'open', 'overdue'].forEach((key) => {
    assert.ok(typeof summary[key] === 'number', `${key} deve ser numérico`);
  });
  const pendentes = listPayments({ status: 'pendente' });
  assert.ok(pendentes.every((p) => p.status === 'pendente'));
  assert.ok(listPayments({ patientId: patient.id }).every((p) => p.patientId === patient.id));
});

test('lançamento financeiro tira valor e descrição do serviço', () => {
  const lancamento = createPayment(patient.id, {
    serviceId: svc90.id,
    amount: 1,               // valor forjado pelo cliente: deve ser ignorado
    description: 'Preço camarada',
    method: 'pix',
    dueDate: todayIso()
  });

  assert.strictEqual(lancamento.amount, svc90.price, 'valor vem do catálogo');
  assert.strictEqual(lancamento.description, svc90.name, 'descrição vem do serviço');
  assert.strictEqual(lancamento.serviceId, svc90.id);
  assert.strictEqual(lancamento.serviceName, svc90.name);
});

test('mudar o preço do serviço não altera lançamentos já feitos', () => {
  const service = createService({
    name: 'Serviço com reajuste', price: 300, durationMinutes: 30, category: 'Prevenção'
  });
  const antes = createPayment(patient.id, { serviceId: service.id, dueDate: todayIso() });
  assert.strictEqual(antes.amount, 300);

  updateService(service.id, { price: 450 });

  const depois = createPayment(patient.id, { serviceId: service.id, dueDate: todayIso() });
  assert.strictEqual(depois.amount, 450, 'lançamento novo usa o preço atualizado');
  assert.strictEqual(getPayment(antes.id).amount, 300, 'lançamento antigo preserva o valor histórico');

  // editar outros campos do lançamento antigo não puxa o preço novo
  const editado = updatePayment(antes.id, { method: 'boleto' });
  assert.strictEqual(editado.amount, 300);
  assert.strictEqual(editado.methodLabel, 'Boleto');
});

test('lançamento aceita a opção "já recebido" e vincula a consulta do paciente', () => {
  let date = addDays(todayIso(), 21);
  while (weekdayOf(date) === 0) date = addDays(date, 1);
  const appt = createAppointment({
    patientId: patient.id, serviceId: svc60.id, date, time: '15:00', reason: 'Consulta'
  });

  const recebido = createPayment(patient.id, {
    serviceId: svc60.id, appointmentId: appt.id, dueDate: todayIso(), paid: true
  });
  assert.strictEqual(recebido.status, 'pago');
  assert.strictEqual(recebido.paidAt, todayIso());
  assert.strictEqual(recebido.appointmentId, appt.id);
  assert.strictEqual(recebido.amount, svc60.price);

  assert.throws(
    () => createPayment(other.id, { serviceId: svc60.id, appointmentId: appt.id, dueDate: todayIso() }),
    (error) => /outro paciente/.test(error.details?.appointmentId ?? '')
  );
});

test('serviço inativo não pode ser usado em novos lançamentos', () => {
  const service = createService({
    name: 'Serviço descontinuado', price: 200, durationMinutes: 30, category: 'Prevenção'
  });
  const ok = createPayment(patient.id, { serviceId: service.id, dueDate: todayIso() });
  assert.strictEqual(ok.amount, 200);

  updateService(service.id, { active: false });
  assert.throws(
    () => createPayment(patient.id, { serviceId: service.id, dueDate: todayIso() }),
    /não está disponível/
  );
  // o lançamento antigo continua íntegro
  assert.strictEqual(getPayment(ok.id).amount, 200);
});

/* --------------------------------------------------------------- relatórios */

test('relatórios agregam os números da base', () => {
  const report = reportsOverview();
  assert.strictEqual(report.revenueByMonth.length, 6);
  assert.strictEqual(report.newPatientsByMonth.length, 6);
  assert.ok(report.appointmentsByStatus.some((s) => s.key === 'cancelada'));
  assert.ok(report.occupancyByBand.length >= 1);
  assert.ok(report.totals.patients >= 2);
  assert.ok(report.plans.total >= 3);
  assert.ok(report.plans.approvalRate >= 0 && report.plans.approvalRate <= 100);
  assert.ok(Array.isArray(report.recall));
  assert.ok(Array.isArray(report.birthdays));

  // o faturamento do mês corrente reflete os pagamentos com baixa
  const mesAtual = report.revenueByMonth[report.revenueByMonth.length - 1];
  const recebidoNoMes = listPayments()
    .filter((p) => p.paidAt && p.paidAt.slice(0, 7) === todayIso().slice(0, 7))
    .reduce((s, p) => s + p.amount, 0);
  assert.strictEqual(Math.round(mesAtual.value * 100), Math.round(recebidoNoMes * 100));
});

test('excluir o paciente remove seus dados clínicos (cascata)', () => {
  const temp = createPatient({ name: 'Temporário De Teste', birthDate: '2000-01-01', sex: 'outro' }, false);
  setTooth(temp.id, 11, { status: 'cariado' });
  saveAnamnesis(temp.id, { answers: fullAnswers() }, 'clinica');
  createRecord(temp.id, { title: 'Consulta', description: 'Registro de evolução para teste.' });
  const plan = createPlan(temp.id, { title: 'Plano temporário', items: [{ serviceId: svc60.id }] });
  createPayment(temp.id, { description: 'Cobrança', amount: 100, dueDate: todayIso() });

  db.prepare('DELETE FROM patients WHERE id = ?').run(temp.id);

  const count = (table) => db.prepare(`SELECT COUNT(*) AS t FROM ${table} WHERE patient_id = ?`)
    .get(temp.id).t;
  assert.strictEqual(count('odontograms'), 0);
  assert.strictEqual(count('anamneses'), 0);
  assert.strictEqual(count('clinical_records'), 0);
  assert.strictEqual(count('treatment_plans'), 0);
  assert.strictEqual(count('payments'), 0);
  assert.strictEqual(
    db.prepare('SELECT COUNT(*) AS t FROM treatment_plan_items WHERE plan_id = ?').get(plan.id).t,
    0,
    'itens do plano também são removidos'
  );
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
  console.log(`\n${passed}/${tests.length} testes clínicos passaram.`);
  db.close();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
})();
