/* ==========================================================================
   AT/TUDE BARBEARIA — script.js
   JavaScript leve, sem dependências.
   ========================================================================== */
(() => {
  'use strict';

  // Número público de agendamento (formato internacional, apenas dígitos).
  // Deixe vazio ('') para desativar os links até o número ser confirmado.
  const CONFIG = {
    whatsapp: '5534991523214',
    message: 'Olá! Gostaria de agendar um horário na Atitude Barbearia.',
  };

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- WhatsApp ---------- */
  const waLink = (service) => {
    const text = service
      ? `${CONFIG.message.replace(/\.$/, '')} para o serviço: ${service}.`
      : CONFIG.message;
    return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
  };

  $$('[data-wa]').forEach((a) => {
    if (!CONFIG.whatsapp) {
      a.removeAttribute('href');
      a.setAttribute('aria-disabled', 'true');
      return;
    }
    a.href = waLink(a.dataset.wa || '');
  });

  /* ---------- Imagens: revela a foto real quando carrega ---------- */
  const markLoaded = (img) => {
    img.classList.add('is-loaded');
    img.closest('.media')?.classList.add('has-image');
  };
  // Fotos opcionais ([data-optional]) são ocultadas se o arquivo não existir
  const markMissing = (img) => img.closest('[data-optional]')?.classList.add('is-missing');
  $$('.media img').forEach((img) => {
    if (img.complete) {
      if (img.naturalWidth > 0) markLoaded(img); else markMissing(img);
      return;
    }
    img.addEventListener('load', () => markLoaded(img), { once: true });
    img.addEventListener('error', () => markMissing(img), { once: true });
  });

  /* ---------- Hero: entrada sequencial ---------- */
  $$('.hero [data-hero]').forEach((el, i) => el.style.setProperty('--d', (0.55 + i * 0.14).toFixed(2)));
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('is-ready')));

  /* ---------- Hero: parallax discreto (scroll + ponteiro) ---------- */
  const parallax = $('#heroParallax');
  const hero = $('#inicio');
  if (parallax && hero) {
    let scrollY = 0, px = 0, py = 0, tx = 0, ty = 0, ticking = false;
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    const render = () => {
      ticking = false;
      if (reducedMotion.matches) { parallax.style.transform = ''; return; }
      // suaviza o movimento do ponteiro
      tx += (px - tx) * 0.08;
      ty += (py - ty) * 0.08;
      const y = Math.min(scrollY, hero.offsetHeight) * 0.18;
      parallax.style.transform = `translate3d(${tx.toFixed(2)}px, ${(y + ty).toFixed(2)}px, 0)`;
      if (Math.abs(px - tx) > 0.1 || Math.abs(py - ty) > 0.1) request();
    };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(render); } };

    window.addEventListener('scroll', () => { scrollY = window.scrollY; request(); }, { passive: true });
    if (finePointer) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        px = ((e.clientX - r.left) / r.width - 0.5) * -14;
        py = ((e.clientY - r.top) / r.height - 0.5) * -10;
        request();
      });
      hero.addEventListener('pointerleave', () => { px = 0; py = 0; request(); });
    }
  }

  /* ---------- Navegação ---------- */
  const nav = $('#nav');
  const toggle = $('#navToggle');
  const menu = $('#menu');
  const waFloat = $('.wa-float');
  const booking = $('#agendamento');

  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
  });
  window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Indicador da seção atual
  const links = $$('.nav__menu a[href^="#"]');
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const sections = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
      const active = byId.get(entry.target.id);
      if (active) { active.classList.add('is-active'); active.setAttribute('aria-current', 'true'); }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));

  // Esconde o CTA flutuante sobre a seção de agendamento (evita CTA duplicado)
  if (waFloat && booking) {
    new IntersectionObserver(([entry]) => {
      waFloat.classList.toggle('is-hidden', entry.isIntersecting);
    }, { threshold: 0.25 }).observe(booking);
  }

  /* ---------- Scroll reveal ---------- */
  const reveals = $$('.reveal');
  if (!('IntersectionObserver' in window) || reducedMotion.matches) {
    reveals.forEach((el) => el.classList.add('is-visible'));
  } else {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        ro.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    // pequeno escalonamento entre itens irmãos
    reveals.forEach((el) => {
      const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
      const i = siblings.indexOf(el);
      if (i > 0) el.style.transitionDelay = `${Math.min(i, 6) * 70}ms`;
      ro.observe(el);
    });
  }

  /* ---------- Agendamento: seleção de serviço ---------- */
  const chips = $('#serviceChips');
  const form = $('#bookingForm');
  const hint = $('#bookingHint');
  const services = $$('#servicesList [data-service]');

  services.forEach((item, i) => {
    // preço/duração opcionais: só exibidos quando preenchidos no HTML
    const { price, duration } = item.dataset;
    const meta = $('.service__meta', item);
    if (meta && (price || duration)) {
      meta.innerHTML = '';
      if (price) { const s = document.createElement('strong'); s.textContent = price; meta.append(s); }
      if (duration) meta.append(document.createTextNode(duration));
    }

    const label = document.createElement('label');
    label.className = 'chip';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'servico';
    input.value = item.dataset.service;
    input.id = `servico-${i}`;
    const span = document.createElement('span');
    span.textContent = $('h3', item)?.textContent.trim() || item.dataset.service;
    label.append(input, span);
    chips.append(label);
  });

  const selected = () => $$('input[name="servico"]:checked', chips).map((i) => i.value);
  const listText = (arr) => (arr.length < 2 ? arr.join('') : `${arr.slice(0, -1).join(', ')} e ${arr.at(-1)}`);

  // Link real (não window.open): funciona mesmo onde pop-ups são bloqueados
  const bookingLink = $('#bookingLink');
  chips.addEventListener('change', () => {
    const s = selected();
    hint.textContent = s.length
      ? `Selecionado: ${listText(s)}.`
      : 'Nenhum serviço selecionado — você pode escolher na conversa.';
    if (CONFIG.whatsapp && bookingLink) bookingLink.href = waLink(listText(s));
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  /* ---------- Galeria: lightbox ---------- */
  const lightbox = $('#lightbox');
  const lbImg = $('#lightboxImg');
  const items = $$('#gallery .media');
  let current = -1;

  const available = () => items.filter((b) => b.classList.contains('has-image'));
  const show = (btn) => {
    const img = $('img', btn);
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    current = available().indexOf(btn);
  };
  const step = (dir) => {
    const list = available();
    if (list.length < 2) return;
    current = (current + dir + list.length) % list.length;
    show(list[current]);
  };

  if (lightbox && typeof lightbox.showModal === 'function') {
    items.forEach((btn) => btn.addEventListener('click', () => {
      if (!btn.classList.contains('has-image')) return;
      show(btn);
      lightbox.showModal();
    }));
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target.closest('[data-close]')) lightbox.close();
      else if (e.target.closest('[data-prev]')) step(-1);
      else if (e.target.closest('[data-next]')) step(1);
    });
    lightbox.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  }

  /* ---------- Ano no rodapé ---------- */
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
