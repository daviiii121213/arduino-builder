/**
 * Dados oficiais da Essence Pause Uberlândia.
 *
 * Fontes reais (confirmadas pelo Instagram @essencepause.uberlandia):
 *  - nome, bio, endereço e WhatsApp.
 *
 * Campos marcados com `confirmado: false` são estimativas operacionais
 * necessárias para o sistema de agendamento funcionar (duração dos
 * atendimentos e horário de funcionamento) e NÃO foram informados pela
 * Essence Pause. Devem ser ajustados aqui assim que a loja confirmar os
 * valores reais — é só editar este arquivo, nada mais precisa mudar.
 */

module.exports = {
  brand: {
    name: 'Essence Pause',
    tagline: 'Sua pausa para cuidar da sua essência',
    instagramHandle: '@essencepause.uberlandia',
    instagramUrl: 'https://www.instagram.com/essencepause.uberlandia/',
    whatsapp: '5534984036999',
    whatsappDisplay: '(34) 98403-6999',
    address: {
      line1: 'Av. Rondon Pacheco, 2300 - Loja 136',
      city: 'Uberlândia',
      state: 'MG',
      full: 'Av. Rondon Pacheco, 2300 - Loja 136, Uberlândia - MG',
    },
  },

  // Horário de funcionamento — PLACEHOLDER, a confirmar com a Essence Pause.
  // 0 = domingo ... 6 = sábado. Dias ausentes = fechado.
  hoursConfirmed: false,
  businessHours: {
    1: { open: '09:00', close: '19:00' }, // segunda
    2: { open: '09:00', close: '19:00' },
    3: { open: '09:00', close: '19:00' },
    4: { open: '09:00', close: '19:00' },
    5: { open: '09:00', close: '19:00' },
    6: { open: '09:00', close: '17:00' }, // sábado
  },

  slotStepMinutes: 30,

  // Serviços citados na bio do Instagram: Cabelo, Unhas, Massagem,
  // Depilação, Botox. Duração e preço não foram divulgados publicamente —
  // duração é um valor operacional necessário para o motor de agendamento
  // (evitar sobreposição de horários) e deve ser confirmada pela loja;
  // preço fica em aberto ("Consulte") até ser informado.
  services: [
    {
      id: 'cabelo',
      name: 'Cabelo',
      shortDescription: 'Cortes, tratamentos e finalização para valorizar seu estilo.',
      description:
        'Atendimento capilar completo, do corte à finalização, pensado para realçar sua identidade com técnica e cuidado.',
      durationMinutes: 60,
      durationConfirmed: false,
      price: null,
      priceLabel: 'Consulte',
    },
    {
      id: 'unhas',
      name: 'Unhas',
      shortDescription: 'Manicure e pedicure com acabamento impecável.',
      description:
        'Cuidado completo para mãos e pés, com técnica cuidadosa e produtos de qualidade para um resultado duradouro.',
      durationMinutes: 60,
      durationConfirmed: false,
      price: null,
      priceLabel: 'Consulte',
    },
    {
      id: 'massagem',
      name: 'Massagem',
      shortDescription: 'Uma pausa para relaxar o corpo e a mente.',
      description:
        'Sessão de massagem relaxante em ambiente tranquilo, feita para desacelerar e renovar suas energias.',
      durationMinutes: 60,
      durationConfirmed: false,
      price: null,
      priceLabel: 'Consulte',
    },
    {
      id: 'depilacao',
      name: 'Depilação',
      shortDescription: 'Pele lisa e macia com técnica e conforto.',
      description:
        'Depilação realizada com cuidado e higiene, priorizando o conforto em cada etapa do atendimento.',
      durationMinutes: 45,
      durationConfirmed: false,
      price: null,
      priceLabel: 'Consulte',
    },
    {
      id: 'botox',
      name: 'Botox',
      shortDescription: 'Procedimento estético para suavizar linhas de expressão.',
      description:
        'Aplicação realizada com técnica e segurança, respeitando a naturalidade dos seus traços.',
      durationMinutes: 45,
      durationConfirmed: false,
      price: null,
      priceLabel: 'Consulte',
    },
  ],
};
