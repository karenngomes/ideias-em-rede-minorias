"use client";

import { useEffect, useRef, useState } from "react";
import type { ApproachClassification, ClassificationAudit, ExecutedPrompt } from "@/lib/persuasion-api";

type PromptEntry = {
  key: string;
  stage: string;
  paragraph?: number;
  detail: string;
  prompt: ExecutedPrompt;
  response?: unknown;
  warnings?: string[];
};

function promptEntries(
  classification: ApproachClassification | null | undefined,
  audit: ClassificationAudit | null | undefined,
): PromptEntry[] {
  const paragraphExecutions: PromptEntry[] = (audit?.executions ?? []).map((execution) => ({
    key: `classification-audit-${execution.paragraph_index}`,
    stage: "Classificação do parágrafo",
    paragraph: execution.paragraph_index + 1,
    detail: `${audit?.model} · caracteres ${execution.start}–${execution.end}`,
    prompt: execution.prompt,
    response: execution.response,
    warnings: execution.validation_warnings,
  }));

  const auditedExecution: PromptEntry[] = audit?.prompt ? [{
    key: "classification-audit",
    stage: "Classificação da fala",
    detail: `${audit.model} · ${new Date(audit.captured_at).toLocaleString("pt-BR")}`,
    prompt: audit.prompt,
    response: audit.response,
    warnings: audit.validation_warnings,
  }] : [];

  const superclasses = (classification?.superclass_classifications ?? []).flatMap((item, index) => item.prompt ? [{
    key: `superclass-${item.paragraph_index ?? index}-${item.superclass}-${index}`,
    stage: "Classificação de superclasse" as const,
    paragraph: (item.paragraph_index ?? index) + 1,
    detail: item.superclass.replaceAll("_", " "),
    prompt: item.prompt,
  }] : []);

  return [...paragraphExecutions, ...auditedExecution, ...superclasses];
}

export function ChunkPromptsModal({
  chunkNumber,
  classification,
  audit,
}: {
  chunkNumber: number;
  classification?: ApproachClassification | null;
  audit?: ClassificationAudit | null;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const entries = promptEntries(classification, audit);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (entries.length === 0) return null;

  return (
    <>
      <button className="chunkPromptButton" type="button" onClick={() => setOpen(true)}>
        Ver auditoria <span>{entries.length}</span>
      </button>
      <dialog
        className="chunkPromptModal"
        ref={dialogRef}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <div className="chunkPromptModalHeader">
          <div>
            <span>RASTREABILIDADE</span>
            <h2>Auditoria da fala #{chunkNumber}</h2>
            <p>{entries.length} {entries.length === 1 ? "execução registrada" : "execuções registradas"}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar modal">×</button>
        </div>
        <div className="chunkPromptModalBody">
          {entries.map((entry, index) => (
            <section className="executedPrompt" key={entry.key}>
              <div className="executedPromptHeading">
                <strong>{index + 1}. {entry.stage}</strong>
                <span>{entry.paragraph ? `Parágrafo ${entry.paragraph} · ` : ""}{entry.detail}</span>
              </div>
              <details open={index === 0}>
                <summary>System prompt</summary>
                <pre>{entry.prompt.system}</pre>
              </details>
              <details>
                <summary>User prompt (contexto executado)</summary>
                <pre>{entry.prompt.user}</pre>
              </details>
              {entry.response !== undefined && (
                <details open={index === 0}>
                  <summary>Resposta original do modelo</summary>
                  <pre>{JSON.stringify(entry.response, null, 2)}</pre>
                </details>
              )}
              {!!entry.warnings?.length && (
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
