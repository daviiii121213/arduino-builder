(function () {
  "use strict";

  var CONFIG = window.GENESIS_CONFIG || {};
  var FORM_ROUTE = "#formulario";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("js");

  /* ---------------- Navegação entre as duas abas ---------------- */

  var views = { landing: $("#view-landing"), diagnostic: $("#view-diagnostic") };
  var currentView = null;

  function routeFor(hash) {
    if (hash === FORM_ROUTE) return "diagnostic";
    var id = hash.slice(1);
    var el = id && document.getElementById(id);
    if (el && views.diagnostic.contains(el)) return "diagnostic";
    return "landing";
  }

  function showView(name) {
    if (name === currentView) return false;
    Object.keys(views).forEach(function (key) { views[key].hidden = key !== name; });
    $$("[data-tab]").forEach(function (tab) {
      if (tab.getAttribute("data-tab") === name) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    document.body.setAttribute("data-current-view", name);
    currentView = name;
    return true;
  }

  function scrollToTarget(el) {
    if (!el) { window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); return; }
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  // Switching tabs: a curtain crosses the screen and the new page enters behind it.
  var wipe = $(".route-wipe");
  var wiping = false;

  function playWipe(done) {
    wiping = true;
    wipe.classList.add("is-covering");
    setTimeout(function () {
      done();
      wipe.classList.remove("is-covering");
      wipe.classList.add("is-leaving");
      setTimeout(function () { wipe.classList.remove("is-leaving"); wiping = false; }, 600);
    }, 500);
  }

  function enterView(view, initial) {
    var hero = view === "landing" ? $("#inicio") : $(".form-hero");
    var introPlays = initial && view === "landing" && !document.documentElement.classList.contains("no-intro");
    if (reduceMotion || introPlays) return;
    hero.classList.remove("is-entering");
    void hero.offsetWidth;
    hero.classList.add("is-entering");
    setTimeout(function () { hero.classList.remove("is-entering"); }, 1800);
  }

  function handleRoute(initial) {
    var hash = window.location.hash;
    if (hash === "#politica") { if (!currentView) showView("landing"); openPrivacy(); return; }
    if (hash === "#cookies") { if (!currentView) showView("landing"); openCookies(); return; }
    var view = routeFor(hash);
    if (!initial && currentView && view !== currentView && wipe && !reduceMotion) {
      closeMenu();
      // Behind the curtain, follow whatever the address is by then (the visitor may have clicked again).
      if (!wiping) playWipe(function () { var latest = window.location.hash; applyRoute(latest, routeFor(latest), false); });
      return;
    }
    if (wiping) return;
    applyRoute(hash, view, initial);
  }

  function applyRoute(hash, view, initial) {
    var changed = showView(view);
    if (changed) enterView(view, initial);
    var id = hash.slice(1);
    var target = id && id !== "formulario" && id !== "inicio" ? document.getElementById(id) : null;

    if (view === "diagnostic" && !target) {
      window.scrollTo(0, 0);
      if (!initial) $("#form-title").focus({ preventScroll: true });
    } else if (changed && !target) {
      window.scrollTo(0, 0);
    } else if (target || id === "inicio") {
      if (changed || initial) requestAnimationFrame(function () { scrollToTarget(target); });
      else scrollToTarget(target);
    }
    closeMenu();
  }

  $("#form-title").setAttribute("tabindex", "-1");
  window.addEventListener("hashchange", function () { handleRoute(false); });

  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest('a[href^="#"]');
    if (!link || link.hasAttribute("data-open-privacy") || link.hasAttribute("data-open-cookies")) return;
    var hash = link.getAttribute("href");
    var target = hash.length > 1 ? document.getElementById(hash.slice(1)) : null;
    // A section of the page already on screen: glide to it instead of letting the browser jump.
    if (target && hash !== FORM_ROUTE && currentView && routeFor(hash) === currentView && !wiping) {
      e.preventDefault();
      if (hash !== window.location.hash) history.pushState(null, "", hash);
      closeMenu();
      scrollToTarget(hash === "#inicio" ? null : target);
      return;
    }
    // Clicar de novo no mesmo link (hash inalterado) ainda deve rolar até a seção.
    if (hash === window.location.hash) {
      e.preventDefault();
      handleRoute(false);
    }
  });

  /* ---------------- Tela de abertura ---------------- */

  var intro = $(".intro");
  if (intro) {
    var skipIntro = function () { document.documentElement.classList.add("no-intro"); };
    intro.addEventListener("click", skipIntro);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") skipIntro(); });
    setTimeout(function () { document.documentElement.classList.add("intro-done"); }, 2400);
  }

  /* ---------------- Movimento ---------------- */

  $$(".hero-copy, .form-hero-copy, .form-hero-steps").forEach(function (box) {
    Array.prototype.forEach.call(box.children, function (el, i) { el.style.setProperty("--i", i); });
  });
  if ($(".hero-media")) $(".hero-media").style.setProperty("--i", 3);

  var header = $(".site-header");
  var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 24); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // The hero logo follows the pointer a little.
  var heroSection = $("#inicio");
  var heroMedia = $(".hero-media");
  if (heroMedia && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    heroSection.addEventListener("pointermove", function (e) {
      var r = heroSection.getBoundingClientRect();
      heroMedia.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      heroMedia.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    heroSection.addEventListener("pointerleave", function () {
      heroMedia.style.setProperty("--px", 0);
      heroMedia.style.setProperty("--py", 0);
    });
  }

  // Sections and items rise into place as they scroll into view.
  if ("IntersectionObserver" in window && !reduceMotion) {
    var tag = function (sel, extra, step) {
      $$(sel).forEach(function (el) {
        el.classList.add("reveal");
        if (extra) el.classList.add(extra);
        if (step) {
          var i = Array.prototype.indexOf.call(el.parentNode.children, el);
          el.style.setProperty("--d", Math.min(i, 6) * step + "ms");
        }
      });
    };
    tag(".section-title, .section-intro, .closing-line, .integrator, .highlight-band, .disclaimer, .quote-band p, .split > div > p, .phase, .form-block");
    tag(".highlight", "reveal-left");
    tag(".diagram", "reveal-zoom");
    tag(".pain-item, .pillar, .diff-item, .duo > *, .council-card, .contact-card, .acc-item, .step, .cta-inner > *, .footer-grid > *", null, 110);
    document.documentElement.classList.add("js-reveal");
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        revealer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    $$(".reveal").forEach(function (el) { revealer.observe(el); });
  }

  /* ---------------- Menu móvel ---------------- */

  var menuBtn = $(".menu-toggle");
  var mobileMenu = $("#menu-mobile");

  function closeMenu() {
    if (mobileMenu.hidden) return;
    mobileMenu.hidden = true;
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Abrir menu");
  }

  menuBtn.addEventListener("click", function () {
    var open = mobileMenu.hidden;
    mobileMenu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    if (open) $("a", mobileMenu).focus();
  });
  mobileMenu.addEventListener("click", function (e) { if (e.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !mobileMenu.hidden) { closeMenu(); menuBtn.focus(); }
  });

  /* ---------------- Seção ativa no menu de seções ---------------- */

  if ("IntersectionObserver" in window) {
    var sectionLinks = $$(".section-nav a");
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        sectionLinks.forEach(function (a) {
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    $$("#view-landing > section[id]").forEach(function (s) { observer.observe(s); });
  }

  /* ---------------- Canais de contato ---------------- */

  function channelHref(channel) {
    if (channel === "whatsapp" && /^\d{12,13}$/.test(CONFIG.whatsappNumber || "")) {
      return "https://wa.me/" + CONFIG.whatsappNumber + "?text=" + encodeURIComponent(CONFIG.whatsappMessage || "");
    }
    if (channel === "email" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(CONFIG.email || "")) {
      return "mailto:" + CONFIG.email;
    }
    if (channel === "instagram" && /^https:\/\/(www\.)?instagram\.com\//.test(CONFIG.instagramUrl || "")) {
      return CONFIG.instagramUrl;
    }
    return null;
  }

  var PENDING_TEXT = { whatsapp: "Número oficial a configurar", email: "E-mail oficial a configurar", instagram: "Link a confirmar" };

  $$("[data-channel]").forEach(function (el) {
    var channel = el.getAttribute("data-channel");
    var href = channelHref(channel);
    if (href) {
      el.href = href;
      el.target = "_blank";
      el.rel = "noopener";
      if (el.hasAttribute("data-float")) el.hidden = false;
      return;
    }
    if (el.hasAttribute("data-float")) { el.remove(); return; }
    el.removeAttribute("href");
    el.setAttribute("aria-disabled", "true");
    el.classList.add("is-pending");
    var note = document.createElement("span");
    note.className = "pending-note";
    note.textContent = PENDING_TEXT[channel];
    if (el.hasAttribute("data-compact")) {
      el.appendChild(document.createTextNode(" "));
      note.textContent = "(" + PENDING_TEXT[channel].toLowerCase() + ")";
      el.appendChild(note);
    } else {
      el.insertAdjacentElement("afterend", note);
    }
  });

  /* ---------------- Dados da empresa no rodapé ---------------- */

  var companyId = $("[data-company-id]");
  if (companyId && (CONFIG.cnpj || CONFIG.razaoSocial)) {
    var cnpjDigits = (CONFIG.cnpj || "").replace(/\D/g, "");
    var cnpjText = cnpjDigits.length === 14
      ? cnpjDigits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
      : (CONFIG.cnpj || "");
    companyId.textContent = [CONFIG.razaoSocial, cnpjText && "CNPJ " + cnpjText].filter(Boolean).join(" · ");
    // Until the real number is in, keep the discreet "pending" look.
    companyId.classList.toggle("placeholder-tag", cnpjDigits.length !== 14);
  }

  /* ---------------- Acordeão (FAQ) ---------------- */

  $$("[data-accordion] button[aria-controls]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      document.getElementById(btn.getAttribute("aria-controls")).classList.toggle("is-open", !open);
    });
  });

  /* ---------------- Política de Privacidade ---------------- */

  var dialog = $("#privacy-dialog");
  var lastFocus = null;

  var sendingEnabled = !!CONFIG.submitEndpoint;

  $("#privacy-transmission").textContent = sendingEnabled
    ? "Ao enviar, as respostas são transmitidas por conexão segura ao servidor do Projeto Gênesis, que as encaminha por e-mail à equipe."
    : "No momento, o envio não está ativo: as respostas não são transmitidas a ninguém.";

  function openPrivacy() {
    lastFocus = document.activeElement;
    if (typeof dialog.showModal === "function") { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute("open", "");
  }
  function closePrivacy() {
    if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
  }
  dialog.addEventListener("close", function () { if (lastFocus) lastFocus.focus(); });
  $$("[data-open-privacy]").forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); openPrivacy(); });
  });
  $$("[data-close-privacy]").forEach(function (b) { b.addEventListener("click", closePrivacy); });
  dialog.addEventListener("click", function (e) { if (e.target === dialog) closePrivacy(); });

  /* ----- Política de Cookies e aviso ----- */
  var cookiesDialog = $("#cookies-dialog");
  function openCookies() {
    lastFocus = document.activeElement;
    if (typeof cookiesDialog.showModal === "function") { if (!cookiesDialog.open) cookiesDialog.showModal(); }
    else cookiesDialog.setAttribute("open", "");
  }
  function closeCookies() {
    if (typeof cookiesDialog.close === "function") cookiesDialog.close(); else cookiesDialog.removeAttribute("open");
  }
  cookiesDialog.addEventListener("close", function () { if (lastFocus) lastFocus.focus(); });
  cookiesDialog.addEventListener("click", function (e) { if (e.target === cookiesDialog) closeCookies(); });
  $$("[data-open-cookies]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); openCookies(); }); });
  $$("[data-close-cookies]").forEach(function (b) { b.addEventListener("click", closeCookies); });
  window.GenesisCookies = { abrir: openCookies };

  var cookieBar = $("#cookie-bar"), AVISO_KEY = "genesis-aviso-cookies";
  var avisoVisto = false;
  try { avisoVisto = !!localStorage.getItem(AVISO_KEY); } catch (e) { avisoVisto = false; }
  if (!avisoVisto) {
    cookieBar.hidden = false;
    document.documentElement.classList.add("has-cookie-bar");
  }
  $("#cookie-ok").addEventListener("click", function () {
    try { localStorage.setItem(AVISO_KEY, new Date().toISOString()); } catch (e) { /* storage unavailable */ }
    cookieBar.hidden = true;
    document.documentElement.classList.remove("has-cookie-bar");
  });

  /* ---------------- Diagnóstico: Termômetro Organizacional ---------------- */

  var T = window.Termometro;
  var INDICADORES = T.dados.indicadores;
  var form = $("#diagnostic-form");
  var statusBox = $("#form-status");
  var submitBtn = $("#submit-btn");
  var summary = $("#error-summary");
  var STORE_KEY = "genesis-diagnostico-v1";
  var STAGES = ["identificacao", "questionario", "cenario", "processando", "resultado"];
  var state = { stage: "identificacao", index: 0, notas: {}, resultado: null, envio: null, enviadoEm: null, iniciadoEm: null };

  function esc(texto) {
    return String(texto === null || texto === undefined ? "" : texto)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function val(name) {
    var el = form.elements[name];
    if (!el) return "";
    if (el.type === "checkbox") return el.checked;
    return (el.value || "").trim();
  }

  function radioValue(name) {
    var checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : "";
  }

  function phoneDigits(v) {
    var d = v.replace(/\D/g, "");
    if (d.length >= 12 && d.indexOf("55") === 0) d = d.slice(2);
    if (d.length === 11 && d[0] === "0") d = d.slice(1);
    return d;
  }

  function respondidas() {
    return INDICADORES.filter(function (i) { return typeof state.notas[i.codigo] === "number"; }).length;
  }

  /* ----- Validação (identificação e cenário atual) ----- */

  /* ----- Validadores de nome, empresa, WhatsApp e e-mail (os mesmos critérios são conferidos no servidor) ----- */
  var DDDS = [11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99];
  var LIXO_EMPRESA = ["teste", "test", "testes", "asdf", "qwerty", "abc", "xxx", "xxxx", "empresa", "minha empresa", "nenhuma", "nenhum", "na", "n/a", "nao tem", "não tem", "sem empresa", "-", "."];
  function limparEspacos(v) { return v.replace(/\s+/g, " ").trim(); }
  function semAcento(v) { return v.normalize ? v.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : v; }
  function repetido(v) { return /(.)\1{3,}/i.test(v.replace(/\s/g, "")); }

  function validarNome(v) {
    v = limparEspacos(v);
    if (!v) return "Informe o seu nome.";
    if (/\d/.test(v)) return "O nome não pode ter números.";
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' .\-]+$/.test(v)) return "Use só letras no nome (acentos, hífen e apóstrofo são aceitos).";
    var partes = v.split(" ").filter(function (p) { return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(p); });
    if (partes.length < 2) return "Informe nome e sobrenome.";
    if (partes[0].replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "").length < 2) return "Escreva o primeiro nome por extenso.";
    if (repetido(v)) return "Confira o nome digitado.";
    if (v.length > 120) return "Nome muito longo.";
    return "";
  }

  function validarEmpresa(v) {
    v = limparEspacos(v);
    if (!v) return "Informe o nome da empresa.";
    var alnum = v.replace(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
    if (alnum.length < 2 || !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(v)) return "Informe o nome da empresa com pelo menos 2 letras ou números.";
    if (LIXO_EMPRESA.indexOf(semAcento(v.toLowerCase())) !== -1 || LIXO_EMPRESA.indexOf(v.toLowerCase()) !== -1) return "Informe o nome real da empresa.";
    if (repetido(v)) return "Confira o nome da empresa.";
    if (v.length > 160) return "Nome muito longo.";
    return "";
  }

  function validarWhatsapp(v) {
    if (!v) return "Informe o seu WhatsApp.";
    if (/[^\d\s()+.\-]/.test(v)) return "Use apenas números e, se quiser, parênteses, espaços ou hífen.";
    var d = phoneDigits(v);
    if (d.length < 10 || d.length > 11) return "Informe o número com DDD, por exemplo (34) 99999-9999.";
    if (DDDS.indexOf(Number(d.slice(0, 2))) === -1) return "O DDD " + d.slice(0, 2) + " não existe. Confira os dois primeiros números.";
    var num = d.slice(2);
    if (/^(\d)\1+$/.test(num) || num === "123456789" || num === "987654321") return "Confira o número digitado.";
    if (d.length === 11 && num[0] !== "9") return "Celular com 9 dígitos começa com 9. Confira o número.";
    if (d.length === 10 && "6789".indexOf(num[0]) !== -1) return "Parece um celular sem o 9 na frente. Digite os 9 dígitos depois do DDD.";
    return "";
  }

  function formatarWhatsapp(v) {
    var d = phoneDigits(v);
    if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
    if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return v;
  }

  var DOMINIOS = ["gmail.com", "hotmail.com", "outlook.com", "outlook.com.br", "yahoo.com", "yahoo.com.br", "icloud.com", "live.com", "bol.com.br", "uol.com.br", "terra.com.br", "hotmail.com.br"];
  function distancia(a, b) {
    var m = [], i, j;
    for (i = 0; i <= b.length; i++) m[i] = [i];
    for (j = 0; j <= a.length; j++) m[0][j] = j;
    for (i = 1; i <= b.length; i++) for (j = 1; j <= a.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1));
    return m[b.length][a.length];
  }
  // "fulano@gmial.com" -> "fulano@gmail.com"; null when nothing to suggest.
  function sugerirEmail(v) {
    var at = v.lastIndexOf("@");
    if (at < 1) return null;
    var local = v.slice(0, at), dom = v.slice(at + 1).toLowerCase();
    var fix = dom.replace(/\.con$/, ".com").replace(/\.cmo$/, ".com").replace(/\.co$/, ".com").replace(/\.combr$/, ".com.br").replace(/\.com\.b$/, ".com.br").replace(/\.com\.bt$/, ".com.br").replace(/\.br\.com$/, ".com.br");
    if (fix === "gmail.com.br") fix = "gmail.com";
    var melhor = null, menor = 3;
    DOMINIOS.forEach(function (d2) { var x = distancia(fix, d2); if (x < menor && x > 0) { menor = x; melhor = d2; } });
    if (DOMINIOS.indexOf(fix) !== -1) melhor = fix;
    var alvo = melhor && menor <= 2 ? melhor : fix;
    return alvo !== dom ? local + "@" + alvo : null;
  }

  function validarEmail(v) {
    v = v.trim();
    if (!v) return "Informe o seu e-mail.";
    if (/\s/.test(v)) return "O e-mail não pode ter espaços.";
    var m = v.match(/^([A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+)@([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)$/);
    if (!m) return "Informe um e-mail válido, por exemplo nome@empresa.com.br.";
    if (/^\.|\.$|\.\./.test(m[1])) return "Confira os pontos antes do @.";
    if (!/\.[A-Za-z]{2,}$/.test(m[2])) return "Confira o final do e-mail (ex.: .com ou .com.br).";
    if (v.length > 160) return "E-mail muito longo.";
    return "";
  }

  var FIELDS = [
    { name: "nome", stage: "identificacao", label: "Seu nome", check: validarNome },
    { name: "cargo", stage: "identificacao", label: "Cargo ou função", check: function (v) { return v ? "" : "Selecione o seu cargo ou função."; } },
    { name: "empresa", stage: "identificacao", label: "Nome da empresa", check: validarEmpresa },
    { name: "segmento", stage: "identificacao", label: "Segmento", check: function (v) { return v ? "" : "Selecione o segmento da empresa."; } },
    { name: "colaboradores", stage: "identificacao", label: "Número de colaboradores", check: function (v) { return v ? "" : "Selecione o número de colaboradores."; } },
    { name: "cidade", stage: "identificacao", label: "Cidade", check: function (v) { return v ? "" : "Informe a cidade."; } },
    { name: "whatsapp", stage: "identificacao", label: "WhatsApp", check: validarWhatsapp },
    { name: "email", stage: "identificacao", label: "E-mail", check: validarEmail },
    { name: "principal_preocupacao", stage: "cenario", group: true, label: "O que mais tira o seu sono hoje?", check: function (v) { return v ? "" : "Escolha uma opção."; } },
    { name: "preferencia_contato", stage: "cenario", group: true, label: "Como prefere ser contatado?", check: function (v) { return v ? "" : "Escolha como prefere ser contatado."; } },
    { name: "consentimento", stage: "cenario", label: "Consentimento", check: function (v) { return v ? "" : "Para enviar, é preciso autorizar o uso dos dados."; } }
  ];

  function fieldValue(f) { return f.group ? radioValue(f.name) : val(f.name); }

  function setError(f, msg) {
    document.getElementById(f.name + "-err").textContent = msg;
    var host = f.group ? document.getElementById(f.name + "-group") : form.elements[f.name];
    host.classList.toggle("has-error", !!msg);
    if (!f.group) host.classList.toggle("is-valid", !msg && !!fieldValue(f));
    var inputs = f.group ? $$('input[name="' + f.name + '"]', form) : [host];
    inputs.forEach(function (i) { if (msg) i.setAttribute("aria-invalid", "true"); else i.removeAttribute("aria-invalid"); });
  }

  var touched = {};
  function validateField(f) {
    var msg = f.check(fieldValue(f));
    setError(f, msg);
    return msg;
  }

  function firstFocusable(f) {
    return f.group ? form.querySelector('input[name="' + f.name + '"]') : form.elements[f.name];
  }

  // Validates one stage; lists the problems at the top and returns true when everything is filled in.
  function validateStage(stage) {
    var errors = [];
    FIELDS.filter(function (f) { return f.stage === stage; }).forEach(function (f) {
      touched[f.name] = true;
      var msg = validateField(f);
      if (msg) errors.push({ f: f, msg: msg });
    });
    var list = $("ul", summary);
    list.innerHTML = "";
    if (!errors.length) { summary.hidden = true; return true; }
    errors.forEach(function (er) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + (er.f.group ? er.f.name + "-group" : er.f.name);
      a.textContent = er.f.label + ": " + er.msg;
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        var target = firstFocusable(er.f);
        target.focus({ preventScroll: true });
        (er.f.group ? document.getElementById(er.f.name + "-group") : target).scrollIntoView({ block: "center" });
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    $("h2", summary).textContent = errors.length === 1 ? "Revise 1 campo para continuar" : "Revise " + errors.length + " campos para continuar";
    summary.hidden = false;
    summary.focus();
    return false;
  }

  form.addEventListener("change", onFieldEvent);
  form.addEventListener("input", onFieldEvent);
  // Tidies the value when the visitor leaves the field: extra spaces, phone mask, e-mail in lower case.
  function arrumarCampo(el) {
    var v = el.value;
    if (el.name === "nome" || el.name === "empresa" || el.name === "cidade") v = limparEspacos(v);
    if (el.name === "whatsapp" && !validarWhatsapp(v)) v = formatarWhatsapp(v);
    if (el.name === "email") v = v.trim().toLowerCase();
    if (v !== el.value) el.value = v;
  }

  var sugestaoBox = $("#email-sugestao");
  function mostrarSugestaoEmail() {
    if (!sugestaoBox) return;
    var v = val("email"), sug = !validarEmail(v) ? sugerirEmail(v) : null;
    sugestaoBox.hidden = !sug;
    if (sug) {
      sugestaoBox.innerHTML = 'Você quis dizer <button type="button" class="link-btn">' + esc(sug) + "</button>?";
      sugestaoBox.querySelector("button").addEventListener("click", function () {
        form.elements.email.value = sug; sugestaoBox.hidden = true;
        validateField(FIELDS.filter(function (x) { return x.name === "email"; })[0]); salvar();
        form.elements.email.focus();
      });
    }
  }

  form.addEventListener("focusout", function (e) {
    var f = FIELDS.filter(function (x) { return x.name === e.target.name && !x.group; })[0];
    if (f && e.target.tagName === "INPUT") arrumarCampo(e.target);
    if (f && (e.target.value || touched[f.name])) { touched[f.name] = true; validateField(f); }
    if (e.target.name === "email" && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest("#email-sugestao"))) mostrarSugestaoEmail();
  });

  function onFieldEvent(e) {
    var name = e.target.name;
    if (!name || name === "nota") return;
    var f = FIELDS.filter(function (x) { return x.name === name; })[0];
    if (f && (touched[name] || f.group || e.target.type === "checkbox" || e.target.tagName === "SELECT")) {
      touched[name] = true;
      validateField(f);
    }
    salvar();
  }

  /* ----- Salvamento automático (neste navegador) ----- */

  var CAMPOS = ["nome", "cargo", "empresa", "segmento", "colaboradores", "cidade", "whatsapp", "email", "comentario_adicional"];
  var autosave = $("#autosave");
  var autosaveTimer = null;

  function lerCampos() {
    var campos = {};
    CAMPOS.forEach(function (n) { campos[n] = val(n); });
    campos.principal_preocupacao = radioValue("principal_preocupacao");
    campos.preferencia_contato = radioValue("preferencia_contato");
    campos.consentimento = val("consentimento") === true;
    return campos;
  }

  function aplicarCampos(campos) {
    if (!campos) return;
    CAMPOS.forEach(function (n) { if (typeof campos[n] === "string" && form.elements[n]) form.elements[n].value = campos[n]; });
    ["principal_preocupacao", "preferencia_contato"].forEach(function (n) {
      var input = campos[n] && form.querySelector('input[name="' + n + '"][value="' + campos[n].replace(/"/g, "") + '"]');
      if (input) input.checked = true;
    });
    form.elements.consentimento.checked = !!campos.consentimento;
  }

  function salvar() {
    var dados = {
      versao: 1, stage: state.stage === "processando" ? "cenario" : state.stage, index: state.index,
      notas: state.notas, campos: lerCampos(), envio: state.envio, enviadoEm: state.enviadoEm, iniciadoEm: state.iniciadoEm, salvoEm: new Date().toISOString()
    };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(dados)); } catch (e) { return; }
    autosave.textContent = "Respostas salvas neste navegador";
    autosave.classList.add("is-visible");
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(function () { autosave.classList.remove("is-visible"); }, 1800);
  }

  function carregar() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { return null; }
  }

  function apagar() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* storage unavailable */ }
  }

  /* ----- Etapas ----- */

  var stageSections = {};
  $$("[data-stage]", form).forEach(function (sec) { stageSections[sec.getAttribute("data-stage")] = sec; });
  var wizardTop = $(".wizard-top");

  function atualizarProgresso() {
    var ordem = ["identificacao", "questionario", "cenario", "resultado"];
    var atual = state.stage === "processando" ? "resultado" : state.stage;
    var pos = ordem.indexOf(atual);
    $$("[data-stage-step]").forEach(function (li) {
      var k = ordem.indexOf(li.getAttribute("data-stage-step"));
      li.classList.toggle("is-done", k < pos || (atual === "resultado" && k === pos && state.resultado));
      li.classList.toggle("is-current", k === pos);
      if (k === pos) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    var pct = { identificacao: 4, questionario: 10 + 75 * respondidas() / INDICADORES.length, cenario: 90, processando: 96, resultado: 100 }[state.stage];
    $("#wizard-bar-fill").style.width = pct + "%";
  }

  function mostrarEtapa(stage, foco) {
    state.stage = stage;
    if (stage === "cenario" && typeof carregarTurnstile === "function") carregarTurnstile();
    STAGES.forEach(function (s) { stageSections[s].hidden = s !== stage; });
    stageSections[stage].classList.remove("stage-enter");
    void stageSections[stage].offsetWidth;
    stageSections[stage].classList.add("stage-enter");
    summary.hidden = true;
    atualizarProgresso();
    if (stage === "questionario") renderPergunta();
    rolarParaEtapa(true);
    if (foco !== false) {
      var alvo = stage === "questionario" ? $("#q-title") : $("[tabindex='-1']", stageSections[stage]);
      if (alvo) setTimeout(function () { alvo.focus({ preventScroll: true }); }, reduceMotion ? 0 : 350);
    }
    if (stage !== "processando") salvar();
  }

  // Brings the top of the current step just below the header and the sticky step bar.
  function rolarParaEtapa(sempre) {
    var headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;
    var folga = headerH + wizardTop.offsetHeight + 12;
    var alvo = stageSections[state.stage];
    // Layout position, ignoring the entrance animation's transform.
    var abs = 0;
    for (var el = alvo; el; el = el.offsetParent) abs += el.offsetTop;
    var topo = abs - window.scrollY;
    if (!sempre && topo >= folga && topo < window.innerHeight * 0.5) return;
    window.scrollTo({ top: Math.max(0, topo + window.scrollY - folga), behavior: reduceMotion ? "auto" : "smooth" });
  }

  $$("[data-next]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!validateStage(state.stage)) return;
      if (!state.iniciadoEm) state.iniciadoEm = new Date().toISOString();
      evento("inicio", true);
      mostrarEtapa(b.getAttribute("data-next"));
    });
  });
  $$("[data-back]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.index = INDICADORES.length - 1;
      mostrarEtapa(b.getAttribute("data-back"));
    });
  });

  /* ----- Questionário: uma pergunta por tela ----- */

  var qScale = $("#q-scale");
  var qMap = $("#q-map");
  var qError = $("#q-error");
  var extremos = (T.dados.diretriz.match(/\((0 = [^|]+)\|\s*(10 = [^)]+)\)/) || []).slice(1).map(function (t) { return t.trim(); });
  var ends = $$("#q-ends span");
  ends[0].textContent = extremos[0] || "0";
  ends[1].textContent = extremos[1] || "10";
  $("#q-guide").textContent = "Avalie a gravidade do sintoma de 0 a 10.";

  (function montarEscala() {
    var html = "";
    for (var v = 0; v <= 10; v++) {
      html += '<label class="q-opt"><input type="radio" name="nota" value="' + v + '" aria-describedby="q-ends"><span>' + v + "</span></label>";
    }
    qScale.innerHTML = html;
    var mapa = "";
    INDICADORES.forEach(function (ind, i) {
      mapa += '<button type="button" class="q-dot" data-q="' + i + '" aria-label="Pergunta ' + (i + 1) + ": " + esc(ind.dimensao) + '">' + esc(ind.codigo) + "</button>";
    });
    qMap.innerHTML = mapa;
  })();

  function nomePilar(nome) { return nome.replace(/^\d+\.\s*/, ""); }

  function renderPergunta() {
    var i = state.index;
    var ind = INDICADORES[i];
    var pilarIdx = T.dados.pilares.map(function (p) { return p.nome; }).indexOf(ind.pilar);
    $("#q-count").textContent = "Pergunta " + (i + 1) + " de " + INDICADORES.length;
    $("#q-pillar").textContent = "Pilar " + (pilarIdx + 1) + " de " + T.dados.pilares.length + " · " + nomePilar(ind.pilar);
    $("#q-code").textContent = ind.codigo;
    $("#q-dimension").textContent = ind.dimensao;
    $("#q-title").textContent = ind.pergunta;
    var nota = state.notas[ind.codigo];
    $$("input[name=nota]", qScale).forEach(function (r) { r.checked = typeof nota === "number" && Number(r.value) === nota; });
    qError.textContent = "";
    $("#q-card").classList.remove("has-error");
    $("#q-prev").innerHTML = '<svg class="icon flip" aria-hidden="true" viewBox="0 0 24 24"><use href="#i-next"/></svg>' + (i === 0 ? "Identificação" : "Anterior");
    $("#q-next").innerHTML = (i === INDICADORES.length - 1 ? "Concluir questionário" : "Próxima") + '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><use href="#i-next"/></svg>';
    $$(".q-dot", qMap).forEach(function (d, k) {
      var code = INDICADORES[k].codigo;
      d.classList.toggle("is-answered", typeof state.notas[code] === "number");
      d.classList.toggle("is-current", k === i);
      d.disabled = k > primeiraSemResposta() && k !== i;
      if (k === i) d.setAttribute("aria-current", "step"); else d.removeAttribute("aria-current");
    });
    var card = $("#q-card");
    card.classList.remove("q-enter");
    void card.offsetWidth;
    card.classList.add("q-enter");
    atualizarProgresso();
  }

  function primeiraSemResposta() {
    for (var k = 0; k < INDICADORES.length; k++) if (typeof state.notas[INDICADORES[k].codigo] !== "number") return k;
    return INDICADORES.length;
  }

  function irPara(i) {
    state.index = Math.max(0, Math.min(INDICADORES.length - 1, i));
    renderPergunta();
    rolarParaEtapa(false);
    $("#q-title").focus({ preventScroll: true });
    salvar();
  }

  function avancar() {
    var code = INDICADORES[state.index].codigo;
    if (typeof state.notas[code] !== "number") {
      qError.textContent = "Escolha uma nota de 0 a 10 para continuar.";
      $("#q-card").classList.add("has-error");
      $("input[name=nota]", qScale).focus();
      return;
    }
    if (state.index < INDICADORES.length - 1) irPara(state.index + 1);
    else {
      var falta = primeiraSemResposta();
      if (falta < INDICADORES.length) { irPara(falta); return; }
      evento("cenario", true);
      mostrarEtapa("cenario");
    }
  }

  var autoAvanco = null;
  qScale.addEventListener("change", function (e) {
    if (e.target.name !== "nota") return;
    var cod = INDICADORES[state.index].codigo;
    if (typeof state.notas[cod] !== "number") evento("pergunta-" + ("0" + (state.index + 1)).slice(-2), true);
    state.notas[cod] = Number(e.target.value);
    qError.textContent = "";
    $("#q-card").classList.remove("has-error");
    salvar();
    atualizarProgresso();
    $$(".q-dot", qMap)[state.index].classList.add("is-answered");
    // Move on by itself once a score is picked (not on the last question, which needs a deliberate "Concluir").
    clearTimeout(autoAvanco);
    if (state.index < INDICADORES.length - 1 && e.isTrusted !== false) {
      var esta = state.index;
      autoAvanco = setTimeout(function () { if (state.index === esta && state.stage === "questionario") avancar(); }, reduceMotion ? 150 : 550);
    }
  });
  qScale.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); clearTimeout(autoAvanco); avancar(); }
  });
  $("#q-next").addEventListener("click", function () { clearTimeout(autoAvanco); avancar(); });
  $("#q-prev").addEventListener("click", function () {
    clearTimeout(autoAvanco);
    if (state.index === 0) mostrarEtapa("identificacao"); else irPara(state.index - 1);
  });
  qMap.addEventListener("click", function (e) {
    var d = e.target.closest(".q-dot");
    if (d && !d.disabled) { clearTimeout(autoAvanco); irPara(Number(d.getAttribute("data-q"))); }
  });

  /* ----- Envio: o servidor do próprio site (api/enviar.php) recalcula o laudo e envia os e-mails ----- */

  function formatSentAt(iso) {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    }) + " (horário de Brasília)";
  }

  function n1(v) { return T.formatar(v, 1); }
  function n2(v) { return T.formatar(v, 2); }
  // Client-facing result shows temperatures only, never the 0-10 scores.
  function temp(v) { return T.nivel(v).temperatura.split(" (")[0]; }
  function tempNome(v) { var t = T.nivel(v).temperatura; var m = t.match(/\(([^)]+)\)/); return m ? m[1] : t; }

  function buildPayload() {
    var c = lerCampos();
    return {
      contact: { name: c.nome, role: c.cargo, company: c.empresa, segment: c.segmento, employee_range: c.colaboradores, city: c.cidade, whatsapp: c.whatsapp, email: c.email },
      notas: Object.assign({}, state.notas),
      closing: { principal_preocupacao: c.principal_preocupacao, comentario_adicional: c.comentario_adicional || null, preferencia_contato: c.preferencia_contato, consentimento: c.consentimento },
      meta: { source: "site", metodologia: T.dados.fonte, submitted_at: state.enviadoEm || new Date().toISOString(), started_at: state.iniciadoEm || null },
      hp: val("site_empresa_url"),
      turnstile: tsToken || null
    };
  }

  // Only the answers travel; the server recomputes the result and builds both e-mails itself.
  function transmit(payload, r, signal) {
    return fetch(CONFIG.submitEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
      signal: signal
    });
  }

  // Sends the diagnosis; resolves to { ok, detail } and never rejects.
  function enviar(r) {
    if (!sendingEnabled) return Promise.resolve({ ok: false, naoConfigurado: true });
    var bloqueio = bloqueioDeEnvio();
    // Filled in too fast: wait out the remaining seconds and send by itself, without asking the visitor.
    if (bloqueio && bloqueio.bloqueado === "rapido") {
      evento("espera-antirrobo");
      return new Promise(function (ok) { setTimeout(ok, (bloqueio.espera + 1) * 1000); }).then(function () { return enviar(r); });
    }
    if (bloqueio) { evento("bloqueado-" + bloqueio.bloqueado); return Promise.resolve(bloqueio); }
    var payload = buildPayload();
    if (!state.planilhaRegistrada) { state.planilhaRegistrada = true; enviarPlanilha(payload, r); }
    var controller = "AbortController" in window ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, 20000);
    return transmit(payload, r, controller ? controller.signal : undefined).then(function (res) {
      if (res.ok) { registrarEnvio(); evento("envio-ok"); return { ok: true }; }
      evento("envio-erro");
      return res.text().catch(function () { return ""; }).then(function (text) {
        var msg = "";
        try { msg = (JSON.parse(text) || {}).erro || ""; } catch (e) { msg = ""; }
        if (window.console) console.warn("[Gênesis] envio recusado", res.status, text.slice(0, 300));
        return { ok: false, status: res.status, mensagem: msg };
      });
    }).catch(function () {
      evento("envio-erro");
      return { ok: false, detail: "" };
    }).then(function (out) { if (timer) clearTimeout(timer); return out; });
  }

  function mostrarEnvio(out) {
    statusBox.innerHTML = "";
    statusBox.className = "form-status";
    if (!out) return;
    var h = document.createElement("h2");
    var p = document.createElement("p");
    if (out.ok) {
      statusBox.classList.add("is-success");
      h.textContent = "Recebemos suas respostas!";
      p.textContent = "Um conselheiro do Projeto Gênesis vai entrar em contato" +
        (CONFIG.responseDeadline ? " em até " + CONFIG.responseDeadline : "") +
        " para agendar uma reunião aprofundada. Enquanto isso, acompanhe nossos conteúdos no Instagram " + CONFIG.instagramHandle + ".";
      statusBox.appendChild(h); statusBox.appendChild(p);
      return;
    }
    if (out.bloqueado) { mostrarBloqueio(out); return; }
    statusBox.classList.add(out.naoConfigurado ? "is-demo" : "is-error");
    h.textContent = out.naoConfigurado ? "Envio ainda não configurado" : "Seu resultado está pronto, mas não conseguimos enviá-lo ao Conselho";
    p.textContent = out.naoConfigurado
      ? "O resultado abaixo foi calculado, mas o envio ao Projeto Gênesis ainda não foi configurado neste site. Nada foi transmitido."
      : out.status === 429 && out.mensagem
        ? out.mensagem
        : out.status === 503
          ? "O envio está temporariamente indisponível. Suas respostas continuam salvas neste navegador: tente de novo mais tarde ou fale com o Conselho pelo WhatsApp."
          : "Suas respostas continuam salvas neste navegador. Verifique a conexão e tente de novo, ou fale com o Conselho pelo WhatsApp.";
    statusBox.appendChild(h); statusBox.appendChild(p);
    if (!out.naoConfigurado) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-gold btn-sm";
      b.textContent = "Tentar enviar novamente";
      b.addEventListener("click", function () {
        b.disabled = true;
        b.textContent = "Enviando…";
        enviar(state.resultado).then(function (res) {
          state.envio = res.ok ? "ok" : "falhou";
          salvar();
          mostrarEnvio(res);
          statusBox.focus();
        });
      });
      statusBox.appendChild(b);
    }
  }

  function mostrarBloqueio(out) {
    var h = document.createElement("h2");
    var p = document.createElement("p");
    statusBox.classList.add(out.bloqueado === "limite" ? "is-demo" : "is-error");
    if (out.bloqueado === "limite") {
      h.textContent = "Limite de envios deste navegador atingido";
      p.textContent = "Este navegador já enviou " + PROTECAO.enviosPor24h + " diagnósticos nas últimas 24 horas. O resultado abaixo foi calculado, mas não foi enviado. Para falar com o Conselho agora, use o WhatsApp.";
    } else {
      h.textContent = "Não foi possível enviar o diagnóstico";
      p.textContent = "Fale com o Conselho pelo WhatsApp.";
    }
    statusBox.appendChild(h); statusBox.appendChild(p);
  }

  /* ----- Proteção contra robôs: campo-armadilha, tempo mínimo e limite por navegador ----- */

  var PROTECAO = Object.assign({ tempoMinimoSegundos: 40, enviosPor24h: 3 }, CONFIG.protecao || {});
  var LIMITE_KEY = "genesis-envios";

  function enviosRecentes() {
    try {
      var desde = Date.now() - 24 * 3600 * 1000;
      return JSON.parse(localStorage.getItem(LIMITE_KEY) || "[]").filter(function (t) { return t > desde; });
    } catch (e) { return []; }
  }

  function registrarEnvio() {
    var lista = enviosRecentes();
    lista.push(Date.now());
    try { localStorage.setItem(LIMITE_KEY, JSON.stringify(lista)); } catch (e) { /* storage unavailable */ }
  }

  // null = can send; otherwise the reason it was held back.
  function bloqueioDeEnvio() {
    if (val("site_empresa_url")) return { ok: false, bloqueado: "robo" };
    var inicio = state.iniciadoEm ? Date.parse(state.iniciadoEm) : 0;
    var decorrido = (Date.now() - inicio) / 1000;
    if (inicio && decorrido < PROTECAO.tempoMinimoSegundos) {
      return { ok: false, bloqueado: "rapido", espera: Math.ceil(PROTECAO.tempoMinimoSegundos - decorrido) };
    }
    if (enviosRecentes().length >= PROTECAO.enviosPor24h) return { ok: false, bloqueado: "limite" };
    return null;
  }

  /* ----- Estatísticas sem cookies (GoatCounter): só nomes de etapas, nunca dados pessoais ----- */

  var GOATCOUNTER = ((CONFIG.estatisticas || {}).goatcounter || "").trim();
  if (/^[a-z0-9-]+$/.test(GOATCOUNTER)) {
    var gc = document.createElement("script");
    gc.async = true;
    gc.src = "https://gc.zgo.at/count.js";
    gc.setAttribute("data-goatcounter", "https://" + GOATCOUNTER + ".goatcounter.com/count");
    document.head.appendChild(gc);
  }
  var eventosContados = {};
  function evento(nome, umaVez) {
    if (umaVez && eventosContados[nome]) return;
    eventosContados[nome] = true;
    if (window.goatcounter && typeof window.goatcounter.count === "function") {
      window.goatcounter.count({ path: "diagnostico/" + nome, title: "Diagnóstico: " + nome, event: true });
    }
  }

  /* ----- Registro na planilha do Google (opcional) ----- */

  function enviarPlanilha(payload, r) {
    var url = (CONFIG.planilhaEndpoint || "").trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) return;
    var c = payload.contact, cl = payload.closing;
    var linha = {
      data: formatSentAt(payload.meta.submitted_at), empresa: c.company, responsavel: c.name, cargo: c.role,
      segmento: c.segment, colaboradores: c.employee_range, cidade: c.city, whatsapp: c.whatsapp, email: c.email,
      igvo: n2(r.igvo.ponderada), igvo_media_simples: n1(r.igvo.mediaSimples), temperatura: r.igvo.temperatura, status: r.igvo.status,
      media_geral_ponderada: n2(r.questionario.mediaPonderada), media_geral_simples: n1(r.questionario.mediaSimples)
    };
    r.pilares.forEach(function (p, k) {
      linha["pilar" + (k + 1) + "_" + nomePilar(p.nome)] = n2(p.ponderada) + " · " + p.status;
    });
    r.itens.forEach(function (i) { linha[i.codigo + " " + i.dimensao] = i.nota; });
    linha.principal_preocupacao = cl.principal_preocupacao;
    linha.comentario = cl.comentario_adicional || "";
    linha.preferencia_contato = cl.preferencia_contato;
    linha.consentimento = cl.consentimento ? "Sim" : "Não";
    // Apps Script answers through a redirect without CORS headers: send it as a "simple" request and don't wait for the reply.
    try {
      fetch(url, { method: "POST", mode: "no-cors", keepalive: true, headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(linha) })
        .catch(function () {});
    } catch (e) { /* the e-mail is the record of reference */ }
  }

  /* ----- Verificação antirrobô (Cloudflare Turnstile). Só liga com turnstileSiteKey no config.js ----- */
  var TS_KEY = (CONFIG.turnstileSiteKey || "").trim();
  var tsBox = $("#turnstile-box"), tsWidget = null, tsToken = "", tsCarregando = false;
  function carregarTurnstile() {
    if (!TS_KEY || !tsBox || tsWidget !== null || tsCarregando) return;
    tsCarregando = true;
    tsBox.hidden = false;
    window.onGenesisTurnstile = function () {
      tsWidget = window.turnstile.render("#turnstile-widget", {
        sitekey: TS_KEY, language: "pt-br", theme: "light", action: "diagnostico",
        callback: function (t) { tsToken = t; $("#turnstile-err").textContent = ""; tsBox.classList.remove("has-error"); },
        "expired-callback": function () { tsToken = ""; },
        "error-callback": function () { tsToken = ""; }
      });
    };
    var sc = document.createElement("script");
    sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onGenesisTurnstile";
    sc.async = true; sc.defer = true;
    document.head.appendChild(sc);
  }
  function resetTurnstile() { tsToken = ""; if (tsWidget !== null && window.turnstile) window.turnstile.reset(tsWidget); }

  /* ----- Conclusão: processamento e laudo ----- */

  var enviando = false;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (enviando || state.stage !== "cenario") return;
    var falta = primeiraSemResposta();
    if (falta < INDICADORES.length) { state.index = falta; mostrarEtapa("questionario"); return; }
    if (!validateStage("cenario")) return;
    if (TS_KEY && sendingEnabled && !tsToken) {
      $("#turnstile-err").textContent = "Confirme que você não é um robô para enviar.";
      tsBox.classList.add("has-error");
      tsBox.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      return;
    }

    enviando = true;
    submitBtn.disabled = true;
    state.enviadoEm = new Date().toISOString();
    var r = T.calcular(state.notas);
    mostrarEtapa("processando");
    var passos = $$("#proc-steps li");
    passos.forEach(function (li) { li.className = ""; });
    var passo = 0;
    var tick = setInterval(function () {
      if (passo > 0) passos[passo - 1].className = "is-done";
      if (passo < passos.length) passos[passo].className = "is-active";
      passo++;
      if (passo > passos.length - 1) clearInterval(tick);
    }, reduceMotion ? 60 : 650);
    var minimo = new Promise(function (ok) { setTimeout(ok, reduceMotion ? 300 : 2800); });

    Promise.all([enviar(r), minimo]).then(function (res) {
      clearInterval(tick);
      var out = res[0];
      state.envio = out.ok ? "ok" : (out.naoConfigurado ? "nao-configurado" : "falhou");
      resetTurnstile();
      evento("concluido", true);
      state.resultado = r;
      renderLaudo(r);
      mostrarEnvio(out);
      enviando = false;
      submitBtn.disabled = false;
      mostrarEtapa("resultado", false);
      $("#laudo-title").focus({ preventScroll: true });
    });
  });

  function regua(valor, cor) {
    var pos = Math.max(0, Math.min(10, valor)) * 10;
    return '<div class="regua" role="img" aria-label="' + esc("Temperatura " + temp(valor) + ", " + tempNome(valor)) + '">' +
      '<span class="regua-faixas"><i class="f-verde"></i><i class="f-branco"></i><i class="f-amarelo"></i><i class="f-vermelho"></i></span>' +
      '<span class="regua-marca t-' + cor + '" style="left:' + pos + '%"></span>' +
      '<span class="regua-escala"><b style="left:15%">36.2°C</b><b style="left:42.5%">37.2°C</b><b style="left:67.5%">38.5°C</b><b style="left:90%">39.5°C+</b></span></div>';
  }

  function termometroSvg(valor, cor) {
    var h = Math.max(4, Math.min(100, valor * 10));
    return '<svg class="thermo t-' + cor + '" viewBox="0 0 60 220" aria-hidden="true">' +
      '<rect x="20" y="10" width="20" height="160" rx="10" class="thermo-tube"/>' +
      '<rect x="25" y="' + (165 - 1.5 * h) + '" width="10" height="' + (1.5 * h + 10) + '" rx="5" class="thermo-fill"/>' +
      '<circle cx="30" cy="190" r="22" class="thermo-bulb"/>' +
      [3, 5.5, 8].map(function (t) { var y = 165 - 15 * t; return '<line x1="44" x2="52" y1="' + y + '" y2="' + y + '" class="thermo-tick"/>'; }).join("") +
      "</svg>";
  }

  // "O retrato da empresa hoje": one bar per pillar plus the IGVO, over the four temperature bands.
  function graficoPilares(r) {
    var linhas = r.pilares.map(function (p) { return { nome: nomePilar(p.nome), v: p.ponderada, cor: p.cor, status: p.status }; });
    linhas.push({ nome: "IGVO (média ponderada global)", v: r.igvo.ponderada, cor: r.igvo.cor, status: r.igvo.status, total: true });
    var descricao = linhas.map(function (l) { return l.nome + ": " + temp(l.v) + ", " + l.status; }).join("; ");
    return '<figure class="grafico" aria-label="' + esc("Temperatura de cada pilar. " + descricao) + '">' +
      '<figcaption>O retrato da empresa hoje <small>temperatura de cada pilar</small></figcaption>' +
      linhas.map(function (l, k) {
        return '<div class="g-linha' + (l.total ? " g-total" : "") + '" aria-hidden="true"><span class="g-nome">' + esc(l.nome) + "</span>" +
          '<span class="g-trilho"><span class="g-barra t-' + l.cor + '" style="width:' + Math.max(1.5, l.v * 10) + "%;animation-delay:" + (k * 120) + 'ms"></span></span>' +
          '<span class="g-val t-' + l.cor + '">' + temp(l.v) + "</span></div>";
      }).join("") +
      '<div class="g-eixo" aria-hidden="true"><span></span><span class="g-escala"><b style="left:15%">36.2°C</b><b style="left:42.5%">37.2°C</b><b style="left:67.5%">38.5°C</b><b style="left:90%">39.5°C+</b></span><span></span></div>' +
      "</figure>";
  }

  function lista(itens) { return "<ul>" + itens.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>"; }

  function renderLaudo(r) {
    var c = lerCampos();
    var data = state.enviadoEm ? formatSentAt(state.enviadoEm) : "";
    var g = r.igvo;
    var html = '<div class="print-cab" aria-hidden="true"><div class="print-marca"><img src="assets/img/logo-simbolo.png" alt="" width="40" height="38">' +
      '<span><small>Projeto</small><strong>GENESIS</strong></span></div>' +
      '<div class="print-info">Laudo do diagnóstico inicial<br>' + esc(data || formatSentAt(new Date().toISOString())) + "</div></div>" +
      '<header class="laudo-head">' +
      '<p class="eyebrow">Laudo do diagnóstico inicial</p>' +
      '<h2 id="laudo-title" tabindex="-1">Termômetro Organizacional · ' + esc(c.empresa) + "</h2>" +
      '<p class="laudo-meta">' + esc(c.nome) + " · " + esc(c.cargo) + (data ? " · " + esc(data) : "") + "</p>" +
      '<p class="laudo-aviso">Resultado calculado automaticamente a partir das suas respostas, com a metodologia oficial do Conselho Gênesis. É um diagnóstico inicial: a análise completa acontece no diagnóstico integrado, já dentro do ciclo.</p>' +
      "</header>";

    html += '<section class="laudo-igvo t-' + g.cor + '" aria-labelledby="igvo-title">' + termometroSvg(g.ponderada, g.cor) +
      '<div class="igvo-body"><p class="igvo-label" id="igvo-title">' + esc(g.nome) + '</p>' +
      '<p class="igvo-valor"><span>' + esc(temp(g.ponderada)) + '</span><small>' + esc(tempNome(g.ponderada)) + '</small></p>' +
      '<p class="pill t-' + g.cor + '">' + esc(g.status) + "</p>" +
      regua(g.ponderada, g.cor) +
      "</div></section>";

    html += '<section class="laudo-bloco" aria-labelledby="ref-title"><h3 id="ref-title">Tabela de referência: as 4 temperaturas</h3><div class="ref">' +
      r.referencia.map(function (f, k) {
        var cor = T.CORES[3 - k];
        return '<div class="ref-item t-' + cor + (cor === g.cor ? " is-atual" : "") + '"><p class="ref-faixa">' + esc(f.temperatura) + "</p><p><strong>" + esc(f.classificacao) + "</strong></p><p class=\"ref-conduta\">" + esc(f.conduta) + "</p>" + (cor === g.cor ? '<p class="ref-voce">Sua empresa hoje</p>' : "") + "</div>";
      }).join("") + "</div></section>";

    html += '<div class="print-proximo"><strong>Próximo passo:</strong> um conselheiro do Projeto Gênesis vai entrar em contato para agendar uma reunião aprofundada e explicar o que essa temperatura significa para a sua empresa.</div>' +
      '<div class="print-rodape" aria-hidden="true"><span>WhatsApp (34) 99859-3233 · ' + esc(CONFIG.email || "") + " · genesisintegrativa.com.br</span>" +
      "<span>O Projeto Gênesis oferece suporte em saúde integrativa e não presta serviços médicos.</span></div>";

    var wa = channelHref("whatsapp");
    html += '<div class="laudo-acoes">' +
      (wa ? '<a class="btn btn-gold btn-lg" target="_blank" rel="noopener" href="' + esc(waResultado(r, c)) + '"><svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><use href="#i-whatsapp"/></svg>Conversar no WhatsApp</a>' : "") +
      '<button type="button" class="btn btn-ghost btn-lg" id="laudo-print"><svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><use href="#i-print"/></svg>Imprimir ou salvar em PDF</button>' +
      '<button type="button" class="btn btn-ghost btn-lg" id="laudo-novo">Fazer um novo diagnóstico</button></div>';

    $("#laudo").innerHTML = html;
    $("#laudo-print").addEventListener("click", function () { window.print(); });
    $("#laudo-novo").addEventListener("click", recomecar);
  }

  function waResultado(r, c) {
    var base = channelHref("whatsapp").split("?")[0];
    var msg = "Olá! Fiz o diagnóstico inicial no site do Projeto Gênesis." +
      "\nEmpresa: " + c.empresa +
      "\nTermômetro: " + r.igvo.temperatura + " — " + r.igvo.status +
      "\nQuero conversar sobre o plano de tratamento.";
    return base + "?text=" + encodeURIComponent(msg);
  }

  /* ----- Retomar ou recomeçar ----- */

  var resumeBox = $("#resume-box");

  function recomecar() {
    apagar();
    form.reset();
    state = { stage: "identificacao", index: 0, notas: {}, resultado: null, envio: null, enviadoEm: null, iniciadoEm: null };
    touched = {};
    FIELDS.forEach(function (f) { setError(f, ""); });
    $("#laudo").innerHTML = "";
    mostrarEnvio(null);
    resumeBox.hidden = true;
    atualizarBotaoInicio();
    mostrarEtapa("identificacao");
  }

  function retomar(salvo) {
    state.notas = salvo.notas || {};
    state.index = Math.min(salvo.index || 0, INDICADORES.length - 1);
    state.envio = salvo.envio || null;
    state.enviadoEm = salvo.enviadoEm || null;
    state.iniciadoEm = salvo.iniciadoEm || null;
    evento("retomou", true);
    aplicarCampos(salvo.campos);
    if (salvo.stage === "resultado" && respondidas() === INDICADORES.length) {
      state.resultado = T.calcular(state.notas);
      renderLaudo(state.resultado);
      mostrarEnvio(state.envio === "ok" ? { ok: true } : state.envio === "falhou" ? { ok: false, detail: "" } : state.envio === "nao-configurado" ? { ok: false, naoConfigurado: true } : null);
    }
    resumeBox.hidden = true;
    mostrarEtapa(salvo.stage && stageSections[salvo.stage] && salvo.stage !== "processando" ? salvo.stage : "identificacao");
  }

  var salvo = carregar();
  function atualizarBotaoInicio() {
    var label = $("#form-start span");
    var temProgresso = salvo && (respostasSalvas(salvo) > 0 || salvo.stage !== "identificacao");
    label.textContent = temProgresso && resumeBox && !resumeBox.hidden ? "Continuar de onde parei" : "Começar";
  }
  function respostasSalvas(s) { return Object.keys(s.notas || {}).length; }

  if (salvo && salvo.versao === 1) {
    aplicarCampos(salvo.campos);
    var n = respostasSalvas(salvo);
    if (salvo.stage === "resultado") {
      $("#resume-detail").textContent = "Você concluiu um diagnóstico neste navegador" + (salvo.enviadoEm ? " em " + formatSentAt(salvo.enviadoEm).split(",")[0] : "") + ".";
      $("#resume-continue").textContent = "Ver meu resultado";
      resumeBox.hidden = false;
    } else if (n > 0 || salvo.stage !== "identificacao") {
      $("#resume-detail").textContent = n + " de " + INDICADORES.length + " perguntas respondidas.";
      resumeBox.hidden = false;
    }
  }
  $("#resume-continue").addEventListener("click", function () { retomar(salvo); salvo = null; atualizarBotaoInicio(); });
  $("#resume-restart").addEventListener("click", function () { salvo = null; recomecar(); });
  $("#form-start").addEventListener("click", function (e) {
    if (salvo && !resumeBox.hidden) { e.preventDefault(); retomar(salvo); salvo = null; atualizarBotaoInicio(); }
  });
  atualizarBotaoInicio();
  atualizarProgresso();

  handleRoute(true);
})();
