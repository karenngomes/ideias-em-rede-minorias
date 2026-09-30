"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { ReadingPanel, type PanelTab } from "@/components/turnos/reading-panel";
import { TurnChart, type ChartMode } from "@/components/turnos/turn-chart";
import { derive, palavras, temaCor, type AudienciaBundle, type Opiniao } from "@/lib/thalia";

const SPEEDS = [0.5, 1, 2, 4];
const MAX_BARS = 160;

export function TurnWorkspace({ bundle }: { bundle: AudienciaBundle }) {
  const data = useMemo(() => derive(bundle), [bundle]);
  const total = data.turnos.length;
  const [turn, setTurn] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<ChartMode>("posicoes");
  const [showThemes, setShowThemes] = useState(false);
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex min-w-0 flex-col rounded-2xl border border-black/10 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
              <div className="flex flex-wrap rounded-lg bg-paper p-1 text-xs font-semibold">
                {([["posicoes", "Mapa de posições · opiniões"], ["interacao", "Rede de interação · pessoas"]] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setMode(id)} className={`rounded-md px-3 py-1.5 transition ${mode === id ? "bg-white text-ink shadow-sm" : "text-[#666666] hover:text-ink"}`}>{label}</button>
                ))}
              </div>
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
                  <span className="flex basis-full items-center gap-1.5"><i className="w-4 border-t-2 border-dashed border-[#999]"/>linha tracejada: liga opiniões que tratam do mesmo assunto, detectadas automaticamente pela semelhança entre os textos <Judged/></span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-[#c9c9c9]"/>fala após <Exact/></span>
                  <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-orange-500"/>concede a palavra <Exact/></span>
                  <span className="flex items-center gap-1.5"><b className="text-orange-500">✕</b>interrompido(a) <Exact/></span>
                </>
              )}
              <span className="ml-auto flex items-center gap-3">
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-ink"/>parlamentar</span>
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-orange-500"/>convidado(a)</span>
              </span>
            </div>
          </div>

          <ReadingPanel data={data} tab={tab} onTab={setTab} turn={turn} onTurn={goTo} selected={selected} onClose={() => setSelected(undefined)}/>
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
      </div>
    </section>
  );
}

function Judged() {
  return <span className="rounded bg-orange-50 px-1 text-[9px] font-bold uppercase text-orange-700">automática</span>;
}

function Exact() {
  return <span className="rounded bg-[#344b7f]/10 px-1 text-[9px] font-bold uppercase text-[#344b7f]">exata</span>;
}
