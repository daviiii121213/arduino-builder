/* ==========================================================================
   AT/TUDE BARBEARIA — interações (JavaScript puro, sem dependências)
   ========================================================================== */
(() => {
  'use strict';

  // Número público de agendamento (apenas dígitos, com DDI). Vazio = links desativados.
  const CONFIG = {
    whatsapp: '5534991523214',
    message: 'Olá! Gostaria de agendar um horário na AT/TUDE BARBEARIA.',
  };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- WhatsApp ---------- */
  const listText = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} e ${a.at(-1)}`);
  const waLink = ({ services = [], pro = '' } = {}) => {
    let text = CONFIG.message;
    if (pro) text = text.replace(/\.$/, ` com o ${pro}.`);
    if (services.length) text += ` Serviço: ${listText(services)}.`;
    return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
  };
  $$('[data-wa]').forEach((a) => {
    if (!CONFIG.whatsapp) { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); return; }
    const service = a.dataset.wa;
    a.href = waLink({ services: service ? [service] : [], pro: a.dataset.pro || '' });
  });

  /* ---------- Abertura ---------- */
  const start = performance.now();
  const reveal = () => {
    if (root.classList.contains('is-loaded')) return;
    root.classList.add('is-loaded');
    setTimeout(() => $('#loader')?.remove(), 1200);
  };
  $$('.hero [data-hero]').forEach((el, i) => el.style.setProperty('--d', (0.35 + i * 0.12).toFixed(2)));
  if (reduced) {
    reveal();
  } else {
    const minShow = 950; // abertura curta: nunca deixa o site lento
    const go = () => setTimeout(reveal, Math.max(0, minShow - (performance.now() - start)));
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
    setTimeout(reveal, 2200); // garantia caso alguma imagem demore
  }

  /* ---------- Títulos em linhas: separa palavras ---------- */
  $$('[data-reveal="lines"]').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span style="--w:${i}">${w}</span></span>`).join(' ');
  });

  /* ---------- Revelação na rolagem ---------- */
  $$('[data-stagger]').forEach((group) => {
    [...group.children].forEach((child, i) => {
      const target = child.matches('[data-reveal]') ? child : $('[data-reveal]', child);
      if (target) target.style.setProperty('--i', i);
    });
  });
  $$('.menu__list li a').forEach((a, i) => a.style.setProperty('--i', i));

  // Lista de pendentes verificada a cada quadro de rolagem: revela o que entra
  // na tela e também o que foi "pulado" por um link do menu.
  let pending = $$('[data-reveal]');
  const revealPending = () => {
    if (!pending.length) return;
    const limit = window.innerHeight * 0.9;
    pending = pending.filter((el) => {
      if (el.getBoundingClientRect().top > limit) return true;
      el.classList.add('is-in');
      // depois da entrada, hovers respondem sem atraso
      setTimeout(() => { el.style.transitionDelay = '0s'; }, 1800);
      return false;
    });
  };
  if (reduced) pending.forEach((el) => el.classList.add('is-in'));

  /* ---------- Rolagem: parallax, faixa, progresso, nav ---------- */
  const nav = $('#nav');
  const bar = $('#progress');
  const wa = $('#waFloat');
  const book = $('#agendamento');
  const hero = $('#inicio');
  const allowParallax = !reduced && window.matchMedia('(min-width: 760px)').matches;
  const parallaxEls = allowParallax ? $$('[data-parallax]') : $$('.hero [data-parallax], .xp__glyph');
  const scrollX = reduced ? [] : $$('[data-scroll-x]');
  let ticking = false;
  let bookVisible = false;

  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;

    revealPending();
    nav.classList.toggle('is-scrolled', y > 30);
    bar.style.transform = `scaleX(${max > 0 ? (y / max).toFixed(4) : 0})`;
    wa.classList.toggle('is-hidden', y < hero.offsetHeight * 0.55 || bookVisible || document.body.classList.contains('menu-open'));

    if (reduced) return;
    parallaxEls.forEach((el) => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      const speed = parseFloat(el.dataset.parallax) || 0;
      const offset = (r.top + r.height / 2 - vh / 2) * speed;
      el.style.transform = `translate3d(0, ${(-offset).toFixed(1)}px, 0)`;
    });
    scrollX.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const speed = parseFloat(el.dataset.scrollX) || 0;
      el.style.transform = `translate3d(${((r.top - vh / 2) * speed).toFixed(1)}px, 0, 0)`;
    });
  };
  const requestTick = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  if (book) {
    new IntersectionObserver(([e]) => { bookVisible = e.isIntersecting; requestTick(); }, { threshold: 0.2 }).observe(book);
  }
  onScroll();

  /* ---------- Seção ativa + indicador ---------- */
  const navLinks = $$('#navList a');
  const menuLinks = $$('.menu__list a');
  const indicator = $('#navIndicator');
  const ids = navLinks.map((a) => a.hash.slice(1));
  const moveIndicator = (link) => {
    if (!indicator || !link || !link.offsetParent) { if (indicator) indicator.style.opacity = '0'; return; }
    const listLeft = link.closest('ul').offsetLeft;
    indicator.style.opacity = '1';
    indicator.style.transform = `translateX(${listLeft + link.offsetLeft}px) scaleX(${link.offsetWidth})`;
  };
  const setActive = (id) => {
    [...navLinks, ...menuLinks].forEach((a) => {
      const on = a.hash === `#${id}`;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    moveIndicator(navLinks.find((a) => a.hash === `#${id}`));
  };
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ids.map((id) => document.getElementById(id)).filter(Boolean).forEach((s) => spy.observe(s));
  window.addEventListener('resize', () => moveIndicator($('#navList a.is-active')));
  document.fonts?.ready.then(() => moveIndicator($('#navList a.is-active')));

  /* ---------- Menu mobile ---------- */
  const toggle = $('#menuToggle');
  const menu = $('#menu');
  let menuTimer;
  const setMenu = (open) => {
    clearTimeout(menuTimer);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('menu-open', open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
      setTimeout(() => $('a', menu)?.focus({ preventScroll: true }), 300);
    } else {
      menu.classList.remove('is-open');
      menuTimer = setTimeout(() => { menu.hidden = true; }, reduced ? 0 : 700);
    }
    requestTick();
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); }
  });
  window.matchMedia('(min-width: 1181px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- Cursor e botões magnéticos (desktop) ---------- */
  if (finePointer && !reduced) {
    const cursor = $('#cursor');
    const dot = $('.cursor__dot', cursor);
    const ring = $('.cursor__ring', cursor);
    let mx = -100, my = -100, rx = -100, ry = -100, running = false;
    root.classList.add('has-cursor');

    const loop = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      if (Math.abs(mx - rx) > 0.1 || Math.abs(my - ry) > 0.1) requestAnimationFrame(loop);
      else running = false;
    };
    document.addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      cursor.classList.add('is-on');
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
    document.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    document.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    document.addEventListener('pointerover', (e) => {
      cursor.classList.toggle('is-hover', !!e.target.closest('a, button, label, [role="button"]'));
    });

    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.22;
        const y = (e.clientY - r.top - r.height / 2) * 0.32;
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- Agendamento: seleção de serviços ---------- */
  const chips = $('#chips');
  const bookLink = $('#bookLink');
  const hint = $('#bookHint');
  $$('#services [data-service]').forEach((item, i) => {
    const { price, duration } = item.dataset;
    const meta = $('.svc__meta', item);
    if (meta && (price || duration)) {
      meta.textContent = '';
      if (price) { const s = document.createElement('strong'); s.textContent = price; meta.append(s); }
      if (duration) meta.append(document.createTextNode(duration));
    }
    const label = document.createElement('label');
    label.className = 'chip';
    label.setAttribute('data-reveal', 'fade-up');
    label.style.setProperty('--i', i);
    label.classList.add('is-in');
    const input = Object.assign(document.createElement('input'), { type: 'checkbox', name: 'servico', value: item.dataset.service, id: `servico-${i}` });
    const span = document.createElement('span');
    span.textContent = $('h3', item).textContent.trim();
    label.append(input, span);
    chips.append(label);
  });
  chips.addEventListener('change', () => {
    const selected = $$('input:checked', chips).map((i) => i.value);
    hint.textContent = selected.length ? `Selecionado: ${listText(selected)}.` : 'Nenhum serviço selecionado — você pode escolher na conversa.';
    if (CONFIG.whatsapp) bookLink.href = waLink({ services: selected });
  });
  $('#bookForm').addEventListener('submit', (e) => e.preventDefault());

  /* ---------- Galeria: lightbox ---------- */
  const lb = $('#lightbox');
  const lbImg = $('#lbImg');
  const lbCap = $('#lbCap');
  const lbCount = $('#lbCount');
  const shots = $$('#gallery .shot').sort((a, b) =>
    parseInt($('.shot__cap .mono', a).textContent, 10) - parseInt($('.shot__cap .mono', b).textContent, 10));
  let current = 0;
  let opener = null;
  const pad = (n) => String(n).padStart(2, '0');

  const show = (index, animate = true) => {
    current = (index + shots.length) % shots.length;
    const shot = shots[current];
    const apply = () => {
      lbImg.src = shot.dataset.full;
      lbImg.alt = $('img', shot).alt;
      lbCap.textContent = shot.dataset.caption;
      lbCount.textContent = `${pad(current + 1)} / ${pad(shots.length)}`;
      const done = () => lbImg.classList.remove('is-swap');
      if (lbImg.complete) requestAnimationFrame(done); else lbImg.addEventListener('load', done, { once: true });
    };
    if (animate && !reduced) { lbImg.classList.add('is-swap'); setTimeout(apply, 280); } else apply();
  };

  if (lb && typeof lb.showModal === 'function') {
    shots.forEach((shot, i) => shot.addEventListener('click', () => {
      opener = shot;
      show(i, false);
      lb.showModal();
      document.body.classList.add('menu-open');
      $('[data-lb="next"]', lb).focus();
    }));
    lb.addEventListener('close', () => { document.body.classList.remove('menu-open'); opener?.focus(); });
    lb.addEventListener('click', (e) => {
      const action = e.target.closest('[data-lb]')?.dataset.lb;
      if (action === 'close' || e.target === lb || e.target.classList.contains('lb__stage')) lb.close();
      else if (action === 'prev') show(current - 1);
      else if (action === 'next') show(current + 1);
    });
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
    let touchX = null;
    lb.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
      touchX = null;
    });
  }

  /* ---------- Ano ---------- */
  $('#year').textContent = new Date().getFullYear();
})();
