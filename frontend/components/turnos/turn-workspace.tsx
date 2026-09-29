"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { ReadingPanel, type PanelTab } from "@/components/turnos/reading-panel";
import { TurnChart, type ChartMode } from "@/components/turnos/turn-chart";
import { opinioes, palavras, secoes, temaCores, turnos, type Opiniao } from "@/lib/thalia";

const SPEEDS = [0.5, 1, 2, 4];

export function TurnWorkspace() {
  const total = turnos.length;
  const [turn, setTurn] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<ChartMode>("posicoes");
  const [tab, setTab] = useState<PanelTab>("transcricao");
  const [selected, setSelected] = useState<Opiniao>();

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setTurn((current) => {
        if (current >= total) { setPlaying(false); return current; }
        return current + 1;
      });
    }, 1400 / speed);
    return () => clearInterval(timer);
  }, [playing, speed, total]);

  function goTo(next: number) {
    setPlaying(false);
    setTurn(Math.min(total, Math.max(1, next)));
  }

  const current = turnos[turn - 1];
  const words = turnos.map((item) => palavras(item.texto));
  const maxWords = Math.max(...words);
  const visibleOpinions = opinioes.filter((opiniao) => opiniao.turno_id <= turn).length;

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
              <span className="text-xs text-[#666666]">{visibleOpinions} de {opinioes.length} opiniões no gráfico</span>
            </div>

            <div className="flex flex-1 items-center px-2 py-3">
              <TurnChart mode={mode} turn={turn} selected={selected?.id} onSelect={(opinion) => { setSelected(opinion); setPlaying(false); }} onTurn={goTo}/>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-black/10 px-4 py-3 text-[11px] text-[#666666]">
              {mode === "posicoes" ? secoes.map((secao, index) => (
                <span key={secao.titulo} className="flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{ backgroundColor: temaCores[index] }}/>{secao.titulo}</span>
              )) : (
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

          <ReadingPanel tab={tab} onTab={setTab} turn={turn} onTurn={goTo} selected={selected} onClose={() => setSelected(undefined)}/>
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
              {words.map((count, index) => (
                <button key={index} type="button" tabIndex={-1} onClick={() => goTo(index + 1)} className={`flex-1 rounded-t-sm ${index + 1 <= turn ? "bg-orange-400" : "bg-[#dcdcdc]"} ${index + 1 === turn ? "bg-orange-600" : ""}`} style={{ height: `${Math.max(12, (count / maxWords) * 100)}%` }}/>
              ))}
            </div>
            <input type="range" min={1} max={total} value={turn} onChange={(event) => goTo(Number(event.target.value))} aria-label="Turno da audiência" className="timeline-range mt-2 w-full cursor-pointer" style={{ "--progress": `${((turn - 1) / Math.max(1, total - 1)) * 100}%` } as React.CSSProperties}/>
          </div>

          <div className="text-right text-xs">
            <p className="text-[#666666]">turno <strong className="text-ink">{turn}</strong> de {total}</p>
            <p className="font-semibold text-ink">{current.falante_norm}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Exact() {
  return <span className="rounded bg-[#344b7f]/10 px-1 text-[9px] font-bold uppercase text-[#344b7f]">exata</span>;
}
