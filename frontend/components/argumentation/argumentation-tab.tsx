"use client";

import { useEffect, useMemo, useState } from "react";
import { ChunkErrorModal } from "@/components/argumentation/chunk-error-modal";
import { ChunkPromptsModal } from "@/components/argumentation/chunk-prompts-modal";
import { ClassificationHoverRow } from "@/components/argumentation/classification-hover-row";
import { StrategyHighlightedTranscript } from "@/components/argumentation/strategy-highlighted-transcript";
import { superclassColors, superclassNames } from "@/lib/persuasion";
import {
  getClassificationSummary,
  getClassifiedChunks,
  getClassifiedRecords,
  type ChunkPage,
  type ClassificationSummary,
  type ClassifiedRecord,
  type GroupSummary,
} from "@/lib/persuasion-api";

const PAGE_SIZE = 20;

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function ArgumentationTab({ recordId }: { recordId: number }) {
  const [record, setRecord] = useState<ClassifiedRecord | null>();
  const [jobId, setJobId] = useState<string>();
  const [summary, setSummary] = useState<ClassificationSummary>();
  const [chunks, setChunks] = useState<ChunkPage>();
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string>();

  useEffect(() => {
    getClassifiedRecords()
      .then(({ items }) => {
        const current = items.find((item) => item.id === recordId) ?? null;
        setRecord(current);
        setJobId(current?.runs[0]?.job_id);
      })
      .catch(() => setError("Não foi possível conectar à API. Verifique se o backend está rodando."));
  }, [recordId]);

  useEffect(() => {
    if (!jobId) return;
    setSummary(undefined);
    getClassificationSummary(jobId).then(setSummary).catch(() => setError("Falha ao carregar o resumo da classificação."));
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !recordId) return;
    setChunks(undefined);
    getClassifiedChunks(recordId, jobId, page, PAGE_SIZE).then(setChunks).catch(() => setError("Falha ao carregar as falas."));
  }, [recordId, jobId, page]);

  const parliamentarians = useMemo(() => new Set(summary?.parlamentares ?? []), [summary]);
  const totalPages = chunks ? Math.max(1, Math.ceil(chunks.total / PAGE_SIZE)) : 1;

  return (
    <section role="tabpanel" aria-label="Tipo de argumentação" className="bg-[#f8f7f3] px-5 py-8 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Mineração de argumentos</p>
            <h2 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Técnicas de persuasão</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">Cada parágrafo das falas é classificado por um modelo de linguagem em seis técnicas, que podem coexistir, ou em “nenhuma”. Os destaques mostram o trecho que o modelo usou como evidência.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {record && record.runs.length > 1 && (
              <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Execução
                <select value={jobId} onChange={(event) => { setJobId(event.target.value); setPage(1); }} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-zinc-900">
                  {record.runs.map((run) => <option value={run.job_id} key={run.job_id}>{run.experiments_tag} ({run.result_count})</option>)}
                </select>
              </label>
            )}
          </div>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          <span className="mt-0.5 size-2 shrink-0 rounded-full bg-amber-500"/>
          <p><strong>Classificação automática.</strong> As anotações foram produzidas por um modelo de linguagem e ainda estão em validação com anotadores humanos. Elas indicam o que o instrumento detectou, não um julgamento sobre quem falou.</p>
        </div>

        {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

        {record === null && (
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center">
            <p className="text-sm font-semibold text-zinc-900">Esta audiência ainda não teve a persuasão classificada.</p>
            <p className="mt-1 text-sm text-zinc-500">A classificação foi feita para as audiências do recorte de minorias. Ela pode ser rodada pela API em <code className="rounded bg-zinc-100 px-1">POST /persuasion-classifications</code>.</p>
          </div>
        )}

        {summary && <SummaryPanel summary={summary}/>}

        {record && <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_40px_rgba(24,24,27,0.04)]">
          <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-zinc-100 px-5 py-3 text-xs text-zinc-600">
            {Object.entries(superclassNames).map(([key, name]) => (
              <span key={key} className="flex items-center gap-2"><i className="size-3 rounded-sm" style={{ backgroundColor: superclassColors[key] }}/>{name}</span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80">
                  <th className="w-14 px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">#</th>
                  <th className="w-56 px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Falante</th>
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Fala transcrita</th>
                  <th className="w-60 px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Técnicas identificadas</th>
                </tr>
              </thead>
              <tbody>
                {!chunks && !error && <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-zinc-400">Carregando falas…</td></tr>}
                {chunks?.items.map((chunk) => {
                  const classification = chunk.selected_classification;
                  const isParliamentarian = parliamentarians.has(chunk.speaker_name);
                  const meta = [chunk.speaker_metadata.role, chunk.speaker_metadata.party, chunk.speaker_metadata.state].filter(Boolean).join(" · ");
                  return (
                    <ClassificationHoverRow key={chunk.chunk_index}>
                      <td className="border-b border-zinc-100 px-5 py-5 align-top font-mono text-xs tabular-nums text-zinc-400">{chunk.chunk_index + 1}</td>
                      <td className="border-b border-zinc-100 px-5 py-5 align-top">
                        <p className="text-sm font-semibold text-zinc-900">{chunk.speaker_name}</p>
                        {meta && <p className="mt-0.5 text-xs text-zinc-400">{meta}</p>}
                        <span className={`mt-2 inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold ${isParliamentarian ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{isParliamentarian ? "Parlamentar" : "Convidado(a)"}</span>
                      </td>
                      <td className="transcriptText border-b border-zinc-100 px-5 py-5 align-top text-sm leading-6 whitespace-pre-line text-zinc-700">
                        <StrategyHighlightedTranscript text={chunk.text} classification={classification}/>
                      </td>
                      <td className="border-b border-zinc-100 px-5 py-5 align-top">
                        <div className="flex flex-col items-stretch gap-1.5">
                          {chunk.selected_classification_error && <ChunkErrorModal chunkNumber={chunk.chunk_index + 1} error={chunk.selected_classification_error}/>}
                          {!classification && !chunk.selected_classification_error && <span className="text-xs italic text-zinc-400">Não analisado</span>}
                          {classification && !classification.superclass_classifications?.length && (
                            <span className="text-xs italic text-zinc-400" title={classification.no_classification_explanation ?? undefined}>Nenhuma técnica identificada</span>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {classification?.superclass_classifications?.map((item, index) => {
                              const unreliable = item.evidence_reliable === false;
                              const title = unreliable
                                ? `${item.explanation}\n\nAlerta: ${item.evidence_warnings?.join(" ") || "O trecho não foi encontrado integralmente no texto original."}`
                                : item.explanation;
                              return (
                                <span
                                  key={`${item.superclass}-${item.paragraph_index ?? index}-${index}`}
                                  className={`interactiveAnnotationTag inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-bold leading-none text-zinc-800 ${unreliable ? "border-amber-500" : "border-black/10"}`}
                                  style={{ backgroundColor: superclassColors[item.superclass] }}
                                  data-highlight-target={unreliable ? undefined : `super-${index}`}
                                  data-paragraph-target={item.paragraph_index}
                                  tabIndex={0}
                                  title={title}
                                >
                                  {superclassNames[item.superclass] ?? item.superclass}
                                  {unreliable && <span className="ml-1" aria-label="Evidência não literal">⚠</span>}
                                </span>
                              );
                            })}
                          </div>
                          <ChunkPromptsModal chunkNumber={chunk.chunk_index + 1} classification={classification} audit={chunk.selected_classification_audit}/>
                        </div>
                      </td>
                    </ClassificationHoverRow>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/60 px-5 py-3 text-xs text-zinc-500">
            <span>{chunks ? `${chunks.total} falas · página ${page} de ${totalPages}` : " "}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 disabled:opacity-40">Anterior</button>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 disabled:opacity-40">Próxima</button>
            </div>
          </div>
        </div>}
      </div>
    </section>
  );
}

function SummaryPanel({ summary }: { summary: ClassificationSummary }) {
  const { total, parlamentar, convidado } = summary.groups;
  return (
    <div className="mb-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="grid grid-cols-2 gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <SummaryStat value={total.chunks} label="Falas"/>
        <SummaryStat value={total.classified - total.none} label="Com alguma técnica"/>
        <SummaryStat value={total.none} label="Sem técnica"/>
        <SummaryStat value={total.failed} label="Falhas na análise"/>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">Falas com cada técnica, por tipo de falante</h3>
          <div className="flex gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5"><i className="h-2 w-4 rounded-sm bg-blue-500"/>Parlamentares ({parlamentar.classified})</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-4 rounded-sm bg-emerald-500"/>Convidados ({convidado.classified})</span>
          </div>
        </div>
        <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          {Object.entries(superclassNames).map(([key, name]) => (
            <div key={key}>
              <p className="mb-1 text-xs font-medium text-zinc-700">{name}</p>
              <ShareBar group={parlamentar} label={key} color="bg-blue-500"/>
              <ShareBar group={convidado} label={key} color="bg-emerald-500"/>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-5 text-zinc-400">Percentual sobre as falas analisadas de cada grupo. Uma fala pode ter mais de uma técnica. Parlamentar é quem tem partido informado em alguma fala da audiência.</p>
      </div>
    </div>
  );
}

function ShareBar({ group, label, color }: { group: GroupSummary; label: string; color: string }) {
  const value = percent(group.classes[label] ?? 0, group.classified);
  return (
    <div className="mb-1 flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }}/></div>
      <span className="w-9 text-right font-mono text-[11px] tabular-nums text-zinc-500">{value}%</span>
    </div>
  );
}

function SummaryStat({ value, label }: { value: number; label: string }) {
  return <div><p className="text-2xl font-semibold tabular-nums text-zinc-950">{value}</p><p className="mt-0.5 text-xs text-zinc-500">{label}</p></div>;
}
