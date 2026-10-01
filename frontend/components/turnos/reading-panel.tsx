"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AuditModal } from "@/components/turnos/audit-modal";
import type { AuditExecution } from "@/lib/api-server";
import { superclassColors, superclassNames } from "@/lib/persuasion";
import { dimensoes, palavras, rotuloLegivel, temaCor, type Audiencia, type Opiniao, type PersuasaoTurno } from "@/lib/audiencias";

export type PanelTab = "transcricao" | "resumo" | "deliberacao";

const tabs: Array<{ id: PanelTab; label: string }> = [
  { id: "transcricao", label: "Transcrição" },
  { id: "resumo", label: "Resumo" },
  { id: "deliberacao", label: "Deliberação" },
];

const TRANSCRIPT_WINDOW = 60;

export function ReadingPanel({ data, persuasao, loadAudit, tab, onTab, turn, onTurn, selected, onClose }: {
  data: Audiencia;
  persuasao?: PersuasaoTurno[];
  loadAudit?: (chunkIndexes: number[]) => Promise<AuditExecution[]>;
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  turn: number;
  onTurn: (turn: number) => void;
  selected?: Opiniao;
  onClose: () => void;
}) {
  return (
    <div className="flex h-[600px] min-w-0 flex-col rounded-2xl border border-black/10 bg-white">
      {selected ? <OpinionDetail data={data} opinion={selected} onClose={onClose} onTurn={onTurn}/> : (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-black/10 px-3" role="tablist">
            {tabs.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => onTab(item.id)} className={`relative px-3 py-3 text-sm font-medium ${tab === item.id ? "text-ink" : "text-[#666666] hover:text-ink"}`}>
                {item.label}
                {tab === item.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-orange-500"/>}
              </button>
            ))}
          </div>
          <div key={tab} className="min-h-0 flex-1 overflow-y-auto">
            {tab === "transcricao" && <Transcript data={data} persuasao={persuasao} loadAudit={loadAudit} turn={turn} onTurn={onTurn}/>}
            {tab === "resumo" && <Summary data={data} turn={turn} onTurn={onTurn}/>}
            {tab === "deliberacao" && <Deliberation data={data} turn={turn} onTurn={onTurn}/>}
          </div>
        </>
      )}
    </div>
  );
}

function TurnChip({ id, onTurn }: { id: number; onTurn: (turn: number) => void }) {
  return <button type="button" onClick={() => onTurn(id)} className="shrink-0 rounded bg-paper px-1.5 py-0.5 font-mono text-[10px] text-[#666666] hover:bg-orange-50 hover:text-orange-700">turno {id}</button>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="p-5 text-sm text-[#666666]">{children}</p>;
}

function Transcript({ data, persuasao, loadAudit, turn, onTurn }: { data: Audiencia; persuasao?: PersuasaoTurno[]; loadAudit?: (chunkIndexes: number[]) => Promise<AuditExecution[]>; turn: number; onTurn: (turn: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    const current = currentRef.current;
    if (container && current) container.parentElement?.scrollTo({ top: current.offsetTop - 16, behavior: "smooth" });
  }, [turn]);
  const start = Math.max(0, turn - TRANSCRIPT_WINDOW);

  return (
    <div ref={containerRef} className="relative space-y-1 p-3">
      {start > 0 && <p className="px-3 py-2 text-[11px] text-[#999]">{start} turnos anteriores ocultos. Volte a linha do tempo para lê-los.</p>}
      {data.turnos.slice(start, turn).map((item) => {
        const active = item.turno_id === turn;
        return (
          <div key={item.turno_id} ref={active ? currentRef : undefined} role="button" tabIndex={0} onClick={() => onTurn(item.turno_id)} onKeyDown={(event) => { if (event.key === "Enter") onTurn(item.turno_id); }} className={`block w-full cursor-pointer rounded-lg border-l-2 px-3 py-2.5 text-left transition ${active ? "border-orange-500 bg-orange-50/60" : "border-transparent hover:bg-paper"}`}>
            <span className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <strong className="font-semibold text-ink">{item.falante_norm}</strong>
              {item.papel && <span className="font-semibold text-orange-600">{item.papel.toLowerCase()}</span>}
              {item.partido && <span className="text-[#666666]">{item.partido}</span>}
              {!data.parlamentares.has(item.falante_norm) && <span className="text-[#666666]">convidado(a)</span>}
              <span className="ml-auto font-mono text-[10px] text-[#999]">turno {item.turno_id}</span>
            </span>
            <span className="mt-1 block whitespace-pre-line text-sm leading-6 text-[#333]">
              {persuasao ? <PersuasionText text={item.texto} items={persuasao.filter((p) => p.turno_id === item.turno_id)}/> : item.texto}
            </span>
            {persuasao && loadAudit && (() => {
              const chunkIndexes = Array.from(new Set(persuasao.filter((p) => p.turno_id === item.turno_id).map((p) => p.chunk_index)));
              return chunkIndexes.length > 0 && <AuditModal turn={item.turno_id} chunkIndexes={chunkIndexes} load={loadAudit}/>;
            })()}
          </div>
        );
      })}
    </div>
  );
}

function PersuasionText({ text, items }: { text: string; items: PersuasaoTurno[] }) {
  const spans = items
    .map((item) => ({ ...item, start: text.indexOf(item.trecho) }))
    .filter((item) => item.start >= 0)
    .sort((a, b) => a.start - b.start)
    .filter((item, index, list) => index === 0 || item.start >= list[index - 1].start + list[index - 1].trecho.length);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((item, index) => {
    parts.push(text.slice(cursor, item.start));
    parts.push(
      <mark key={index} className="rounded border-b-2 px-0.5 text-ink" style={{ backgroundColor: superclassColors[item.superclass], borderColor: "rgba(0,0,0,.25)" }} title={`${superclassNames[item.superclass] ?? item.superclass}: ${item.explicacao}`}>
        {text.slice(item.start, item.start + item.trecho.length)}
      </mark>,
    );
    cursor = item.start + item.trecho.length;
  });
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function Summary({ data, turn, onTurn }: { data: Audiencia; turn: number; onTurn: (turn: number) => void }) {
  if (!data.secoes.length) return <Empty>Esta audiência não tem resumo.</Empty>;
  return (
    <div className="space-y-5 p-5">
      <p className="text-xs leading-5 text-[#666666]">O resumo foi escrito sobre a sessão inteira. Cada seção acende quando passa a ter evidência na linha do tempo.</p>
      {data.secoes.map((secao, index) => {
        const first = Math.min(...secao.posicoes.map((posicao) => posicao.turno_id));
        const active = first <= turn;
        return (
          <section key={`${secao.titulo}-${index}`} className={`transition ${active ? "" : "opacity-35"}`}>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><i className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: temaCor(index) }}/>{secao.titulo}</h3>
            {Number.isFinite(first) && <p className="mt-0.5 text-[11px] text-[#999]">{active ? `com evidência desde o turno ${first}` : `ganha evidência no turno ${first}`}</p>}
            <p className="mt-2 text-sm leading-6 text-[#333]">{secao.sintese}</p>
            <ul className="mt-2 space-y-1.5">
              {secao.posicoes.map((posicao, posIndex) => (
                <li key={`${posicao.turno_id}-${posIndex}`} className="flex items-start gap-2 text-xs leading-5 text-[#555]">
                  <TurnChip id={posicao.turno_id} onTurn={onTurn}/>
                  <span><strong className="font-semibold text-ink">{posicao.falante}</strong> {posicao.texto}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Deliberation({ data, turn, onTurn }: { data: Audiencia; turn: number; onTurn: (turn: number) => void }) {
  const [open, setOpen] = useState<string>();
  if (!data.dqi) return <Empty>Esta audiência não tem indicadores de deliberação.</Empty>;
  const coded = data.turnos.filter((item) => item.turno_id <= turn && palavras(item.texto) >= 50).length;
  return (
    <div className="space-y-4 p-5">
      <p className="text-xs leading-5 text-[#666666]">Discourse Quality Index (Steenbergen et al., 2003), aplicado turno a turno. Só a participação sai da estrutura da transcrição; as demais dimensões foram atribuídas por um modelo de linguagem e ainda não passaram por conferência humana, então <strong className="text-ink">o instrumento indica</strong>, não afirma.</p>
      <p className="text-xs text-[#666666]"><strong className="text-ink">{coded}</strong> de {data.dqi.n_turnos_codificados} turnos codificados até aqui (turnos com menos de 50 palavras não são codificados).</p>
      {dimensoes.map((dimensao) => {
        const items = data.codigos.filter((codigo) => codigo.dimensao === dimensao.id && codigo.turno_id <= turn);
        const counts = dimensao.niveis.map((nivel) => items.filter((codigo) => codigo.rotulo === nivel).length);
        const total = Math.max(1, items.length);
        const quoted = items.filter((codigo) => codigo.trecho);
        return (
          <section key={dimensao.id} className="rounded-xl border border-black/10 p-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">{dimensao.titulo}</h3>
             
              {dimensao.id === "participacao" && <span className="whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800">em revisão</span>}
            </div>
            <p className="mt-0.5 text-xs text-[#666666]">{dimensao.pergunta}</p>
            {dimensao.id === "participacao" && <p className="mt-1 text-[11px] leading-5 text-[#999]">A regra atual conta como interrupção qualquer fala fora da ordem esperada da sessão, o que inclui casos que não são interrupção. Está sendo refeita.</p>}
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-paper">
              {counts.map((count, index) => count > 0 && <span key={index} style={{ width: `${(count / total) * 100}%`, backgroundColor: levelColor(index, dimensao.niveis.length) }} title={`${rotuloLegivel(dimensao.niveis[index])}: ${count}`}/>)}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#666666]">
              {dimensao.niveis.map((nivel, index) => <li key={nivel} className="flex items-center gap-1"><i className="size-2 rounded-sm" style={{ backgroundColor: levelColor(index, dimensao.niveis.length) }}/>{rotuloLegivel(nivel)} {counts[index]}</li>)}
            </ul>
            {quoted.length > 0 && (
              <button type="button" onClick={() => setOpen(open === dimensao.id ? undefined : dimensao.id)} className="mt-2 text-[11px] font-semibold text-orange-600 hover:text-orange-700">
                {open === dimensao.id ? "fechar trechos" : `${quoted.length} trecho(s) citado(s)`}
              </button>
            )}
            {open === dimensao.id && (
              <ul className="mt-2 space-y-2">
                {quoted.map((codigo, index) => (
                  <li key={`${codigo.turno_id}-${index}`} className="border-l-2 pl-2.5 text-xs leading-5 text-[#333]" style={{ borderColor: levelColor(dimensao.niveis.indexOf(codigo.rotulo), dimensao.niveis.length) }}>
                    “{codigo.trecho}”
                    <span className="mt-1 flex items-center gap-2 text-[10px] text-[#999]">{codigo.falante} · {rotuloLegivel(codigo.rotulo)} <TurnChip id={codigo.turno_id} onTurn={onTurn}/></span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Coral para o nível mais baixo da escala, azul para o mais alto.
function levelColor(index: number, count: number) {
  const palette = ["#ff4b3e", "#f2a08f", "#9aa6c4", "#344b7f"];
  if (count === 2) return [palette[0], palette[3]][index];
  if (count === 3) return [palette[0], "#c9c9c9", palette[3]][index];
  return palette[index] ?? "#999";
}

type Highlight = { start: number; end: number; kind: "fundamento" | "qualificador" };

// Os offsets do pacote nem sempre batem com o texto do turno; localiza o trecho pelo texto.
function locate(text: string, excerpt: string, kind: Highlight["kind"]): Highlight | null {
  const start = excerpt ? text.indexOf(excerpt) : -1;
  return start >= 0 ? { start, end: start + excerpt.length, kind } : null;
}

function HighlightedTurn({ text, highlights }: { text: string; highlights: Highlight[] }) {
  const sorted = [...highlights].sort((a, b) => a.start - b.start).filter((item, index, list) => index === 0 || item.start >= list[index - 1].end);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((item, index) => {
    parts.push(text.slice(cursor, item.start));
    parts.push(<mark key={index} className={`rounded px-0.5 ${item.kind === "fundamento" ? "bg-[#344b7f]/15 text-ink" : "bg-orange-100 text-ink"}`}>{text.slice(item.start, item.end)}</mark>);
    cursor = item.end;
  });
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function OpinionDetail({ data, opinion, onClose, onTurn }: { data: Audiencia; opinion: Opiniao; onClose: () => void; onTurn: (turn: number) => void }) {
  const turn = data.turnos.find((item) => item.turno_id === opinion.turno_id);
  const secao = data.secoes[opinion.tema];
  const highlights = turn ? [
    ...opinion.fundamentos.map((f) => locate(turn.texto, f.trecho, "fundamento")),
    ...opinion.qualificadores.map((q) => locate(turn.texto, q.trecho, "qualificador")),
  ].filter((item): item is Highlight => item !== null) : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-black/10 p-5">
        <div>
          <p className="text-xs font-semibold text-[#666666]">{opinion.falante}</p>
          <h3 className="mt-1 text-lg font-semibold leading-snug text-ink">{opinion.texto}</h3>
          {secao && <p className="mt-2 flex items-center gap-1.5 text-xs text-[#666666]"><i className="size-2 rounded-full" style={{ backgroundColor: temaCor(opinion.tema) }}/>{secao.titulo}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-8 shrink-0 place-items-center rounded-lg border border-black/10 text-[#666666] hover:text-ink"><X className="size-4"/></button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {opinion.fundamentos.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#999]">O que sustenta a posição</p>
            <ul className="space-y-1.5">
              {opinion.fundamentos.map((f, index) => <li key={index} className="border-l-2 border-[#344b7f] pl-2.5 text-xs leading-5 text-[#333]"><span className="font-semibold text-[#344b7f]">{f.tipo}</span> · “{f.trecho}”</li>)}
            </ul>
          </div>
        )}
        {opinion.qualificadores.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#999]">Ressalvas</p>
            <ul className="space-y-1.5">
              {opinion.qualificadores.map((q, index) => <li key={index} className="border-l-2 border-orange-400 pl-2.5 text-xs leading-5 text-[#333]"><span className="font-semibold text-orange-700">{rotuloLegivel(q.tipo)}</span> · “{q.trecho}”{q.preservado === false && <span className="text-[#999]"> (perdida no resumo da posição)</span>}</li>)}
            </ul>
          </div>
        )}
        {turn && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#999]">Fala de origem · turno {turn.turno_id}</p>
            <blockquote className="whitespace-pre-line border-l-2 border-orange-500 pl-3 text-sm leading-6 text-[#333]"><HighlightedTurn text={turn.texto} highlights={highlights}/></blockquote>
            <p className="mt-3 text-[11px] leading-5 text-[#999]">A âncora garante que a posição aponta para uma fala real da pessoa certa. A fidelidade da leitura foi medida à parte: 94,9% em 59 afirmações de 6 audiências.</p>
          </div>
        )}
        <button type="button" onClick={() => { onTurn(opinion.turno_id); onClose(); }} className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600">Ver na transcrição</button>
      </div>
    </div>
  );
}
