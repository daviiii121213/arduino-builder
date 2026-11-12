// Anexos locais de um registro: importar, visualizar imagens, abrir, salvar uma cópia e remover.
import { useEffect, useRef, useState } from "react";
import { call } from "../api/client";
import { isTauri } from "../api/client";
import { openPath, saveFileDialog } from "../api/native";
import { useApp } from "../contexts/app";
import { useAsync } from "../hooks/data";
import { bytes, fmtDateTime } from "../utils/format";
import { Icon } from "./Icon";
import { Loading } from "./ui";

interface Att {
  id: string;
  file_name: string;
  mime?: string;
  size: number;
  created_at: string;
  owner_name?: string;
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Falha ao ler o arquivo."));
    r.readAsDataURL(file);
  });
}

export function Thumb({ id, alt, className }: { id: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    call<{ data_url: string }>("attach.data_url", { id }).then((r) => live && setSrc(r.data_url)).catch(() => {});
    return () => { live = false; };
  }, [id]);
  return src ? <img src={src} alt={alt} className={className} loading="lazy" /> : <div className="skeleton" style={{ height: 140 }} />;
}

export async function uploadFiles(entity: string, recordId: string, files: FileList | File[]): Promise<number> {
  let n = 0;
  for (const f of Array.from(files)) {
    if (f.size > 50 * 1024 * 1024) throw new Error(`"${f.name}" excede 50 MB.`);
    const data = await readFileAsDataURL(f);
    await call("attach.add", { entity, record_id: recordId, name: f.name, data });
    n++;
  }
  return n;
}

export function Attachments({ entity, recordId, canEdit, onChange }: { entity: string; recordId: string; canEdit: boolean; onChange?: () => void }) {
  const { toast, confirm } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, reload } = useAsync(() => call<{ items: Att[] }>("attach.list", { entity, record_id: recordId }), [entity, recordId]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const n = await uploadFiles(entity, recordId, files);
      toast(`${n} arquivo(s) anexado(s).`);
      reload();
      onChange?.();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const open = async (a: Att) => {
    try {
      if (isTauri) {
        const { path } = await call<{ path: string }>("attach.path", { id: a.id });
        await openPath(path);
      } else if (a.mime?.startsWith("image/") || a.mime === "application/pdf" || a.mime === "text/plain") {
        const r = await call<{ data_url: string }>("attach.data_url", { id: a.id });
        const w = window.open();
        w?.document.write(`<iframe src="${r.data_url}" style="border:0;width:100%;height:100%"></iframe>`);
      }
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const saveCopy = async (a: Att) => {
    const dest = await saveFileDialog(a.file_name, [{ name: "Arquivo", extensions: [a.file_name.split(".").pop() || "*"] }]);
    if (!dest) return;
    try {
      await call("attach.export", { id: a.id, dest });
      toast("Cópia salva.");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const remove = async (a: Att) => {
    if (!(await confirm({ title: "Remover anexo?", message: `O arquivo "${a.file_name}" será excluído do aplicativo.`, confirmLabel: "Remover", danger: true }))) return;
    await call("attach.delete", { id: a.id });
    reload();
    onChange?.();
  };

  const images = (data?.items ?? []).filter((a) => a.mime?.startsWith("image/"));
  return (
    <section className="col" aria-label="Anexos">
      <div className="row between">
        <h3 className="row"><Icon name="Paperclip" size={17} /> Anexos</h3>
        {canEdit && (
          <>
            <input ref={input} type="file" multiple hidden onChange={(e) => upload(e.target.files)} aria-label="Selecionar arquivos" />
            <button className="btn sm" onClick={() => input.current?.click()} disabled={busy}><Icon name="Upload" size={15} /> {busy ? "Enviando…" : "Adicionar arquivos"}</button>
          </>
        )}
      </div>
      {loading ? <Loading /> : !data?.items.length ? (
        <p className="muted small">Nenhum arquivo anexado. Os arquivos ficam guardados na pasta local do aplicativo.</p>
      ) : (
        <>
          {images.length > 0 && (
            <div className="photo-grid">
              {images.map((a) => (
                <figure key={a.id}><Thumb id={a.id} alt={a.file_name} /><figcaption className="ellipsis">{a.file_name}</figcaption></figure>
              ))}
            </div>
          )}
          <div className="list card">
            {data.items.map((a) => (
              <div className="list-item" key={a.id}>
                <Icon name={a.mime?.startsWith("image/") ? "Image" : "FileText"} />
                <div className="grow">
                  <div className="title ellipsis">{a.file_name}</div>
                  <div className="muted tiny">{bytes(a.size)} · {fmtDateTime(a.created_at)}{a.owner_name ? ` · ${a.owner_name}` : ""}</div>
                </div>
                {isTauri && <button className="btn icon sm ghost" title="Abrir" aria-label={`Abrir ${a.file_name}`} onClick={() => open(a)}><Icon name="ExternalLink" size={15} /></button>}
                {!isTauri && (a.mime?.startsWith("image/") || a.mime === "application/pdf") && <button className="btn icon sm ghost" title="Visualizar" aria-label={`Visualizar ${a.file_name}`} onClick={() => open(a)}><Icon name="Eye" size={15} /></button>}
                <button className="btn icon sm ghost" title="Salvar cópia" aria-label={`Salvar cópia de ${a.file_name}`} onClick={() => saveCopy(a)}><Icon name="Download" size={15} /></button>
                {canEdit && <button className="btn icon sm ghost" title="Remover" aria-label={`Remover ${a.file_name}`} onClick={() => remove(a)}><Icon name="Trash2" size={15} /></button>}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
