(function () {
  "use strict";

  var CONFIG = window.GENESIS_CONFIG || {};
  var FORM_ROUTE = "#formulario";

  var RATINGS = [
    { id: "financeiro_gestao_operacoes", dimension: "Financeiro, gestão e operações", question: "Não confio nos números da empresa e não sei com clareza onde ganho ou perco dinheiro." },
    { id: "estrategia_continuidade", dimension: "Estratégia e continuidade", question: "A empresa depende dos sócios para tudo e não há planejamento para os próximos anos." },
    { id: "pessoas_lideranca_cultura", dimension: "Pessoas, liderança e cultura", question: "A equipe não entrega o resultado esperado e há conflitos entre áreas." },
    { id: "saude_integrativa_alta_performance", dimension: "Saúde integrativa e alta performance", question: "O clima na empresa é pesado, com estresse, exaustão na gestão, afastamentos ou rotatividade alta." },
    { id: "reeducacao_corporativa_comportamental", dimension: "Reeducação corporativa e comportamental", question: "Líderes e equipes repetem os mesmos erros e resistem a mudanças." }
  ];

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    if (!el) { window.scrollTo(0, 0); return; }
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  function handleRoute(initial) {
    var hash = window.location.hash;
    if (hash === "#politica") { if (!currentView) showView("landing"); openPrivacy(); return; }
    var view = routeFor(hash);
    var changed = showView(view);
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

  // Clicar de novo no mesmo link (hash inalterado) ainda deve rolar até a seção.
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest('a[href^="#"]');
    if (!link || link.hasAttribute("data-open-privacy")) return;
    if (link.getAttribute("href") === window.location.hash) {
      e.preventDefault();
      handleRoute(false);
    }
  });

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

  /* ---------------- Acordeão (FAQ) ---------------- */

  $$("[data-accordion] button[aria-controls]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      document.getElementById(btn.getAttribute("aria-controls")).hidden = open;
    });
  });

  /* ---------------- Política de Privacidade ---------------- */

  var dialog = $("#privacy-dialog");
  var lastFocus = null;

  var EMAILJS = CONFIG.emailjs || {};
  var emailjsReady = !!(EMAILJS.serviceId && EMAILJS.templateId && EMAILJS.publicKey);
  var sendingEnabled = emailjsReady || !!CONFIG.submitEndpoint;

  $("#privacy-transmission").textContent = emailjsReady
    ? "Ao enviar, as respostas são encaminhadas por e-mail à equipe do Projeto Gênesis por meio do serviço EmailJS, em conexão segura."
    : CONFIG.submitEndpoint
      ? "Ao enviar, as respostas são transmitidas por conexão segura à equipe do Projeto Gênesis."
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

  /* ---------------- Escalas de 0 a 10 ---------------- */

  var ratingsRoot = $("#ratings");
  RATINGS.forEach(function (r, index) {
    var fs = document.createElement("fieldset");
    fs.className = "rating";
    fs.id = r.id + "-group";
    fs.setAttribute("aria-describedby", r.id + "-scale " + r.id + "-err");
    var options = "";
    for (var v = 0; v <= 10; v++) {
      options += '<label class="rating-opt"><input type="radio" name="' + r.id + '" value="' + v + '"' + (v === 0 ? " required" : "") +
        '><span>' + v + "</span></label>";
    }
    fs.innerHTML =
      '<legend><span class="rating-dim">' + (index + 1) + ". " + r.dimension + '</span><span class="rating-q">' + r.question +
      ' <span class="req" aria-hidden="true">*</span></span></legend>' +
      '<div class="rating-scale">' + options + "</div>" +
      '<p class="rating-ends" id="' + r.id + '-scale"><span>0 = não é um problema</span><span>10 = é uma dor grave</span></p>' +
      '<p class="rating-value" aria-hidden="true" data-value-for="' + r.id + '">Sem resposta</p>' +
      '<p class="field-error" id="' + r.id + '-err"></p>';
    ratingsRoot.appendChild(fs);
  });

  /* ---------------- Validação ---------------- */

  var form = $("#diagnostic-form");
  var statusBox = $("#form-status");
  var submitBtn = $("#submit-btn");
  var summary = $("#error-summary");

  function val(name) {
    var el = form.elements[name];
    if (!el) return "";
    if (el.type === "checkbox") return el.checked;
    return (el.value || "").trim();
  }

  function phoneDigits(v) {
    var d = v.replace(/\D/g, "");
    if (d.length >= 12 && d.indexOf("55") === 0) d = d.slice(2);
    if (d.length === 11 && d[0] === "0") d = d.slice(1);
    return d;
  }

  var FIELDS = [
    { name: "nome", block: 1, label: "Seu nome", check: function (v) { return v ? "" : "Informe o seu nome."; } },
    { name: "cargo", block: 1, label: "Cargo ou função", check: function (v) { return v ? "" : "Selecione o seu cargo ou função."; } },
    { name: "empresa", block: 1, label: "Nome da empresa", check: function (v) { return v ? "" : "Informe o nome da empresa."; } },
    { name: "segmento", block: 1, label: "Segmento", check: function (v) { return v ? "" : "Selecione o segmento da empresa."; } },
    { name: "colaboradores", block: 1, label: "Número de colaboradores", check: function (v) { return v ? "" : "Selecione o número de colaboradores."; } },
    { name: "cidade", block: 1, label: "Cidade", check: function (v) { return v ? "" : "Informe a cidade."; } },
    { name: "whatsapp", block: 1, label: "WhatsApp", check: function (v) {
      if (!v) return "Informe o seu WhatsApp.";
      if (/[^\d\s()+.\-]/.test(v)) return "Use apenas números e, se quiser, parênteses, espaços ou hífen.";
      var d = phoneDigits(v);
      return d.length === 10 || d.length === 11 ? "" : "Informe um número com DDD, por exemplo (34) 99999-9999.";
    } },
    { name: "email", block: 1, label: "E-mail", check: function (v) {
      if (!v) return "Informe o seu e-mail.";
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Informe um e-mail válido, por exemplo nome@empresa.com.br.";
    } }
  ];
  RATINGS.forEach(function (r, i) {
    FIELDS.push({ name: r.id, block: 2, group: true, label: "Pergunta " + (i + 1) + " — " + r.dimension,
      check: function (v) { return v !== "" ? "" : "Escolha uma nota de 0 a 10."; } });
  });
  FIELDS.push(
    { name: "principal_preocupacao", block: 3, group: true, label: "O que mais tira o seu sono hoje?", check: function (v) { return v ? "" : "Escolha uma opção."; } },
    { name: "preferencia_contato", block: 3, group: true, label: "Como prefere ser contatado?", check: function (v) { return v ? "" : "Escolha como prefere ser contatado."; } },
    { name: "consentimento", block: 3, label: "Consentimento", check: function (v) { return v ? "" : "Para enviar, é preciso autorizar o uso dos dados."; } }
  );

  function radioValue(name) {
    var checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : "";
  }

  function fieldValue(f) { return f.group ? radioValue(f.name) : val(f.name); }

  function setError(f, msg) {
    var err = document.getElementById(f.name + "-err");
    err.textContent = msg;
    var host = f.group ? document.getElementById(f.name + "-group") : form.elements[f.name];
    host.classList.toggle("has-error", !!msg);
    if (f.group) {
      $$('input[name="' + f.name + '"]', form).forEach(function (i) {
        if (msg) i.setAttribute("aria-invalid", "true"); else i.removeAttribute("aria-invalid");
      });
    } else if (msg) host.setAttribute("aria-invalid", "true");
    else host.removeAttribute("aria-invalid");
  }

  var touched = {};
  function validateField(f) {
    var msg = f.check(fieldValue(f));
    setError(f, msg);
    return msg;
  }

  function firstFocusable(f) {
    if (!f.group) return form.elements[f.name];
    return form.querySelector('input[name="' + f.name + '"]');
  }

  function updateProgress() {
    [1, 2, 3].forEach(function (b) {
      var done = FIELDS.filter(function (f) { return f.block === b; }).every(function (f) { return !f.check(fieldValue(f)); });
      var li = $('[data-progress="' + b + '"]');
      li.classList.toggle("is-done", done);
      var sr = li.querySelector(".sr-only") || li.querySelector("a").appendChild(Object.assign(document.createElement("span"), { className: "sr-only" }));
      sr.textContent = done ? " (concluído)" : " (pendente)";
    });
  }

  function onFieldEvent(e) {
    var name = e.target.name;
    if (!name) return;
    var f = FIELDS.filter(function (x) { return x.name === name; })[0];
    if (f && f.group) {
      var out = form.querySelector('[data-value-for="' + name + '"]');
      if (out) out.textContent = "Nota escolhida: " + radioValue(name);
    }
    if (f && (touched[name] || f.group || e.target.type === "checkbox" || e.target.tagName === "SELECT")) {
      touched[name] = true;
      validateField(f);
    }
    updateProgress();
  }
  form.addEventListener("change", onFieldEvent);
  form.addEventListener("input", onFieldEvent);
  form.addEventListener("focusout", function (e) {
    var f = FIELDS.filter(function (x) { return x.name === e.target.name && !x.group; })[0];
    if (f && (e.target.value || touched[f.name])) { touched[f.name] = true; validateField(f); updateProgress(); }
  });

  /* ---------------- Envio ---------------- */

  function buildPayload() {
    return {
      contact: {
        name: val("nome"), role: val("cargo"), company: val("empresa"), segment: val("segmento"),
        employee_range: val("colaboradores"), city: val("cidade"), whatsapp: val("whatsapp"), email: val("email")
      },
      ratings: RATINGS.reduce(function (acc, r) { acc[r.id] = parseInt(radioValue(r.id), 10); return acc; }, {}),
      closing: {
        principal_preocupacao: radioValue("principal_preocupacao"),
        comentario_adicional: val("comentario_adicional") || null,
        preferencia_contato: radioValue("preferencia_contato"),
        consentimento: val("consentimento") === true
      },
      meta: { source: "site", submitted_at: new Date().toISOString() }
    };
  }

  function showStatus(kind, title, body, extra) {
    statusBox.className = "form-status is-" + kind;
    statusBox.innerHTML = "";
    var h = document.createElement("h2");
    h.textContent = title;
    statusBox.appendChild(h);
    body.forEach(function (t) {
      var p = document.createElement("p");
      p.textContent = t;
      statusBox.appendChild(p);
    });
    if (extra) statusBox.appendChild(extra);
    statusBox.focus();
  }

  var EMAILJS_URL = "https://api.emailjs.com/api/v1.0/email/send";

  function formatSentAt(iso) {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    }) + " (horário de Brasília)";
  }

  // O modelo do EmailJS usa exatamente estas variáveis: {{empresa}}, {{responsavel}}, {{respostas}} e {{data}}.
  function emailTemplateParams(payload) {
    var c = payload.contact, cl = payload.closing;
    var lines = [
      "SOBRE VOCÊ E A EMPRESA",
      "• Seu nome: " + c.name,
      "• Cargo ou função: " + c.role,
      "• Nome da empresa: " + c.company,
      "• Segmento: " + c.segment,
      "• Número de colaboradores: " + c.employee_range,
      "• Cidade: " + c.city,
      "• WhatsApp: " + c.whatsapp,
      "• E-mail: " + c.email,
      "",
      "AS DORES DA EMPRESA (0 = não é um problema; 10 = é uma dor grave)"
    ];
    RATINGS.forEach(function (r, i) {
      lines.push((i + 1) + ". " + r.dimension + ": " + payload.ratings[r.id] + "/10");
      lines.push("   " + r.question);
    });
    lines.push(
      "",
      "PARA FECHAR",
      "• O que mais tira o seu sono hoje? " + cl.principal_preocupacao,
      "• Quer contar algo mais? " + (cl.comentario_adicional || "Não informado."),
      "• Como prefere ser contatado? " + cl.preferencia_contato,
      "• Consentimento: " + (cl.consentimento ? "Sim. Autorizou o uso dos dados e declarou ter lido a Política de Privacidade." : "Não")
    );
    return {
      empresa: c.company,
      responsavel: c.name,
      respostas: lines.join("\n"),
      data: formatSentAt(payload.meta.submitted_at)
    };
  }

  function transmit(payload, signal) {
    if (emailjsReady) {
      return fetch(EMAILJS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: EMAILJS.serviceId,
          template_id: EMAILJS.templateId,
          user_id: EMAILJS.publicKey,
          template_params: emailTemplateParams(payload)
        }),
        signal: signal
      });
    }
    return fetch(CONFIG.submitEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
      signal: signal
    });
  }

  var sending = false;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending) return;

    var errors = [];
    FIELDS.forEach(function (f) {
      touched[f.name] = true;
      var msg = validateField(f);
      if (msg) errors.push({ f: f, msg: msg });
    });
    updateProgress();

    var list = $("ul", summary);
    list.innerHTML = "";
    if (errors.length) {
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
      $("h2", summary).textContent = errors.length === 1 ? "Revise 1 campo antes de enviar" : "Revise " + errors.length + " campos antes de enviar";
      summary.hidden = false;
      statusBox.className = "form-status";
      statusBox.textContent = "";
      summary.focus();
      return;
    }
    summary.hidden = true;

    var payload = buildPayload();

    if (!sendingEnabled) {
      showStatus("demo", "Envio ainda não configurado", [
        "Todas as respostas foram preenchidas corretamente, mas o envio do formulário ainda não foi configurado neste site. Por isso, nada foi transmitido ao Projeto Gênesis.",
        "Suas respostas continuam preenchidas nesta página. Para falar com o Projeto Gênesis agora, use os canais da seção Contato."
      ]);
      return;
    }

    sending = true;
    submitBtn.disabled = true;
    submitBtn.setAttribute("aria-busy", "true");
    submitBtn.textContent = "Enviando…";
    statusBox.className = "form-status is-loading";
    statusBox.textContent = "Enviando suas respostas…";

    var controller = "AbortController" in window ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, 20000);

    transmit(payload, controller ? controller.signal : undefined).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      form.reset();
      touched = {};
      $$("[data-value-for]").forEach(function (o) { o.textContent = "Sem resposta"; });
      updateProgress();
      var p = document.createElement("p");
      p.textContent = "Um conselheiro do Projeto Gênesis vai entrar em contato" +
        (CONFIG.responseDeadline ? " em até " + CONFIG.responseDeadline : "") +
        " para agendar uma reunião aprofundada. Enquanto isso, acompanhe nossos conteúdos no Instagram " + CONFIG.instagramHandle + ".";
      showStatus("success", "Recebemos suas respostas!", [], p);
    }).catch(function () {
      showStatus("error", "Não foi possível enviar agora", [
        "Suas respostas não foram recebidas, mas continuam preenchidas no formulário. Verifique a sua conexão e tente novamente."
      ]);
    }).then(function () {
      if (timer) clearTimeout(timer);
      sending = false;
      submitBtn.disabled = false;
      submitBtn.removeAttribute("aria-busy");
      submitBtn.textContent = "Enviar meu diagnóstico inicial";
    });
  });

  updateProgress();
  handleRoute(true);
})();
