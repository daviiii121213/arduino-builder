// Realce de sintaxe GML em tons de cinza (executado no navegador antes da renderização).
(function () {
  const KW = new Set(("if else switch case default break for while repeat do until continue return function var " +
    "exit with new constructor static enum delete try catch finally throw and or not xor div mod").split(" "));
  const LIT = new Set("true false undefined noone self other all global pi infinity NaN".split(" "));
  const PREFIX = /^(vk_|c_|mb_|pt_|ps_|buffer_|ds_type_|fa_|bm_|path_action_|time_source_|gamespeed_|audiogroup_|layerelementtype_)/;
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(\$?"(?:[^"\\\n]|\\.)*")|(#macro|#region|#endregion)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([^\w\s"#\/]+|\/|#|\s+)/g;
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function hl(src) {
    let out = "", m;
    re.lastIndex = 0;
    while ((m = re.exec(src))) {
      const [t, com, str, pre, num, id] = m;
      if (com) out += `<span class="tk-c">${esc(t)}</span>`;
      else if (str) out += `<span class="tk-s">${esc(t)}</span>`;
      else if (pre) out += `<span class="tk-p">${t}</span>`;
      else if (num) out += `<span class="tk-n">${t}</span>`;
      else if (id) {
        const next = src.slice(re.lastIndex).match(/^\s*\(/);
        if (KW.has(t)) out += `<span class="tk-k">${t}</span>`;
        else if (next) out += `<span class="tk-f">${t}</span>`;
        else if (LIT.has(t) || PREFIX.test(t)) out += `<span class="tk-b">${t}</span>`;
        else out += t;
      } else out += esc(t);
    }
    return out;
  }
  document.querySelectorAll("pre.gml, td.x, code.g").forEach(el => {
    // remove indentação comum de blocos <pre>
    let txt = el.textContent.replace(/^\n/, "").replace(/\s+$/, "");
    if (el.tagName === "PRE") {
      const lines = txt.split("\n");
      const ind = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
      const pad = " ".repeat(+(el.dataset.pad || 0));
      txt = lines.map(l => pad + l.slice(ind)).join("\n");
    }
    el.innerHTML = hl(txt);
  });
})();
