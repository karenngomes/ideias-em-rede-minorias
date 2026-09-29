"use client";

import { useEffect, useRef, useState } from "react";

type ClassificationError = {
  type: string;
  message: string;
  occurred_at?: string;
};

function formatDate(value?: string) {
  if (!value) return "Data não registrada";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "medium" }).format(date);
}

export function ChunkErrorModal({
  chunkNumber,
  error,
}: {
  chunkNumber: number;
  error: ClassificationError;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button className="chunkErrorButton" type="button" onClick={() => setOpen(true)}>
        Ver erro da análise
      </button>
      <dialog
        className="chunkErrorModal"
        ref={dialogRef}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <div className="chunkErrorModalHeader">
          <div>
            <span>FALHA NA CLASSIFICAÇÃO</span>
            <h2>Erro no chunk #{chunkNumber}</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar modal">×</button>
        </div>
        <div className="chunkErrorModalBody">
          <dl>
            <div><dt>Tipo do erro</dt><dd><code>{error.type}</code></dd></div>
            <div><dt>Data e hora</dt><dd>{formatDate(error.occurred_at)}</dd></div>
          </dl>
          <section>
            <strong>Mensagem completa</strong>
            <pre>{error.message}</pre>
          </section>
        </div>
      </dialog>
    </>
  );
}
