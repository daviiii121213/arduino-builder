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

  /* ---------- Abertura ----------
     A tela de carregamento só sai quando todos os vídeos terminaram de baixar.
     Cada vídeo é baixado inteiro (fetch) e entregue ao <video> como blob, então
     depois disso toca sem travar. A barra e a porcentagem mostram o progresso real. */
  const loaderBar = $('#loaderBar');
  const loaderPct = $('#loaderPct');
  const loaderEl = $('#loader');
  const reveal = () => {
    if (root.classList.contains('is-loaded')) return;
    root.classList.add('is-loaded');
    setTimeout(() => loaderEl?.remove(), 1200);
    initVideos();
  };
  $$('.hero [data-hero]').forEach((el, i) => el.style.setProperty('--d', (0.35 + i * 0.12).toFixed(2)));

  const allVideos = $$('video[data-video]');
  const videoUrl = (video) => {
    // 1080p em telas grandes/densas, 720p no celular; WebM (menor) quando suportado, senão MP4.
    // data-res fixa a resolução (vídeos pequenos na página só têm 720p).
    const big = window.matchMedia('(min-width: 760px) and (min-resolution: 1.5dppx), (min-width: 1200px)').matches;
    const webm = video.canPlayType('video/webm; codecs="vp9"') === 'probably';
    return `${video.dataset.src}-${video.dataset.res || (big ? 1080 : 720)}.${webm ? 'webm' : 'mp4'}`;
  };
  const setProgress = (p) => {
    const pct = Math.min(100, Math.round(p * 100));
    if (loaderBar) loaderBar.style.transform = `scaleX(${p.toFixed(3)})`;
    if (loaderPct) loaderPct.textContent = `${pct}%`;
    loaderEl?.setAttribute('aria-valuenow', pct);
  };
  const preloadVideos = () => {
    // a mesma URL aparece em mais de um <video>: baixa uma vez e compartilha
    const urls = [...new Set(allVideos.map(videoUrl))];
    const frac = urls.map(() => 0);
    const update = () => setProgress(frac.reduce((s, f) => s + f, 0) / (urls.length || 1));
    const blobs = {};
    return Promise.all(urls.map(async (url, i) => {
      try {
        const res = await fetch(url);
        if (!res.ok || !res.body) throw new Error(res.status);
        const total = +res.headers.get('content-length') || 0;
        const reader = res.body.getReader();
        const chunks = [];
        let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          got += value.length;
          if (total) { frac[i] = Math.min(got / total, 0.99); update(); }
        }
        blobs[url] = URL.createObjectURL(new Blob(chunks, { type: res.headers.get('content-type') || '' }));
      } catch (e) { /* sem fetch/stream: o vídeo usa a URL direta */ }
      frac[i] = 1; update();
    })).then(() => {
      allVideos.forEach((v) => { v.src = blobs[videoUrl(v)] || videoUrl(v); v.dataset.ready = '1'; });
    });
  };

  if (reduced || !allVideos.length) {
    reveal();
  } else {
    const start = performance.now();
    const minShow = 900; // a animação do logo sempre completa
    const pageLoaded = new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true })));
    Promise.all([preloadVideos(), pageLoaded]).then(() => {
      setProgress(1);
      setTimeout(reveal, Math.max(250, minShow - (performance.now() - start)));
    });
    // garantia para conexões muito lentas: abre o site depois de 30 s e os vídeos seguem carregando
    setTimeout(() => {
      if (root.classList.contains('is-loaded')) return;
      allVideos.forEach((v) => { if (!v.dataset.ready) { v.src = videoUrl(v); v.dataset.ready = '1'; } });
      reveal();
    }, 30000);
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

  /* ---------- Cursor tesoura ---------- */
  const cursor = $('#cursor');
  let stopTimer;
  const placeCursor = (x, y) => { cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`; };
  const snip = () => {
    cursor.classList.remove('is-snip');
    void cursor.offsetWidth; // reinicia a animação a cada clique
    cursor.classList.add('is-snip');
  };
  cursor.addEventListener('animationend', (e) => {
    if (e.animationName.startsWith('snipOnce')) cursor.classList.remove('is-snip');
  });

  if (!reduced && finePointer) {
    // desktop: a tesoura substitui o cursor
    root.classList.add('has-cursor');
    // a ponta gira, suavemente, para a direção em que o mouse se move
    const scissors = $('.scissors', cursor);
    let lastX = null, lastY = null, rot = -30, targetRot = -30, turning = false;
    const turn = () => {
      const diff = ((targetRot - rot + 540) % 360) - 180; // menor caminho
      rot += diff * 0.2;
      scissors.style.setProperty('--rot', rot.toFixed(2));
      if (Math.abs(diff) > 0.3) requestAnimationFrame(turn); else turning = false;
    };
    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (lastX === null) { lastX = e.clientX; lastY = e.clientY; }
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (dx * dx + dy * dy > 64) { // acumula ~8px antes de virar: ignora tremidas
        targetRot = Math.atan2(dy, dx) * 180 / Math.PI + 90; // SVG aponta para cima
        lastX = e.clientX; lastY = e.clientY;
        if (!turning) { turning = true; requestAnimationFrame(turn); }
      }
      placeCursor(e.clientX, e.clientY);
      cursor.classList.add('is-on', 'is-moving');
      clearTimeout(stopTimer);
      stopTimer = setTimeout(() => cursor.classList.remove('is-moving'), 140); // parada = fechada
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => cursor.classList.remove('is-on', 'is-moving'));
    document.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') snip(); });
    document.addEventListener('pointerover', (e) => {
      cursor.classList.toggle('is-hover', !!e.target.closest('a, button, label, [role="button"]'));
    });
  }
  if (!reduced) {
    // toque: a tesoura aparece no ponto tocado, corta e some
    let tapTimer;
    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      placeCursor(e.clientX, e.clientY);
      cursor.classList.add('is-tap');
      snip();
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => cursor.classList.remove('is-tap'), 520);
    }, { passive: true });
  }

  /* ---------- Botões magnéticos (desktop) ---------- */
  if (finePointer && !reduced) {
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

  /* ---------- Vídeos (hero, Experiência, Galeria e Profissionais) ----------
     Já estão carregados quando a abertura sai. Tocam em loop enquanto visíveis;
     ao sair da tela (ou da aba) pausam, e ao voltar recomeçam do início. */
  function initVideos() {
    allVideos.forEach((video) => {
      const box = video.parentElement;
      let inView = false, left = false;
      if (!video.dataset.ready && !(reduced && video.closest('.hero'))) { video.src = videoUrl(video); video.dataset.ready = '1'; }
      // se o navegador recusar a cópia pré-carregada (blob), usa o arquivo normal
      video.addEventListener('error', () => {
        if (video.src.startsWith('blob:')) { video.src = videoUrl(video); if (inView) play(); }
      });
      const play = () => { const p = video.play(); if (p) p.catch(() => {}); };
      const restart = () => { try { video.currentTime = 0; } catch (e) { /* ainda sem metadados */ } play(); };

      if (reduced) {
        // movimento reduzido: sem reprodução automática. No hero fica a capa;
        // nas demais seções, controles para tocar se a pessoa quiser.
        if (!video.closest('.hero')) { video.controls = true; video.preload = 'metadata'; }
        return;
      }
      new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            inView = true;
            if (left) { left = false; restart(); } else play();
          } else if (inView) {
            inView = false;
            left = true;
            video.pause();
          }
        });
      }, { threshold: 0.25 }).observe(box);

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { if (!video.paused) { video.pause(); left = true; } }
        else if (inView && left) { left = false; restart(); }
      });
    });
  }

  /* ---------- Ano ---------- */
  $('#year').textContent = new Date().getFullYear();
})();
