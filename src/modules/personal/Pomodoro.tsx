// Temporizador Pomodoro configurável. O estado sobrevive à navegação (localStorage).
import { useCallback, useEffect, useRef, useState } from "react";
import { call } from "../../api/client";
import { showSystemNotification } from "../../api/native";
import { useApp } from "../../contexts/app";
import { Icon } from "../../components/Icon";
import { toISODateTime } from "../../utils/format";
import type { ModuleViewProps } from "../types";
import { loadLS, saveLS } from "./common";

type Mode = "foco" | "pausa_curta" | "pausa_longa";
const LABEL: Record<Mode, string> = { foco: "Foco", pausa_curta: "Pausa curta", pausa_longa: "Pausa longa" };
const CFG_KEY = "plu.pomodoro.config";
const ST_KEY = "plu.pomodoro.state";

interface Cfg { foco: number; pausa_curta: number; pausa_longa: number; ciclos: number; tarefa: string }
interface St { mode: Mode; running: boolean; endsAt: number | null; remaining: number; startedAt: string | null; cycle: number; completedToday: number; day: string }

const DEF_CFG: Cfg = { foco: 25, pausa_curta: 5, pausa_longa: 15, ciclos: 4, tarefa: "" };
const dayKey = () => new Date().toDateString();

export function PomodoroHeader(_: ModuleViewProps) {
  const { toast } = useApp();
  const [cfg, setCfg] = useState<Cfg>(() => loadLS(CFG_KEY, DEF_CFG));
  const [st, setSt] = useState<St>(() => {
    const s = loadLS<St>(ST_KEY, { mode: "foco", running: false, endsAt: null, remaining: cfg.foco * 60000, startedAt: null, cycle: 0, completedToday: 0, day: dayKey() });
    return s.day === dayKey() ? s : { ...s, completedToday: 0, day: dayKey() };
  });
  const [now, setNow] = useState(Date.now());
  const finishing = useRef(false);

  useEffect(() => saveLS(CFG_KEY, cfg), [cfg]);
  useEffect(() => saveLS(ST_KEY, st), [st]);

  const duration = (m: Mode, c = cfg) => Math.max(0.05, Number(c[m]) || 1) * 60000;
  const left = st.running && st.endsAt ? Math.max(0, st.endsAt - now) : st.remaining;

  const complete = useCallback(async (s: St) => {
    if (finishing.current) return;
    finishing.current = true;
    const minutes = Math.round((duration(s.mode) / 60000) * 100) / 100;
    const title = s.mode === "foco" ? (cfg.tarefa.trim() || "Sessão de foco") : LABEL[s.mode];
    try {
      await call("rec.create", { entity: "pomodoro_session", scope: "personal", values: { title, date_start: s.startedAt ?? toISODateTime(new Date()), amount: minutes, category: s.mode } });
      window.dispatchEvent(new CustomEvent("plu:changed"));
    } catch (e) {
      toast((e as Error).message, "error");
    }
    const cycle = s.mode === "foco" ? s.cycle + 1 : s.cycle;
    const next: Mode = s.mode === "foco" ? (cycle % Math.max(1, cfg.ciclos) === 0 ? "pausa_longa" : "pausa_curta") : "foco";
    const msg = s.mode === "foco" ? `Foco concluído! Hora da ${LABEL[next].toLowerCase()}.` : "Pausa encerrada. Hora de focar!";
    toast(msg);
    showSystemNotification("Pomodoro", msg).catch(() => {});
    setSt({ ...s, mode: next, running: false, endsAt: null, remaining: duration(next), startedAt: null, cycle, completedToday: s.completedToday + (s.mode === "foco" ? 1 : 0) });
    finishing.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, toast]);

  useEffect(() => {
    if (!st.running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [st.running]);
  useEffect(() => {
    if (st.running && st.endsAt && now >= st.endsAt) complete(st);
  }, [now, st, complete]);

  const start = () => {
    const n = Date.now();
    setNow(n);
    setSt((s) => ({ ...s, running: true, endsAt: n + s.remaining, startedAt: s.startedAt ?? toISODateTime(new Date()) }));
  };
  const pause = () => setSt((s) => ({ ...s, running: false, remaining: s.endsAt ? Math.max(0, s.endsAt - Date.now()) : s.remaining, endsAt: null }));
  const reset = () => setSt((s) => ({ ...s, running: false, endsAt: null, remaining: duration(s.mode), startedAt: null }));
  const skip = () => {
    const next: Mode = st.mode === "foco" ? "pausa_curta" : "foco";
    setSt((s) => ({ ...s, mode: next, running: false, endsAt: null, remaining: duration(next), startedAt: null }));
  };
  const setMode = (m: Mode) => setSt((s) => ({ ...s, mode: m, running: false, endsAt: null, remaining: duration(m), startedAt: null }));

  const total = duration(st.mode);
  const frac = Math.min(1, Math.max(0, 1 - left / total));
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  const R = 100, C = 2 * Math.PI * R;
  const color = st.mode === "foco" ? "var(--primary)" : "var(--accent)";
  const updCfg = (k: keyof Cfg, v: string) => {
    const n = k === "tarefa" ? v : Math.max(1, Math.min(k === "ciclos" ? 12 : 180, Number(v) || 1));
    const c = { ...cfg, [k]: n } as Cfg;
    setCfg(c);
    if (!st.running && k === st.mode) setSt((s) => ({ ...s, remaining: duration(s.mode, c), startedAt: null }));
  };

  return (
    <div className="card card-pad pomo" style={{ marginBottom: 16 }}>
      <div className="pomo-grid">
        <div className="col" style={{ alignItems: "center" }}>
          <div className="btn-group" role="group" aria-label="Tipo de sessão">
            {(Object.keys(LABEL) as Mode[]).map((m) => <button key={m} aria-pressed={st.mode === m} onClick={() => setMode(m)} disabled={st.running}>{LABEL[m]}</button>)}
          </div>
          <svg className="pomo-ring" viewBox="0 0 240 240" role="timer" aria-live="off" aria-label={`${LABEL[st.mode]}: ${mm} minutos e ${ss} segundos restantes`}>
            <circle cx="120" cy="120" r={R} fill="none" stroke="var(--bg-sunken)" strokeWidth="14" />
            <circle cx="120" cy="120" r={R} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 120 120)" className="pomo-progress" />
            <text x="120" y="118" textAnchor="middle" fontSize="44" fontWeight="700" fill="var(--text)" style={{ fontVariantNumeric: "tabular-nums" }}>{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</text>
            <text x="120" y="148" textAnchor="middle" fontSize="13" fill="var(--text-3)">{LABEL[st.mode]} · ciclo {(st.cycle % Math.max(1, cfg.ciclos)) + (st.mode === "foco" ? 1 : 0)}/{cfg.ciclos}</text>
          </svg>
          <div className="row">
            {st.running ? <button className="btn primary" onClick={pause}><Icon name="Pause" size={16} /> Pausar</button> : <button className="btn primary" onClick={start}><Icon name="Play" size={16} /> {st.remaining < total ? "Continuar" : "Iniciar"}</button>}
            <button className="btn" onClick={skip} aria-label="Pular para a próxima etapa"><Icon name="SkipForward" size={16} /> Pular</button>
            <button className="btn ghost" onClick={reset} aria-label="Reiniciar temporizador"><Icon name="RotateCcw" size={16} /> Reiniciar</button>
          </div>
          <span className="muted small">{st.completedToday} foco(s) concluído(s) hoje · {st.cycle} no total desta sequência</span>
        </div>
        <div className="col">
          <h3 className="row"><Icon name="Settings" size={16} /> Configuração</h3>
          <label className="field"><span className="label">Em que você vai focar?</span><input className="input" value={cfg.tarefa} onChange={(e) => updCfg("tarefa", e.target.value)} placeholder="Ex.: Estudar capítulo 3" /></label>
          <div className="form-grid">
            <label className="field"><span className="label">Foco (min)</span><input className="input" type="number" min={1} max={180} value={cfg.foco} onChange={(e) => updCfg("foco", e.target.value)} disabled={st.running} /></label>
            <label className="field"><span className="label">Pausa curta (min)</span><input className="input" type="number" min={1} max={60} value={cfg.pausa_curta} onChange={(e) => updCfg("pausa_curta", e.target.value)} disabled={st.running} /></label>
            <label className="field"><span className="label">Pausa longa (min)</span><input className="input" type="number" min={1} max={120} value={cfg.pausa_longa} onChange={(e) => updCfg("pausa_longa", e.target.value)} disabled={st.running} /></label>
            <label className="field"><span className="label">Focos até a pausa longa</span><input className="input" type="number" min={1} max={12} value={cfg.ciclos} onChange={(e) => updCfg("ciclos", e.target.value)} disabled={st.running} /></label>
          </div>
          <p className="muted tiny">Cada etapa concluída é salva no histórico abaixo e gera uma notificação local. O temporizador continua contando se você navegar para outra tela.</p>
        </div>
      </div>
    </div>
  );
}
