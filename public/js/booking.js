(function () {
  const form = document.getElementById('booking-form');
  if (!form) return;

  const steps = Array.from(document.querySelectorAll('.step'));
  const panels = Array.from(document.querySelectorAll('.booking-step-panel'));
  const serviceSelect = document.getElementById('serviceId');
  const dateInput = document.getElementById('date');
  const slotsGrid = document.getElementById('slots-grid');
  const slotsStatus = document.getElementById('slots-status');
  const step2Msg = document.getElementById('step2-msg');
  const step3Msg = document.getElementById('step3-msg');
  const summaryBox = document.getElementById('summary-box');
  const toStep2Btn = document.querySelector('[data-action="to-step-2"]');
  const toStep3Btn = document.querySelector('[data-action="to-step-3"]');
  const confirmBtn = document.getElementById('confirm-btn');

  let servicesCache = [];
  let selectedSlot = null;

  const today = new Date();
  dateInput.min = today.toISOString().slice(0, 10);

  function showPanel(name) {
    panels.forEach((p) => (p.style.display = p.dataset.panel === name ? '' : 'none'));
    steps.forEach((s) => {
      s.classList.toggle('active', s.dataset.step === name);
      s.classList.toggle('done', Number(s.dataset.step) < Number(name));
    });
  }

  function setMsg(el, text, type) {
    el.textContent = text || '';
    el.className = 'form-msg' + (text ? ' show' : '') + (type ? ' ' + type : '');
  }

  async function loadServices() {
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      servicesCache = data.services || [];
      serviceSelect.innerHTML =
        '<option value="">Selecione um serviço</option>' +
        servicesCache
          .map(
            (s) =>
              `<option value="${s.id}">${s.name} — ${s.priceLabel} (${s.durationMinutes} min)</option>`
          )
          .join('');
    } catch (err) {
      serviceSelect.innerHTML = '<option value="">Não foi possível carregar os serviços</option>';
    }
  }

  async function loadSlots() {
    const serviceId = serviceSelect.value;
    const date = dateInput.value;
    selectedSlot = null;
    toStep3Btn.disabled = true;
    slotsGrid.innerHTML = '';
    setMsg(step2Msg, '', '');

    if (!serviceId || !date) {
      slotsStatus.textContent = 'Selecione uma data para ver os horários.';
      slotsStatus.style.display = '';
      return;
    }

    slotsStatus.textContent = 'Buscando horários disponíveis...';
    slotsStatus.style.display = '';

    try {
      const res = await fetch(`/api/availability?serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`);
      const data = await res.json();

      if (!res.ok) {
        slotsStatus.style.display = '';
        slotsStatus.textContent = data.message || 'Não foi possível verificar a disponibilidade.';
        return;
      }

      if (!data.slots || data.slots.length === 0) {
        slotsStatus.style.display = '';
        slotsStatus.className = 'slots-empty';
        slotsStatus.textContent = 'Nenhum horário disponível nesta data. Escolha outra data.';
        return;
      }

      slotsStatus.style.display = 'none';
      slotsGrid.innerHTML = data.slots
        .map((time) => `<button type="button" class="slot-btn" data-time="${time}">${time}</button>`)
        .join('');
    } catch (err) {
      slotsStatus.style.display = '';
      slotsStatus.textContent = 'Erro ao buscar horários. Tente novamente.';
    }
  }

  slotsGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.slot-btn');
    if (!btn) return;
    slotsGrid.querySelectorAll('.slot-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedSlot = btn.dataset.time;
    toStep3Btn.disabled = false;
  });

  serviceSelect.addEventListener('change', loadSlots);
  dateInput.addEventListener('change', loadSlots);

  toStep2Btn.addEventListener('click', () => {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const serviceId = serviceSelect.value;

    if (name.length < 3 || phone.replace(/\D/g, '').length < 10 || !serviceId) {
      alert('Preencha nome completo, telefone/WhatsApp válido e escolha um serviço para continuar.');
      return;
    }
    showPanel('2');
  });

  document.querySelectorAll('[data-action="to-step-1"]').forEach((b) =>
    b.addEventListener('click', () => showPanel('1'))
  );
  document.querySelectorAll('[data-action="to-step-2"], [data-action="to-step-2-back"]').forEach(() => {});

  toStep3Btn.addEventListener('click', async () => {
    if (!selectedSlot) return;

    // Revalida a disponibilidade na hora de avançar, para reduzir a chance
    // de mostrar um resumo com um horário que outra pessoa acabou de pegar.
    // A verificação definitiva, porém, é sempre feita no servidor no envio.
    // `loadSlots()` reseta `selectedSlot` para null como primeiro passo, por
    // isso guardamos o valor escolhido antes de chamá-la.
    const targetSlot = selectedSlot;
    await loadSlots();
    const stillThere = Array.from(slotsGrid.querySelectorAll('.slot-btn')).some(
      (b) => b.dataset.time === targetSlot
    );
    if (!stillThere) {
      setMsg(step2Msg, 'Esse horário ficou indisponível enquanto você preenchia os dados. Escolha outro.', 'warn');
      toStep3Btn.disabled = true;
      return;
    }
    selectedSlot = targetSlot;
    Array.from(slotsGrid.querySelectorAll('.slot-btn')).forEach((b) => {
      if (b.dataset.time === selectedSlot) b.classList.add('selected');
    });

    const service = servicesCache.find((s) => s.id === serviceSelect.value);
    const dateObj = new Date(`${dateInput.value}T00:00:00`);
    const dateFmt = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    summaryBox.innerHTML = `
      <h4>Confira antes de confirmar</h4>
      <div class="summary-row"><span>Nome</span><span>${document.getElementById('customerName').value.trim()}</span></div>
      <div class="summary-row"><span>Serviço</span><span>${service ? service.name : ''}</span></div>
      <div class="summary-row"><span>Data</span><span>${dateFmt}</span></div>
      <div class="summary-row"><span>Horário</span><span>${selectedSlot}</span></div>
      <div class="summary-row"><span>Telefone</span><span>${document.getElementById('customerPhone').value.trim()}</span></div>
    `;
    setMsg(step3Msg, '', '');
    showPanel('3');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Confirmando...';
    setMsg(step3Msg, '', '');

    const payload = {
      serviceId: serviceSelect.value,
      date: dateInput.value,
      startTime: selectedSlot,
      customerName: document.getElementById('customerName').value.trim(),
      customerPhone: document.getElementById('customerPhone').value.trim(),
      customerEmail: document.getElementById('customerEmail').value.trim(),
      subject: document.getElementById('subject').value.trim(),
      notes: document.getElementById('notes').value.trim(),
    };

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        // O servidor é a fonte de verdade: se o horário foi ocupado por
        // outra pessoa entre a escolha e o envio, o backend rejeita aqui
        // mesmo que a interface tenha mostrado o horário como livre antes.
        setMsg(step3Msg, data.message || 'Não foi possível confirmar o agendamento.', 'error');
        if (data.error === 'SLOT_TAKEN' || data.error === 'OUTSIDE_BUSINESS_HOURS' || data.error === 'PAST_DATETIME') {
          selectedSlot = null;
          showPanel('2');
          loadSlots();
        }
        return;
      }

      document.getElementById('success-text').textContent =
        `${payload.customerName}, seu horário de ${data.appointment.serviceName} no dia ${new Date(payload.date + 'T00:00:00').toLocaleDateString('pt-BR')} às ${data.appointment.startTime} está confirmado. Até breve!`;
      showPanel('success');
    } catch (err) {
      setMsg(step3Msg, 'Erro de conexão. Tente novamente em instantes.', 'error');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirmar Agendamento';
    }
  });

  document.querySelector('[data-action="new-booking"]').addEventListener('click', () => {
    form.reset();
    selectedSlot = null;
    slotsGrid.innerHTML = '';
    slotsStatus.style.display = '';
    slotsStatus.textContent = 'Selecione uma data para ver os horários.';
    toStep3Btn.disabled = true;
    showPanel('1');
  });

  loadServices();

  if (window.location.hash === '#agendar') {
    document.getElementById('agendar').scrollIntoView({ behavior: 'smooth' });
  }
})();
