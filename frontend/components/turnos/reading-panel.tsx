"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cobertura, codigos, dimensoes, dqiResumo, parlamentares, rotuloLegivel, secoes, temaCores, turnos, type Opiniao } from "@/lib/thalia";

export type PanelTab = "transcricao" | "resumo" | "materia" | "deliberacao";

const tabs: Array<{ id: PanelTab; label: string }> = [
  { id: "transcricao", label: "Transcrição" },
  { id: "resumo", label: "Resumo" },
  { id: "materia", label: "Matéria" },
  { id: "deliberacao", label: "Deliberação" },
];

export function ReadingPanel({ tab, onTab, turn, onTurn, selected, onClose }: {
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  turn: number;
  onTurn: (turn: number) => void;
  selected?: Opiniao;
  onClose: () => void;
}) {
  return (
    <div className="flex h-[600px] min-w-0 flex-col rounded-2xl border border-black/10 bg-white">
      {selected ? <OpinionDetail opinion={selected} onClose={onClose} onTurn={onTurn}/> : (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-black/10 px-3" role="tablist">
            {tabs.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => onTab(item.id)} className={`relative px-3 py-3 text-sm font-medium ${tab === item.id ? "text-ink" : "text-[#666666] hover:text-ink"}`}>
                {item.label}
                {tab === item.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-orange-500"/>}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "transcricao" && <Transcript turn={turn} onTurn={onTurn}/>}
            {tab === "resumo" && <Summary turn={turn} onTurn={onTurn}/>}
            {tab === "materia" && <Coverage onTurn={onTurn}/>}
            {tab === "deliberacao" && <Deliberation turn={turn} onTurn={onTurn}/>}
          </div>
        </>
      )}
    </div>
  );
}

function Badge({ kind }: { kind: "exata" | "julgada" }) {
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${kind === "exata" ? "bg-[#344b7f]/10 text-[#344b7f]" : "bg-orange-50 text-orange-700"}`}>{kind}</span>;
}

function TurnChip({ id, onTurn }: { id: number; onTurn: (turn: number) => void }) {
  return <button type="button" onClick={() => onTurn(id)} className="rounded bg-paper px-1.5 py-0.5 font-mono text-[10px] text-[#666666] hover:bg-orange-50 hover:text-orange-700">turno {id}</button>;
}

function Transcript({ turn, onTurn }: { turn: number; onTurn: (turn: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    const current = currentRef.current;
    if (container && current) container.parentElement?.scrollTo({ top: current.offsetTop - 16, behavior: "smooth" });
  }, [turn]);

  return (
    <div ref={containerRef} className="relative space-y-1 p-3">
      {turnos.filter((item) => item.turno_id <= turn).map((item) => {
        const active = item.turno_id === turn;
        return (
          <button key={item.turno_id} ref={active ? currentRef : undefined} type="button" onClick={() => onTurn(item.turno_id)} className={`block w-full rounded-lg border-l-2 px-3 py-2.5 text-left transition ${active ? "border-orange-500 bg-orange-50/60" : "border-transparent hover:bg-paper"}`}>
            <span className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <strong className="font-semibold text-ink">{item.falante_norm}</strong>
              {item.papel && <span className="font-semibold text-orange-600">{item.papel.toLowerCase()}</span>}
              {item.partido && <span className="text-[#666666]">{item.partido}</span>}
              {!parlamentares.has(item.falante_norm) && <span className="text-[#666666]">convidado(a)</span>}
              <span className="ml-auto font-mono text-[10px] text-[#999]">turno {item.turno_id}</span>
            </span>
            <span className="mt-1 block text-sm leading-6 text-[#333]">{item.texto}</span>
          </button>
        );
      })}
    </div>
  );
}

function Summary({ turn, onTurn }: { turn: number; onTurn: (turn: number) => void }) {
  return (
    <div className="space-y-5 p-5">
      <p className="text-xs leading-5 text-[#666666]">O resumo foi escrito sobre a sessão inteira. Cada seção acende quando passa a ter evidência na linha do tempo.</p>
      {secoes.map((secao, index) => {
        const first = Math.min(...secao.posicoes.map((posicao) => posicao.turno_id));
        const active = first <= turn;
        return (
          <section key={secao.titulo} className={`transition ${active ? "" : "opacity-35"}`}>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><i className="size-2.5 rounded-full" style={{ backgroundColor: temaCores[index] }}/>{secao.titulo}</h3>
            <p className="mt-0.5 text-[11px] text-[#999]">{active ? `com evidência desde o turno ${first}` : `ganha evidência no turno ${first}`}</p>
            <p className="mt-2 text-sm leading-6 text-[#333]">{secao.sintese}</p>
            <ul className="mt-2 space-y-1.5">
              {secao.posicoes.map((posicao) => (
                <li key={`${posicao.turno_id}-${posicao.texto}`} className="flex items-start gap-2 text-xs leading-5 text-[#555]">
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

function percent(value: number | null) {
  return value == null ? "sem dado" : `${Math.round(value * 100)}%`;
}

function Coverage({ onTurn }: { onTurn: (turn: number) => void }) {
  const [withChair, setWithChair] = useState(false);
  const data = cobertura.proporcoes[withChair ? "com_mesa" : "sem_mesa"];
  const maxWords = Math.max(...cobertura.falantes.map((falante) => falante.n_palavras));
  const silenced = new Set(cobertura.falantes_silenciados);
  return (
    <div className="space-y-6 p-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Sociedade civil: fala × matéria</h3>
          <label className="flex items-center gap-1.5 text-xs text-[#666666]"><input type="checkbox" checked={withChair} onChange={(event) => setWithChair(event.target.checked)} className="accent-orange-500"/>incluir a mesa</label>
        </div>
        <div className="mt-4 space-y-3">
          <Share label="Parte da fala" value={data.participacao_civil_palavras} color="bg-ink"/>
          <Share label="Parte das citações na matéria" value={data.citacao_civil_opinioes} color="bg-orange-500"/>
        </div>
        {data.deficit_civil != null && <p className="mt-3 text-sm text-[#333]">Déficit de <strong className="text-orange-600">{Math.round(data.deficit_civil * 100)} pontos</strong>: a sociedade civil fala mais do que aparece.</p>}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Quem falou e quem foi citado</h3>
        <ul className="space-y-2.5">
          {cobertura.falantes.map((falante) => (
            <li key={falante.nome}>
              <button type="button" onClick={() => onTurn(falante.turnos[0])} className="w-full text-left">
                <span className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium text-ink">{falante.nome} <span className="font-normal text-[#999]">· {falante.parlamentar ? "parlamentar" : "convidado(a)"}</span></span>
                  <span className={`shrink-0 font-semibold ${silenced.has(falante.nome) ? "text-orange-600" : "text-[#344b7f]"}`}>{silenced.has(falante.nome) ? "não citado" : "citado"}</span>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-paper"><span className={`block h-full rounded-full ${falante.parlamentar ? "bg-ink" : "bg-orange-400"}`} style={{ width: `${(falante.n_palavras / maxWords) * 100}%` }}/></span>
                <span className="mt-0.5 block text-[10px] text-[#999]">{falante.n_palavras} palavras em {falante.n_turnos} turno(s)</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {cobertura.citados_ausentes.length > 0 && (
        <p className="text-xs leading-5 text-[#666666]"><strong className="text-ink">Citados sem ter falado:</strong> {cobertura.citados_ausentes.join(", ")}.</p>
      )}
      <p className="text-[11px] leading-5 text-[#999]">A cobertura compara a sessão inteira com a matéria da Agência Câmara; não muda com a linha do tempo.</p>
    </div>
  );
}

function Share({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs"><span className="text-[#666666]">{label}</span><span className="font-semibold tabular-nums text-ink">{percent(value)}</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-paper"><div className={`h-full rounded-full ${color}`} style={{ width: `${(value ?? 0) * 100}%` }}/></div>
    </div>
  );
}

function Deliberation({ turn, onTurn }: { turn: number; onTurn: (turn: number) => void }) {
  const [open, setOpen] = useState<string>();
  const coded = turnos.filter((item) => item.turno_id <= turn && item.texto.split(/\s+/).length >= 50).length;
  return (
    <div className="space-y-4 p-5">
      <p className="text-xs leading-5 text-[#666666]">Discourse Quality Index (Steenbergen et al., 2003), aplicado turno a turno. Só a participação sai da estrutura da transcrição; as demais dimensões são julgadas por um modelo de linguagem, então <strong className="text-ink">o instrumento indica</strong>, não afirma.</p>
      <p className="text-xs text-[#666666]"><strong className="text-ink">{coded}</strong> de {dqiResumo.n_turnos_codificados} turnos codificados até aqui (turnos com menos de 50 palavras não são codificados).</p>
      {dimensoes.map((dimensao) => {
        const items = codigos.filter((codigo) => codigo.dimensao === dimensao.id && codigo.turno_id <= turn);
        const counts = dimensao.niveis.map((nivel) => items.filter((codigo) => codigo.rotulo === nivel).length);
        const total = Math.max(1, items.length);
        return (
          <section key={dimensao.id} className="rounded-xl border border-black/10 p-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">{dimensao.titulo}</h3>
              <Badge kind={dimensao.id === "participacao" ? "exata" : "julgada"}/>
            </div>
            <p className="mt-0.5 text-xs text-[#666666]">{dimensao.pergunta}</p>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-paper">
              {counts.map((count, index) => count > 0 && <span key={index} style={{ width: `${(count / total) * 100}%`, backgroundColor: levelColor(index, dimensao.niveis.length) }} title={`${rotuloLegivel(dimensao.niveis[index])}: ${count}`}/>)}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#666666]">
              {dimensao.niveis.map((nivel, index) => <li key={nivel} className="flex items-center gap-1"><i className="size-2 rounded-sm" style={{ backgroundColor: levelColor(index, dimensao.niveis.length) }}/>{rotuloLegivel(nivel)} {counts[index]}</li>)}
            </ul>
            {items.some((codigo) => codigo.trecho) && (
              <button type="button" onClick={() => setOpen(open === dimensao.id ? undefined : dimensao.id)} className="mt-2 text-[11px] font-semibold text-orange-600 hover:text-orange-700">
                {open === dimensao.id ? "fechar trechos" : `${items.filter((codigo) => codigo.trecho).length} trecho(s) citado(s)`}
              </button>
            )}
            {open === dimensao.id && (
              <ul className="mt-2 space-y-2">
                {items.filter((codigo) => codigo.trecho).map((codigo) => (
                  <li key={`${codigo.turno_id}-${codigo.trecho}`} className="border-l-2 pl-2.5 text-xs leading-5 text-[#333]" style={{ borderColor: levelColor(dimensao.niveis.indexOf(codigo.rotulo), dimensao.niveis.length) }}>
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

// Coral for the lowest level of a scale, blue for the highest.
function levelColor(index: number, count: number) {
  const palette = ["#ff4b3e", "#f2a08f", "#9aa6c4", "#344b7f"];
  if (count === 2) return [palette[0], palette[3]][index];
  if (count === 3) return [palette[0], "#c9c9c9", palette[3]][index];
  return palette[index] ?? "#999";
}

function OpinionDetail({ opinion, onClose, onTurn }: { opinion: Opiniao; onClose: () => void; onTurn: (turn: number) => void }) {
  const turn = turnos[opinion.turno_id - 1];
  const secao = secoes[opinion.tema];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-black/10 p-5">
        <div>
          <p className="text-xs font-semibold text-[#666666]">{opinion.falante}</p>
          <h3 className="mt-1 text-lg font-semibold leading-snug text-ink">{opinion.texto}</h3>
          {secao && <p className="mt-2 flex items-center gap-1.5 text-xs text-[#666666]"><i className="size-2 rounded-full" style={{ backgroundColor: temaCores[opinion.tema] }}/>{secao.titulo}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-8 shrink-0 place-items-center rounded-lg border border-black/10 text-[#666666] hover:text-ink"><X className="size-4"/></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#999]">Âncora <Badge kind="exata"/></p>
        <blockquote className="border-l-2 border-orange-500 pl-3 text-sm leading-6 text-[#333]">{turn.texto}</blockquote>
        <p className="mt-3 text-[11px] leading-5 text-[#999]">A âncora garante que a opinião aponta para uma fala real da pessoa certa (turno {turn.turno_id}). Não garante, sozinha, que a leitura seja fiel: a fidelidade é medida à parte.</p>
        <button type="button" onClick={() => { onTurn(opinion.turno_id); onClose(); }} className="mt-4 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600">Ver na transcrição</button>
      </div>
    </div>
  );
}
