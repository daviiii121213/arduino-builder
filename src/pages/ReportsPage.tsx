// Relatórios: escolha, filtros por período e colunas, pré-visualização e exportação PDF/CSV/XLSX.
import { useEffect, useMemo, useState } from "react";
import { call, isTauri } from "../api/client";
import { openPath, revealPath, saveFileDialog } from "../api/native";
import { useApp, type Workspace } from "../contexts/app";
import { Icon } from "../components/Icon";
import { ErrorState, Field, Loading, Segmented } from "../components/ui";
import { useAsync } from "../hooks/data";
import { toISODate } from "../utils/format";

interface ReportDef {
  key: string;
  title: string;
  scopes: Workspace[];
  columns: Array<{ key: string; label: string }>;
}

interface Preview {
  title: string;
  period: string;
  summary: Array<[string, string]>;
  columns: Array<{ key: string; label: string; numeric: boolean }>;
  rows: string[][];
  total: number;
}

type Preset = "mes" | "mes_anterior" | "ano" | "tudo" | "personalizado";

function range(p: Preset): [string, string] {
  const d = new Date();
  if (p === "mes") return [toISODate(new Date(d.getFullYear(), d.getMonth(), 1)), toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  if (p === "mes_anterior") return [toISODate(new Date(d.getFullYear(), d.getMonth() - 1, 1)), toISODate(new Date(d.getFullYear(), d.getMonth(), 0))];
  if (p === "ano") return [`${d.getFullYear()}-01-01`, `${d.getFullYear()}-12-31`];
  return ["", ""];
}

const FORMATS = [
  { f: "pdf", label: "PDF", ext: "pdf", name: "Documento PDF" },
  { f: "csv", label: "CSV", ext: "csv", name: "Planilha CSV" },
  { f: "xlsx", label: "XLSX", ext: "xlsx", name: "Planilha do Excel" },
] as const;

export function ReportsPage() {
  const { perm, can, toast, workspace } = useApp();
  const cat = useAsync(() => call<{ reports: ReportDef[] }>("report.catalog"), []);
  const [key, setKey] = useState("tarefas_pendentes");
  const [scope, setScope] = useState<Workspace>(workspace);
  const [preset, setPreset] = useState<Preset>("mes");
  const [from, setFrom] = useState(range("mes")[0]);
  const [to, setTo] = useState(range("mes")[1]);
  const [cols, setCols] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const rep = cat.data?.reports.find((r) => r.key === key);
  const familyOk = !!perm.family_id && can("reports.view");
  const scopes = (rep?.scopes ?? ["personal"]).filter((s) => s === "personal" || familyOk);
  const effScope: Workspace = scopes.includes(scope) ? scope : "personal";

  useEffect(() => { if (rep) setCols(rep.columns.map((c) => c.key)); }, [rep]);
  useEffect(() => { if (preset !== "personalizado") { const [a, b] = range(preset); setFrom(a); setTo(b); } }, [preset]);

  const args = useMemo(() => ({ report: key, scope: effScope, from: from || undefined, to: to || undefined, columns: cols }), [key, effScope, from, to, cols]);
  const prev = useAsync(() => (cols.length ? call<Preview>("report.preview", args) : Promise.resolve(null)), [JSON.stringify(args)]);

  const exportAs = async (fmt: (typeof FORMATS)[number]) => {
    const stamp = toISODate(new Date());
    const path = await saveFileDialog(`${key}-${effScope === "family" ? "familia" : "pessoal"}-${stamp}.${fmt.ext}`, [{ name: fmt.name, extensions: [fmt.ext] }]);
    if (!path) return;
    setBusy(fmt.f);
    try {
      const r = await call<{ path: string; rows: number }>("report.export", { ...args, format: fmt.f, path });
      setLast(r.path);
      toast(`Relatório salvo (${r.rows} registro(s)): ${r.path}`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  if (cat.error) return <ErrorState message={cat.error} onRetry={cat.reload} />;
  if (!cat.data) return <Loading />;

  return (
    <div>
      <div className="page-head">
        <div className="title-block">
          <div className="page-icon"><Icon name="BarChart3" size={22} /></div>
          <div>
            <h1>Relatórios</h1>
            <p>Gere relatórios por período e exporte em PDF, CSV ou XLSX. Apenas dados que você pode ver são incluídos.</p>
          </div>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "300px minmax(0, 1fr)", alignItems: "start" }}>
        <div className="card">
          <div className="list" role="listbox" aria-label="Tipos de relatório">
            {cat.data.reports.map((r) => (
              <button key={r.key} role="option" aria-selected={r.key === key} className="list-item" style={r.key === key ? { background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" } : undefined} onClick={() => setKey(r.key)}>
                <Icon name="FileText" size={16} /><span className="grow">{r.title}</span>
                {r.scopes.includes("family") && <span className="badge accent tiny">família</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="stack">
          <div className="card card-pad stack">
            <div className="row wrap" style={{ gap: 16, alignItems: "flex-end" }}>
              <Field label="Ambiente">
                <Segmented label="Ambiente do relatório" value={effScope} onChange={setScope} options={scopes.map((s) => ({ key: s, label: s === "family" ? "FAMÍLIA" : "PESSOAL" }))} />
              </Field>
              <Field label="Período" htmlFor="rp-preset">
                <select id="rp-preset" className="input" value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
                  <option value="mes">Este mês</option><option value="mes_anterior">Mês anterior</option><option value="ano">Este ano</option><option value="tudo">Todo o período</option><option value="personalizado">Personalizado</option>
                </select>
              </Field>
              <Field label="De" htmlFor="rp-from"><input id="rp-from" className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("personalizado"); }} /></Field>
              <Field label="Até" htmlFor="rp-to"><input id="rp-to" className="input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset("personalizado"); }} /></Field>
            </div>
            {rep?.scopes.includes("family") && !familyOk && <p className="muted small">Relatórios da família exigem participar de uma família e ter a permissão “Relatórios”.</p>}
            <div>
              <span className="label">Colunas</span>
              <div className="row wrap" style={{ marginTop: 6 }}>
                {rep?.columns.map((c) => (
                  <label key={c.key} className="check badge" style={{ padding: "5px 10px" }}>
                    <input type="checkbox" checked={cols.includes(c.key)} onChange={(e) => setCols((s) => (e.target.checked ? rep.columns.map((x) => x.key).filter((k) => k === c.key || s.includes(k)) : s.filter((k) => k !== c.key)))} /> {c.label}
                  </label>
                ))}
              </div>
              {!cols.length && <p className="small" role="alert" style={{ color: "var(--danger)", marginTop: 6 }}>Selecione ao menos uma coluna.</p>}
            </div>
            <div className="row wrap">
              {FORMATS.map((f) => (
                <button key={f.f} className="btn primary" disabled={!cols.length || !!busy} onClick={() => exportAs(f)}><Icon name="Download" size={16} /> {busy === f.f ? "Gerando…" : `Exportar ${f.label}`}</button>
              ))}
              {last && isTauri && (
                <>
                  <button className="btn" onClick={() => openPath(last)}><Icon name="ExternalLink" size={15} /> Abrir arquivo</button>
                  <button className="btn" onClick={() => revealPath(last)}><Icon name="FolderOpen" size={15} /> Mostrar na pasta</button>
                </>
              )}
              {last && <span className="muted tiny ellipsis" style={{ maxWidth: 360 }} title={last}>Último arquivo: {last}</span>}
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h3>{prev.data?.title ?? rep?.title}</h3>
              <span className="muted small">{prev.data?.period}</span>
            </div>
            {prev.error ? <div className="card-body"><ErrorState message={prev.error} onRetry={prev.reload} /></div> : prev.loading && !prev.data ? <Loading /> : prev.data && (
              <>
                {prev.data.summary.length > 0 && (
                  <div className="card-body stats">
                    {prev.data.summary.map(([k, v]) => <div key={k} className="stat"><span>{k.replace(/:$/, "")}</span><b style={{ fontSize: "1.15rem" }}>{v}</b></div>)}
                  </div>
                )}
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr>{prev.data.columns.map((c) => <th key={c.key} className={c.numeric ? "num" : undefined}>{c.label}</th>)}</tr></thead>
                    <tbody>
                      {prev.data.rows.length === 0 && <tr><td colSpan={prev.data.columns.length} className="muted">Nenhum registro no período selecionado.</td></tr>}
                      {prev.data.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={prev.data!.columns[j]?.numeric ? "num" : undefined}>{c}</td>)}</tr>)}
                    </tbody>
                  </table>
                </div>
                {prev.data.total > prev.data.rows.length && <p className="muted small card-body">Pré-visualização limitada a {prev.data.rows.length} de {prev.data.total} registros. A exportação inclui todos.</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
