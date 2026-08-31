(function () {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const msgEl = document.getElementById('form-msg');
  const submitBtn = document.getElementById('submit-btn');
  const WHATSAPP_NUMBER = '5534984036999';

  function setMsg(text, type) {
    msgEl.textContent = text || '';
    msgEl.className = 'form-msg' + (text ? ' show' : '') + (type ? ' ' + type : '');
  }

  function buildMessage(data) {
    const lines = [
      'Olá, Essence Pause! Vim pelo site e gostaria de agendar um horário.',
      '',
      `Nome: ${data.customerName}`,
      `Telefone: ${data.customerPhone}`,
    ];
    if (data.customerEmail) lines.push(`E-mail: ${data.customerEmail}`);
    lines.push(`Serviço desejado: ${data.serviceId}`);
    if (data.preferredDate) lines.push(`Preferência de data/horário: ${data.preferredDate}`);
    if (data.subject) lines.push(`Assunto: ${data.subject}`);
    if (data.notes) lines.push(`Observações: ${data.notes}`);
    return lines.join('\n');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    setMsg('', '');

    const customerName = document.getElementById('customerName').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const customerEmail = document.getElementById('customerEmail').value.trim();
    const serviceId = document.getElementById('serviceId').value;
    const preferredDate = document.getElementById('preferredDate').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const notes = document.getElementById('notes').value.trim();
    const consent = document.getElementById('consent').checked;

    if (customerName.length < 3) {
      setMsg('Informe seu nome completo.', 'error');
      return;
    }
    if (customerPhone.replace(/\D/g, '').length < 10) {
      setMsg('Informe um telefone/WhatsApp válido com DDD.', 'error');
      return;
    }
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      setMsg('Informe um e-mail válido, ou deixe o campo em branco.', 'error');
      return;
    }
    if (!serviceId) {
      setMsg('Selecione o serviço desejado.', 'error');
      return;
    }
    if (!consent) {
      setMsg('É preciso marcar a caixa de autorização de contato para enviar.', 'warn');
      return;
    }

    const message = buildMessage({ customerName, customerPhone, customerEmail, serviceId, preferredDate, subject, notes });
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Abrindo WhatsApp...';

    const win = window.open(url, '_blank', 'noopener');

    setMsg(
      win
        ? 'Sua mensagem foi preparada e o WhatsApp foi aberto em outra aba. É só confirmar o envio por lá.'
        : 'Não conseguimos abrir o WhatsApp automaticamente. Toque no botão abaixo para enviar sua mensagem.',
      'success'
    );

    if (!win) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.className = 'btn btn-primary';
      link.style.marginTop = '14px';
      link.textContent = 'Abrir WhatsApp manualmente';
      msgEl.appendChild(document.createElement('br'));
      msgEl.appendChild(link);
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar para o WhatsApp';
  });
})();
