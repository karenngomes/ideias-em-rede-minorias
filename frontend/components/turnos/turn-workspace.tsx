"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { ReadingPanel, type PanelTab } from "@/components/turnos/reading-panel";
import { ConversationRelationsView } from "@/components/relacoes/conversation-relations-view";
import { TurnChart, type ChartMode } from "@/components/turnos/turn-chart";
import type { ConversationRelationRun } from "@/lib/relations-api";
import { superclassColors, superclassNames } from "@/lib/persuasion";
import type { AuditExecution } from "@/lib/api-server";
import { derive, palavras, temaCor, type AudienciaBundle, type Opiniao, type PersuasaoTurno } from "@/lib/thalia";

const SPEEDS = [0.5, 1, 2, 4];
const MAX_BARS = 160;

export function TurnWorkspace({ bundle, persuasao, loadAudit, relations }: {
  bundle: AudienciaBundle;
  persuasao: { tag: string; items: PersuasaoTurno[]; unmatched: number } | null;
  loadAudit?: (chunkIndexes: number[]) => Promise<AuditExecution[]>;
  relations?: ConversationRelationRun | null;
}) {
  const data = useMemo(() => derive(bundle), [bundle]);
  const total = data.turnos.length;
  const [turn, setTurn] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<ChartMode | "relacoes">("posicoes");
  const [showThemes, setShowThemes] = useState(false);
  const [persuasionMode, setPersuasionMode] = useState(false);
  const [tab, setTab] = useState<PanelTab>("transcricao");
  const [selected, setSelected] = useState<Opiniao>();

  useEffect(() => {
    if (!playing) return;
    // Audiências longas avançam mais turnos por passo, para durarem no máximo alguns minutos.
    const step = Math.max(1, Math.round(total / 200));
    const timer = setInterval(() => {
      setTurn((current) => {
        if (current >= total) { setPlaying(false); return current; }
        return Math.min(total, current + step);
      });
    }, 1200 / speed);
    return () => clearInterval(timer);
  }, [playing, speed, total]);

  function goTo(next: number) {
    setPlaying(false);
    setTurn(Math.min(total, Math.max(1, next)));
  }

  // Histograma do tamanho das falas, agrupado quando há turnos demais para uma barra cada.
  const bars = useMemo(() => {
    const words = data.turnos.map((item) => palavras(item.texto));
    const size = Math.max(1, Math.ceil(words.length / MAX_BARS));
    const grouped = [];
    for (let index = 0; index < words.length; index += size) {
      grouped.push({ first: index + 1, last: Math.min(words.length, index + size), words: words.slice(index, index + size).reduce((a, b) => a + b, 0) });
    }
    const max = Math.max(1, ...grouped.map((bar) => bar.words));
    return grouped.map((bar) => ({ ...bar, height: Math.max(12, (bar.words / max) * 100) }));
  }, [data.turnos]);

  const current = data.turnos[turn - 1];
  const visibleOpinions = data.opinioes.filter((opiniao) => opiniao.turno_id <= turn).length;
  const themes = data.secoes.map((secao, index) => ({ titulo: secao.titulo, index })).filter((item, index, list) => list.findIndex((other) => other.titulo === item.titulo) === index);

  return (
    <section className="px-5 py-8 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-600">A audiência, turno a turno</p>
          <h2 className="text-3xl font-semibold tracking-[-0.035em]">Quem disse o quê, e quando</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#666666]">Cada opinião entra no turno da fala que a sustenta. A linha do tempo filtra tudo ao mesmo tempo: o gráfico, a transcrição, o resumo e os indicadores de deliberação.</p>
        </div>

        {persuasao && (
          <div className="mb-4 rounded-2xl border border-black/10 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={persuasionMode} onChange={(event) => { setPersuasionMode(event.target.checked); if (event.target.checked) { setTab("transcricao"); setSelected(undefined); } }} className="size-4 accent-orange-500"/>
                Modo persuasão
              </label>
              <span className="text-xs text-[#666666]">{persuasionMode ? "Técnicas grifadas na transcrição. Passe o mouse para ler a justificativa do modelo." : "Grifa na transcrição as técnicas de persuasão encontradas pelo modelo."}</span>
            </div>
            {persuasionMode && <PersuasionBySpeaker data={data} items={persuasao.items} turn={turn}/>}
          </div>
        )}

        <div className="mb-3 flex w-fit max-w-full flex-wrap rounded-lg border border-black/10 bg-white p-1 text-xs font-semibold" role="tablist">
          {([["posicoes", "Mapa de posições · opiniões"], ["interacao", "Rede de interação · pessoas"], ["relacoes", "Interações entre deputados"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={`rounded-md px-3 py-1.5 transition ${mode === id ? "bg-ink text-white" : "text-[#666666] hover:text-ink"}`}>{label}</button>
          ))}
        </div>

        {mode === "relacoes" ? (
          <div>
            <p className="mb-4 max-w-3xl text-sm leading-6 text-[#666666]">Um modelo de linguagem, com apoio de embeddings, identifica como cada fala reage às anteriores (responde, questiona, concorda, discorda, retoma…), inclusive falas distantes. Usa os trechos da API, não os turnos das outras abas.</p>
            {relations
              ? <ConversationRelationsView data={relations}/>
              : <p className="rounded-2xl border border-black/10 bg-white p-8 text-center text-sm text-[#666666]">Não foi possível carregar as relações: verifique se a API está rodando.</p>}
          </div>
        ) : (
        <>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex min-w-0 flex-col rounded-2xl border border-black/10 bg-white">
            <div className="flex flex-wrap items-center justify-end gap-3 border-b border-black/10 px-4 py-3">
              <div className="flex items-center gap-4 text-xs text-[#666666]">
                {mode === "posicoes" && <label className="flex items-center gap-1.5"><input type="checkbox" checked={showThemes} onChange={(event) => setShowThemes(event.target.checked)} className="accent-orange-500"/>ligações por tema</label>}
                <span>{visibleOpinions} de {data.opinioes.length} opiniões no gráfico</span>
              </div>
            </div>

            <div className="flex flex-1 items-center px-2 py-3">
              <TurnChart data={data} mode={mode} showThemes={showThemes} turn={turn} selected={selected?.id} onSelect={(opinion) => { setSelected(opinion); setPlaying(false); }} onTurn={goTo}/>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-black/10 px-4 py-3 text-[11px] text-[#666666]">
              {mode === "posicoes" ? (
                <>
                  {themes.map((theme) => (
                    <span key={theme.index} className="flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{ backgroundColor: temaCor(theme.index) }}/>{theme.titulo}</span>
                  ))}
                  <span className="basis-full text-[#999]">Cor: tema do resumo, com as opiniões agrupadas por semelhança (SBERT + agrupamento hierárquico Ward). Alguns temas saem parecidos entre si e serão refeitos.</span>
                  <span className="flex basis-full items-center gap-1.5"><i className="w-4 border-t-2 border-dashed border-[#999]"/>linha tracejada: liga opiniões que tratam do mesmo assunto. Clique numa opinião para ver só as ligações dela.</span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-[#c9c9c9]"/>fala após</span>
                  <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-orange-500"/>concede a palavra</span>
                  <span className="flex items-center gap-1.5"><b className="text-orange-500">✕</b>interrompido(a)<span className="rounded bg-amber-100 px-1 text-[9px] font-bold uppercase text-amber-800">em revisão</span></span>
                </>
              )}
              <span className="ml-auto flex items-center gap-3">
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-ink"/>parlamentar</span>
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-orange-500"/>convidado(a)</span>
              </span>
            </div>
          </div>

          <ReadingPanel data={data} persuasao={persuasionMode ? persuasao?.items : undefined} loadAudit={loadAudit} tab={tab} onTab={setTab} turn={turn} onTurn={goTo} selected={selected} onClose={() => setSelected(undefined)}/>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-black/10 bg-white px-4 py-3">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => { if (turn >= total) setTurn(1); setPlaying((value) => !value); }} aria-label={playing ? "Pausar" : "Reproduzir"} className="grid size-10 place-items-center rounded-full bg-orange-500 text-white hover:bg-orange-600">
              {playing ? <Pause className="size-4 fill-current"/> : <Play className="ml-0.5 size-4 fill-current"/>}
            </button>
            <button type="button" onClick={() => goTo(1)} aria-label="Voltar ao início" className="grid size-9 place-items-center rounded-full text-[#666666] hover:bg-paper hover:text-ink"><RotateCcw className="size-4"/></button>
            <div className="ml-1 flex text-xs">
              {SPEEDS.map((value) => (
                <button key={value} type="button" onClick={() => setSpeed(value)} className={`rounded-md px-2 py-1 font-semibold ${speed === value ? "bg-paper text-ink" : "text-[#999] hover:text-ink"}`}>{value}×</button>
              ))}
            </div>
          </div>

          <div className="min-w-[220px] flex-1">
            <div className="flex h-7 items-end gap-px" aria-hidden>
              {bars.map((bar) => (
                <button key={bar.first} type="button" tabIndex={-1} onClick={() => goTo(bar.first)} className={`flex-1 rounded-t-sm ${turn >= bar.first && turn <= bar.last ? "bg-orange-600" : bar.first <= turn ? "bg-orange-400" : "bg-[#dcdcdc]"}`} style={{ height: `${bar.height}%` }}/>
              ))}
            </div>
            <input type="range" min={1} max={total} value={turn} onChange={(event) => goTo(Number(event.target.value))} aria-label="Turno da audiência" className="timeline-range mt-2 w-full cursor-pointer" style={{ "--progress": `${((turn - 1) / Math.max(1, total - 1)) * 100}%` } as React.CSSProperties}/>
          </div>

          <div className="text-right text-xs">
            <p className="text-[#666666]">turno <strong className="text-ink">{turn}</strong> de {total}</p>
            <p className="font-semibold text-ink">{current?.falante_norm}</p>
          </div>
        </div>
        </>
        )}
      </div>
    </section>
  );
}

// Parte das falas substantivas (50+ palavras, o corte do DQI) de cada grupo que usa cada técnica.
function PersuasionBySpeaker({ data, items, turn }: { data: ReturnType<typeof derive>; items: PersuasaoTurno[]; turn: number }) {
  const [withChair, setWithChair] = useState(false);
  const groups = useMemo(() => {
    const falas = data.turnos.filter((item) => item.turno_id <= turn && palavras(item.texto) >= 50 && (withChair || !data.mesa.has(item.falante_norm)));
    const byGroup = {
      parlamentar: falas.filter((item) => data.parlamentares.has(item.falante_norm)).map((item) => item.turno_id),
      convidado: falas.filter((item) => !data.parlamentares.has(item.falante_norm)).map((item) => item.turno_id),
    };
    const techniques = new Map<number, Set<string>>();
    items.forEach((item) => {
      if (item.turno_id > turn) return;
      techniques.set(item.turno_id, (techniques.get(item.turno_id) ?? new Set()).add(item.superclass));
    });
    const share = (ids: number[], key: string) => ({ count: ids.filter((id) => techniques.get(id)?.has(key)).length, total: ids.length });
    return { byGroup, share };
  }, [data, items, turn, withChair]);
  const { byGroup, share } = groups;

  return (
    <div className="mt-3 border-t border-black/10 pt-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#666666]">
        <span className="font-semibold text-ink">Falas com cada técnica, por tipo de falante</span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {data.mesa.size > 0 && <label className="flex items-center gap-1.5"><input type="checkbox" checked={withChair} onChange={(event) => setWithChair(event.target.checked)} className="accent-orange-500"/>incluir quem preside</label>}
          <span className="flex items-center gap-1.5"><i className="h-2 w-4 rounded-sm bg-ink"/>parlamentares ({byGroup.parlamentar.length} falas)</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-4 rounded-sm bg-orange-500"/>convidados ({byGroup.convidado.length} falas)</span>
        </span>
      </div>
      {!withChair && byGroup.parlamentar.length === 0 && data.mesa.size > 0 && (
        <p className="mb-3 rounded-lg bg-paper px-3 py-2 text-[11px] text-[#666666]">Até aqui, nenhum parlamentar além de quem preside fez fala com 50 palavras ou mais. Marque “incluir quem preside” para comparar com as falas da presidência.</p>
      )}
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(superclassNames).map(([key, name]) => (
          <div key={key}>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink"><i className="size-2.5 rounded-sm" style={{ backgroundColor: superclassColors[key] }}/>{name}</p>
            <ShareRow value={share(byGroup.parlamentar, key)} color="bg-ink"/>
            <ShareRow value={share(byGroup.convidado, key)} color="bg-orange-500"/>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-5 text-[#999]">Porcentagem das falas com 50 palavras ou mais de cada grupo, até o turno atual. Uma fala pode ter mais de uma técnica. {withChair ? "Quem preside conta como parlamentar." : "Quem preside fica de fora, porque suas falas são sobretudo de condução da sessão."} Classificação via LLM, em validação com anotadores humanos.</p>
    </div>
  );
}

function ShareRow({ value, color }: { value: { count: number; total: number }; color: string }) {
  const ratio = value.total ? value.count / value.total : 0;
  return (
    <div className="mb-1 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper"><div className={`h-full rounded-full ${color}`} style={{ width: `${ratio * 100}%` }}/></div>
      <span className="w-[118px] shrink-0 whitespace-nowrap text-right font-mono text-[11px] tabular-nums text-[#666666]">
        {value.total ? <>{Math.round(ratio * 100)}% <span className="text-[#aaa]">· {value.count} de {value.total}</span></> : "sem falas"}
      </span>
    </div>
  );
}


