// Editor de mapa mental com salvamento automático (dados em record.data.nodes/edges).
import { useEffect, useRef, useState } from "react";
import { call } from "../../api/client";
import { useApp } from "../../contexts/app";
import { Icon } from "../../components/Icon";
import { PALETTE } from "../../components/ui";
import type { DetailProps } from "../types";

interface MNode { id: string; x: number; y: number; text: string; color: string }
interface MEdge { from: string; to: string }

const nid = () => Math.random().toString(36).slice(2, 10);

export function MindMapEditor({ record }: DetailProps) {
  const { toast } = useApp();
  const canEdit = !!record.can_edit;
  const [nodes, setNodes] = useState<MNode[]>(() => {
    const n = record.data?.nodes;
    return Array.isArray(n) && n.length ? n : [{ id: "raiz", x: 240, y: 200, text: record.title, color: PALETTE[0] }];
  });
  const [edges, setEdges] = useState<MEdge[]>(() => (Array.isArray(record.data?.edges) ? record.data.edges : []));
  const [sel, setSel] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [status, setStatus] = useState<"salvo" | "pendente" | "salvando" | "erro">("salvo");
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const first = useRef(true);
  const dataRef = useRef(record.data ?? {});

  // salvamento automático com atraso
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!canEdit) return;
    setStatus("pendente");
    const t = setTimeout(async () => {
      setStatus("salvando");
      try {
        const data = { ...dataRef.current, nodes, edges };
        await call("rec.update", { entity: "mindmap", id: record.id, values: { data } });
        dataRef.current = data;
        setStatus("salvo");
      } catch (e) {
        setStatus("erro");
        toast((e as Error).message, "error");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [nodes, edges, record.id, canEdit, toast]);

  const selected = nodes.find((n) => n.id === sel) ?? null;
  const update = (id: string, patch: Partial<MNode>) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)));

  const addChild = () => {
    const parent = selected ?? nodes[0];
    const kids = edges.filter((e) => e.from === parent?.id).length;
    const angle = (kids * 55 + 20) * (Math.PI / 180);
    const id = nid();
    const w = box.current?.clientWidth ?? 600;
    const n: MNode = { id, x: Math.min(w - 60, Math.max(60, (parent?.x ?? 200) + Math.cos(angle) * 170)), y: Math.min(520, Math.max(30, (parent?.y ?? 200) + Math.sin(angle) * 110)), text: "Nova ideia", color: parent?.color ?? PALETTE[0] };
    setNodes((ns) => [...ns, n]);
    if (parent) setEdges((es) => [...es, { from: parent.id, to: id }]);
    setSel(id);
    setEditing(id);
  };
  const deleteNode = (id: string) => {
    if (nodes.length <= 1) { toast("O mapa precisa de pelo menos um nó.", "error"); return; }
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.from !== id && e.to !== id));
    setSel(null);
  };
  const removeSel = () => {
    if (selEdge !== null) { setEdges((es) => es.filter((_, i) => i !== selEdge)); setSelEdge(null); return; }
    if (selected) deleteNode(selected.id);
  };
  const clickNode = (id: string) => {
    if (connectFrom && connectFrom !== id) {
      if (!edges.some((e) => (e.from === connectFrom && e.to === id) || (e.from === id && e.to === connectFrom))) setEdges((es) => [...es, { from: connectFrom, to: id }]);
      setConnectFrom(null);
      return;
    }
    setSel(id);
    setSelEdge(null);
  };

  const onPointerDown = (e: React.PointerEvent, n: MNode) => {
    if (!canEdit || editing === n.id) return;
    const rect = box.current!.getBoundingClientRect();
    drag.current = { id: n.id, dx: e.clientX - rect.left - n.x, dy: e.clientY - rect.top - n.y, moved: false };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const rect = box.current!.getBoundingClientRect();
    const x = Math.max(20, Math.min(rect.width - 20, e.clientX - rect.left - d.dx));
    const y = Math.max(16, Math.min(rect.height - 16, e.clientY - rect.top - d.dy));
    d.moved = true;
    update(d.id, { x: Math.round(x), y: Math.round(y) });
  };
  const onPointerUp = () => { drag.current = null; };

  const onKey = (e: React.KeyboardEvent, n: MNode) => {
    if (editing === n.id || !canEdit) return;
    const step = e.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { e.preventDefault(); update(n.id, { x: n.x + moves[e.key][0], y: n.y + moves[e.key][1] }); }
    else if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); setEditing(n.id); }
    else if (e.key === "Delete") { e.preventDefault(); deleteNode(n.id); }
    else if (e.key === "Insert" || (e.key === "Tab" && e.altKey)) { e.preventDefault(); addChild(); }
  };

  const byId = (id: string) => nodes.find((n) => n.id === id);
  return (
    <section className="col" aria-label="Editor do mapa mental">
      <div className="row wrap">
        <h3 className="row grow"><Icon name="Network" size={17} /> Mapa</h3>
        <span className={`badge ${status === "salvo" ? "success" : status === "erro" ? "danger" : ""}`} aria-live="polite">
          {status === "salvo" ? "Salvo" : status === "salvando" ? "Salvando…" : status === "erro" ? "Erro ao salvar" : "Alterações pendentes"}
        </span>
      </div>
      {canEdit && (
        <div className="row wrap">
          <button className="btn sm" onClick={addChild}><Icon name="Plus" size={15} /> {selected ? "Nó filho" : "Novo nó"}</button>
          <button className="btn sm" disabled={!selected} aria-pressed={!!connectFrom} onClick={() => setConnectFrom(connectFrom ? null : sel)}><Icon name="Link2" size={15} /> {connectFrom ? "Escolha o destino…" : "Conectar"}</button>
          <button className="btn sm" disabled={!selected} onClick={() => selected && setEditing(selected.id)}><Icon name="Pencil" size={15} /> Editar texto</button>
          <button className="btn sm" disabled={!selected && selEdge === null} onClick={removeSel}><Icon name="Trash2" size={15} /> {selEdge !== null ? "Excluir conexão" : "Excluir nó"}</button>
          {selected && (
            <div className="swatches" role="group" aria-label="Cor do nó">
              {PALETTE.slice(0, 8).map((c) => <button key={c} type="button" className="swatch" style={{ background: c, width: 22, height: 22 }} aria-pressed={selected.color === c} aria-label={`Cor ${c}`} onClick={() => update(selected.id, { color: c })} />)}
            </div>
          )}
        </div>
      )}
      <div className="mindmap" ref={box} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
        onClick={(e) => { if (e.target === box.current) { setSel(null); setSelEdge(null); setConnectFrom(null); } }}>
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          {edges.map((e, i) => {
            const a = byId(e.from), b = byId(e.to);
            if (!a || !b) return null;
            return (
              <g key={i} onClick={(ev) => { ev.stopPropagation(); setSelEdge(i); setSel(null); }} style={{ cursor: "pointer" }}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={12} />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={selEdge === i ? "var(--danger)" : b.color} strokeWidth={selEdge === i ? 3.5 : 2.2} strokeOpacity={0.75} />
              </g>
            );
          })}
        </svg>
        {nodes.map((n) => (
          <div key={n.id} className={`mm-node ${sel === n.id ? "sel" : ""}`} tabIndex={0} role="button"
            aria-label={`Nó: ${n.text}${sel === n.id ? " (selecionado)" : ""}. Setas movem, Enter edita, Delete exclui, Insert cria filho.`}
            style={{ left: n.x, top: n.y, transform: "translate(-50%, -50%)", "--c": n.color } as React.CSSProperties}
            onPointerDown={(e) => onPointerDown(e, n)} onClick={(e) => { e.stopPropagation(); clickNode(n.id); }}
            onDoubleClick={() => canEdit && setEditing(n.id)} onKeyDown={(e) => onKey(e, n)} onFocus={() => !connectFrom && setSel(n.id)}>
            {editing === n.id ? (
              <input className="input" autoFocus defaultValue={n.text} style={{ height: 28, minWidth: 120 }} aria-label="Texto do nó"
                onBlur={(e) => { update(n.id, { text: e.target.value.trim() || "Sem título" }); setEditing(null); }}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(null); }} />
            ) : n.text}
          </div>
        ))}
      </div>
      <p className="muted tiny">Arraste os nós para organizar. Duplo clique edita o texto. Selecione um nó e use "Conectar" para ligá-lo a outro. As alterações são salvas automaticamente.</p>
    </section>
  );
}
