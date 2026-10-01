/* Made In Juá — scripts do site (sem dependências) */
(function () {
  'use strict';

  var WA_NUMBER = '5527981174334';
  var WA_DEFAULT = 'Olá, Made In Juá! Vim pelo site e gostaria de mais informações sobre as peças.';
  var body = document.body;

  function waLink(msg) {
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg || WA_DEFAULT);
  }

  /* Links de WhatsApp: [data-wa] = mensagem; [data-wa-piece] = nome da peça */
  document.querySelectorAll('[data-wa], [data-wa-piece]').forEach(function (a) {
    var piece = a.getAttribute('data-wa-piece');
    var msg = piece
      ? 'Olá, Made In Juá! Vi a peça "' + piece + '" no site e tenho interesse. Poderia me passar mais informações?'
      : a.getAttribute('data-wa');
    a.href = waLink(msg);
    a.target = '_blank';
    a.rel = 'noopener';
  });

  /* Header ao rolar */
  var header = document.querySelector('.site-header');
  var waFloat = document.querySelector('.wa-float');
  var hasHero = body.classList.contains('has-hero');
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle('is-scrolled', y > 40);
    if (waFloat && hasHero) waFloat.classList.toggle('is-hidden', y < window.innerHeight * 0.5);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Menu mobile */
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('mobile-menu');
  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.menu-toggle__text').textContent = open ? 'Fechar' : 'Menu';
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    body.classList.toggle('menu-open', open);
    body.classList.toggle('is-locked', open);
  }
  if (toggle && menu) {
    toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); toggle.focus(); } });
  }

  /* Revelação ao entrar na tela */
  var reveals = document.querySelectorAll('.reveal, .reveal-img');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* Filtros (catálogo e galeria) */
  document.querySelectorAll('[data-filter-group]').forEach(function (group) {
    var target = document.getElementById(group.getAttribute('data-filter-group'));
    if (!target) return;
    var items = target.querySelectorAll('[data-category]');
    var chips = group.querySelectorAll('[data-filter]');
    var status = document.querySelector('[data-filter-status="' + target.id + '"]');

    function apply(cat, updateHash) {
      var shown = 0;
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-filter') === cat)); });
      items.forEach(function (it) {
        var match = cat === 'todas' || it.getAttribute('data-category').split(' ').indexOf(cat) > -1;
        it.hidden = !match;
        if (match) shown++;
      });
      if (status) status.textContent = shown === 1 ? 'Mostrando 1 item' : 'Mostrando ' + shown + ' itens';
      if (updateHash) history.replaceState(null, '', cat === 'todas' ? location.pathname : '#' + cat);
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function () { apply(c.getAttribute('data-filter'), true); });
    });
    var initial = location.hash.slice(1);
    if (initial && group.querySelector('[data-filter="' + initial + '"]')) apply(initial, false);
  });

  /* Lightbox */
  var lb = document.getElementById('lightbox');
  if (lb) {
    var img = lb.querySelector('.lightbox__img');
    var cap = lb.querySelector('.lightbox__cap');
    var count = lb.querySelector('.lightbox__count');
    var list = [], index = 0, lastFocus = null;

    function show(i) {
      index = (i + list.length) % list.length;
      var el = list[index];
      img.classList.add('is-loading');
      img.onload = function () { img.classList.remove('is-loading'); };
      img.src = el.getAttribute('data-src');
      img.alt = el.querySelector('img') ? el.querySelector('img').alt : '';
      cap.textContent = el.getAttribute('data-caption') || '';
      count.textContent = (index + 1) + ' / ' + list.length;
    }
    function open(el) {
      var group = el.getAttribute('data-lightbox');
      list = Array.prototype.filter.call(document.querySelectorAll('[data-lightbox="' + group + '"]'), function (x) {
        return !x.closest('[hidden]');
      });
      lastFocus = el;
      show(list.indexOf(el));
      lb.classList.add('is-open');
      lb.setAttribute('aria-hidden', 'false');
      body.classList.add('is-locked', 'lb-open');
      lb.querySelector('.lightbox__close').focus();
    }
    function close() {
      lb.classList.remove('is-open');
      lb.setAttribute('aria-hidden', 'true');
      body.classList.remove('is-locked', 'lb-open');
      if (lastFocus) lastFocus.focus();
    }
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-lightbox]');
      if (t) { e.preventDefault(); open(t); }
    });
    lb.querySelector('.lightbox__close').addEventListener('click', close);
    lb.querySelector('.lightbox__nav--prev').addEventListener('click', function () { show(index - 1); });
    lb.querySelector('.lightbox__nav--next').addEventListener('click', function () { show(index + 1); });
    lb.querySelector('.lightbox__stage').addEventListener('click', function (e) { if (e.target === e.currentTarget) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(index - 1);
      else if (e.key === 'ArrowRight') show(index + 1);
      else if (e.key === 'Tab') {
        var f = lb.querySelectorAll('button');
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    var startX = null;
    lb.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }

  /* Ano no rodapé */
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
