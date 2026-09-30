"use client";

import { useEffect, useRef, useState } from "react";
import type { AuditExecution } from "@/lib/api-server";

export function AuditModal({ turn, chunkIndexes, load }: {
  turn: number;
  chunkIndexes: number[];
  load: (chunkIndexes: number[]) => Promise<AuditExecution[]>;
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditExecution[]>();
  const [error, setError] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function openAudit() {
    setOpen(true);
    if (entries) return;
    load(chunkIndexes).then(setEntries).catch(() => setError(true));
  }

  return (
    <>
      <button type="button" onClick={(event) => { event.stopPropagation(); openAudit(); }} className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[#344b7f]/30 bg-[#344b7f]/5 px-2 py-1 text-[11px] font-semibold text-[#344b7f] hover:bg-[#344b7f]/10">
        Ver auditoria
      </button>
      <dialog className="chunkPromptModal" ref={dialogRef} onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={(event) => event.stopPropagation()}>
        <div className="chunkPromptModalHeader">
          <div>
            <span>RASTREABILIDADE</span>
            <h2>Auditoria da persuasão · turno {turn}</h2>
            <p>{entries ? `${entries.length} ${entries.length === 1 ? "chamada ao modelo" : "chamadas ao modelo"}` : error ? "Não foi possível carregar a auditoria." : "Carregando…"}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
        </div>
        <div className="chunkPromptModalBody">
          {entries?.map((entry, index) => (
            <section className="executedPrompt" key={`${entry.chunk_index}-${entry.paragraph_index}`}>
              <div className="executedPromptHeading">
                <strong>{index + 1}. Classificação do parágrafo</strong>
                <span>Trecho {entry.chunk_index + 1} · parágrafo {entry.paragraph_index + 1} · {entry.model}</span>
              </div>
              <details open={index === 0}>
                <summary>System prompt</summary>
                <pre>{entry.system}</pre>
              </details>
              <details>
                <summary>User prompt (contexto enviado)</summary>
                <pre>{entry.user}</pre>
              </details>
              <details open={index === 0}>
                <summary>Resposta original do modelo</summary>
                <pre>{JSON.stringify(entry.response, null, 2)}</pre>
              </details>
              {entry.warnings.length > 0 && (
                <div className="auditWarnings">
                  <strong>Ajustes de validação</strong>
                  <ul>{entry.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                </div>
              )}
            </section>
          ))}
        </div>
      </dialog>
    </>
  );
}
