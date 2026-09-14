/* ==========================================================================
   MoviArt Studio de Dança — interações da landing page
   Sem dependências externas.
   ========================================================================== */
(function () {
  'use strict';

  /** WhatsApp oficial do studio: (34) 99238-1047 */
  var WHATSAPP = '5534992381047';

  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ------------------------------------------------------ Ano no rodapé */
  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* --------------------------------------------- Header fixo + menu mobile */
  var header = $('#header');
  var nav = $('#nav');
  var toggle = $('#menuToggle');

  function onScroll() {
    header.classList.toggle('is-stuck', window.scrollY > 24);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function closeMenu() {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu de navegação');
  }

  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu de navegação' : 'Abrir menu de navegação');
  });

  nav.addEventListener('click', function (ev) {
    if (ev.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') closeMenu();
  });

  /* ----------------------------------- Destaque do item de menu por seção */
  var navLinks = $$('.nav-link');
  var sections = navLinks
    .map(function (link) { return document.getElementById(link.getAttribute('href').slice(1)); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (section) { spy.observe(section); });
  }

  /* ------------------------------------------- Animações de entrada suaves */
  var revealables = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var reveal = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry, index) {
        if (!entry.isIntersecting) return;
        entry.target.style.transitionDelay = Math.min(index * 70, 280) + 'ms';
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .12 });

    revealables.forEach(function (el) { reveal.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ------------------------------------------------------ Galeria/Lightbox */
  var tiles = $$('#gallery .tile');
  var lightbox = $('#lightbox');

  if (tiles.length && lightbox) {
    var lbUse = $('#lbUse');
    var lbArtEl = $('#lbArt');
    var lbTitle = $('#lbTitle');
    var lbCaption = $('#lbCaption');
    var lbCta = $('#lbCta');
    var lastFocused = null;
    var current = 0;

    function render(index) {
      current = (index + tiles.length) % tiles.length;
      var tile = tiles[current];
      var title = tile.dataset.title;

      lbUse.setAttribute('href', '#' + tile.dataset.art);
      lbArtEl.style.setProperty('--art-fill', getComputedStyle(tile).getPropertyValue('--art-fill'));
      lbArtEl.style.setProperty('--art-stroke', getComputedStyle(tile).getPropertyValue('--art-stroke'));
      lbTitle.textContent = title;
      lbCaption.textContent = tile.dataset.caption;
      lbCta.href = 'https://wa.me/' + WHATSAPP + '?text=' +
        encodeURIComponent('Olá! Vi a galeria no site do MoviArt e gostaria de saber mais sobre ' + title + '.');
    }

    function openLightbox(index) {
      lastFocused = document.activeElement;
      render(index);
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
      $('#lbClose').focus();
    }

    function closeLightbox() {
      lightbox.hidden = true;
      document.body.style.overflow = '';
      if (lastFocused) lastFocused.focus();
    }

    tiles.forEach(function (tile, index) {
      tile.addEventListener('click', function () { openLightbox(index); });
      tile.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openLightbox(index);
        }
      });
    });

    $('#lbClose').addEventListener('click', closeLightbox);
    $('#lbPrev').addEventListener('click', function () { render(current - 1); });
    $('#lbNext').addEventListener('click', function () { render(current + 1); });

    lightbox.addEventListener('click', function (ev) {
      if (ev.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', function (ev) {
      if (lightbox.hidden) return;
      if (ev.key === 'Escape') closeLightbox();
      if (ev.key === 'ArrowLeft') render(current - 1);
      if (ev.key === 'ArrowRight') render(current + 1);
    });
  }

  /* ------------------------------------------------- Formulário → WhatsApp */
  var form = $('#leadForm');

  if (form) {
    var phone = $('#telefone');

    /* Máscara de telefone brasileira: (34) 99238-1047 */
    phone.addEventListener('input', function () {
      var digits = phone.value.replace(/\D/g, '').slice(0, 11);
      var out = '';
      if (digits.length) out = '(' + digits.slice(0, 2);
      if (digits.length >= 3) out += ') ' + digits.slice(2, digits.length > 10 ? 7 : 6);
      if (digits.length > (digits.length > 10 ? 7 : 6)) out += '-' + digits.slice(digits.length > 10 ? 7 : 6);
      phone.value = out;
    });

    function setError(field, message) {
      var wrapper = field.closest('.field');
      var box = $('#err-' + field.id);
      wrapper.classList.toggle('has-error', Boolean(message));
      field.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (!box) return;
      box.textContent = message || '';
      box.hidden = !message;
    }

    function validate() {
      var ok = true;
      var nome = $('#nome');
      var servico = $('#servico');

      if (nome.value.trim().length < 2) {
        setError(nome, 'Digite o seu nome para a gente saber com quem falar.');
        ok = false;
      } else { setError(nome, ''); }

      var digits = phone.value.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 11) {
        setError(phone, 'Informe um WhatsApp válido com DDD. Ex.: (34) 99238-1047.');
        ok = false;
      } else { setError(phone, ''); }

      if (!servico.value) {
        setError(servico, 'Escolha uma modalidade — ou "ainda não sei" se quiser orientação.');
        ok = false;
      } else { setError(servico, ''); }

      return ok;
    }

    /* Limpa o erro assim que o visitante corrige o campo */
    ['nome', 'telefone', 'servico'].forEach(function (id) {
      var field = document.getElementById(id);
      field.addEventListener('input', function () {
        if (field.closest('.field').classList.contains('has-error')) setError(field, '');
      });
      field.addEventListener('change', function () {
        if (field.closest('.field').classList.contains('has-error')) setError(field, '');
      });
    });

    function buildMessage(data) {
      var parts = ['Olá! Meu nome é ' + data.nome + '.'];

      parts.push(data.servico === 'ainda-nao-sei'
        ? 'Gostaria de começar a dançar no MoviArt, mas ainda não sei qual modalidade escolher.'
        : 'Tenho interesse nas aulas de ' + data.servico + '.');

      parts.push(data.periodo
        ? 'Gostaria de receber mais informações e verificar a disponibilidade para ' + data.periodo + '.'
        : 'Gostaria de receber mais informações e verificar a disponibilidade de horários.');

      parts.push('Meu WhatsApp é ' + data.telefone + '.');

      if (data.mensagem) parts.push('Mais detalhes: ' + data.mensagem);

      return parts.join(' ');
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();

      if (!validate()) {
        var firstError = $('.field.has-error input, .field.has-error select', form);
        if (firstError) firstError.focus();
        return;
      }

      var periodoSelect = $('#periodo');
      var message = buildMessage({
        nome: $('#nome').value.trim(),
        telefone: phone.value.trim(),
        servico: $('#servico').value,
        periodo: periodoSelect.value,
        mensagem: $('#mensagem').value.trim()
      });

      var url = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(message);

      var success = $('#formSuccess');
      $('#fallbackLink').href = url;
      success.hidden = false;

      /* wa.me funciona tanto no app mobile quanto no WhatsApp Web/Desktop */
      window.open(url, '_blank', 'noopener');

      success.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
})();
