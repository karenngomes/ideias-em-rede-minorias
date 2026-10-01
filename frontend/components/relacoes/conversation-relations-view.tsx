"use client";

import { useEffect, useMemo, useState } from "react";
import type { ConversationRelation, ConversationRelationRun, ConversationRelationType, RelationChunk } from "@/lib/relations-api";

type InferenceApproach = "rag_pairwise" | "protocol" | "protocol_rag";

const relationNames: Record<ConversationRelationType, string> = {
  passar_palavra: "Dar a palavra", questionar: "Questionou", responder: "Respondeu",
  complementar: "Complementou", concordar: "Concordou", discordar: "Discordou",
  mudar_assunto: "Mudou o assunto", retomada: "Retomou", retomar: "Retomou",
  referencia: "Referenciou", resposta_tardia: "Resposta tardia", correcao: "Corrigiu",
  citacao: "Citou", sem_relacao: "Sem relação", concordar_parcialmente: "Concordou parcialmente",
  discordar_parcialmente: "Discordou parcialmente", apoiar: "Apoiou", contestar: "Contestou",
  elaborar: "Elaborou", justificar: "Justificou", exemplificar: "Exemplificou",
  fornecer_evidencia: "Forneceu evidência", desafiar: "Desafiou", esclarecer: "Esclareceu",
  reformular: "Reformulou", sintetizar: "Sintetizou", propor: "Propôs",
  aceitar_proposta: "Aceitou proposta", rejeitar_proposta: "Rejeitou proposta",
  modificar_proposta: "Modificou proposta", comprometer_se: "Comprometeu-se",
  solicitar: "Solicitou", organizar_debate: "Organizou o debate",
};

// Famílias de relação com as cores da identidade (validadas para daltonismo e contraste).
// O nome de cada relação vai escrito na seta, então a cor só agrupa tipos parecidos.
const CONDUCAO = { color: "#666666" };
const CONCORDANCIA = { color: "#3d63d9" };
const DISCORDANCIA = { color: "#ff4b3e" };
const DIALOGO = { color: "#8a3d50" };
const ELABORACAO = { color: "#e0a01b" };
const RETOMADA = { color: "#2f8f6b" };

const relationStyles: Record<ConversationRelationType, { color: string; dash?: string }> = {
  passar_palavra: CONDUCAO, organizar_debate: { ...CONDUCAO, dash: "5 4" }, solicitar: { ...CONDUCAO, dash: "5 4" },
  mudar_assunto: { ...CONDUCAO, dash: "5 4" }, sem_relacao: { color: "#a1a1aa", dash: "4 5" },
  concordar: CONCORDANCIA, concordar_parcialmente: CONCORDANCIA, apoiar: CONCORDANCIA, aceitar_proposta: CONCORDANCIA, comprometer_se: CONCORDANCIA,
  discordar: DISCORDANCIA, discordar_parcialmente: DISCORDANCIA, contestar: DISCORDANCIA, desafiar: DISCORDANCIA, rejeitar_proposta: DISCORDANCIA, correcao: DISCORDANCIA,
  questionar: DIALOGO, responder: DIALOGO, resposta_tardia: DIALOGO, esclarecer: DIALOGO,
  complementar: ELABORACAO, elaborar: ELABORACAO, justificar: ELABORACAO, exemplificar: ELABORACAO, fornecer_evidencia: ELABORACAO,
  reformular: ELABORACAO, sintetizar: ELABORACAO, propor: ELABORACAO, modificar_proposta: ELABORACAO,
  retomada: RETOMADA, retomar: RETOMADA, referencia: RETOMADA, citacao: RETOMADA,
};

const participantColors = ["#1c2127"];

function relationKey(relation: ConversationRelation, index: number) {
  return `${relation.scope}:${relation.source_chunk_id}:${relation.target_chunk_id}:${relation.type}:${index}`;
}
function shortName(name: string) { const words = name.trim().split(/\s+/); return words.length > 2 ? `${words[0]} ${words.at(-1)}` : name; }
function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function PlayIcon({ paused = false }: { paused?: boolean }) { return paused ? <span className="sequencePauseIcon"><i /><i /></span> : <span className="sequencePlayIcon" />; }

const approachLabels: Record<InferenceApproach, string> = {
  rag_pairwise: "RAG por pares",
  protocol: "Protocolo completo",
  protocol_rag: "Protocolo completo + embeddings",
};

function approachOptions(data: ConversationRelationRun) {
  const generated = new Set((data.available ?? []).map((item) => item.approach));
  return (Object.keys(approachLabels) as InferenceApproach[]).map((key) => (
    <option key={key} value={key}>{approachLabels[key]}{generated.has(key) ? " (gerado)" : ""}</option>
  ));
}

// Mostra o resultado da abordagem escolhida: troca sem custo quando já foi gerado,
// e oferece gerar quando ainda não existe.
export function ConversationRelationsView({ data: initial }: { data: ConversationRelationRun }) {
  const [data, setData] = useState(initial);
  const [approach, setApproach] = useState<InferenceApproach>(initial.approach ?? "rag_pairwise");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  async function selectApproach(next: InferenceApproach) {
    setApproach(next); setGenerationError(null); setIsLoading(true);
    try {
      const response = await fetch(`/api/audiencias/${data.record_id}/relations?approach=${next}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Falha ao carregar relações (${response.status}).`);
      setData(await response.json() as ConversationRelationRun);
    } catch (error) { setGenerationError(error instanceof Error ? error.message : "Não foi possível carregar as relações."); }
    finally { setIsLoading(false); }
  }

  async function generate() {
    setIsGenerating(true); setGenerationError(null);
    try {
      const response = await fetch(`/api/audiencias/${data.record_id}/relations?approach=${approach}`, { method: "POST" });
      if (!response.ok) { const payload = await response.json().catch(() => null) as { detail?: string } | null; throw new Error(payload?.detail ?? `Falha ao gerar relações (${response.status}).`); }
      setData(await response.json() as ConversationRelationRun);
    } catch (error) { setGenerationError(error instanceof Error ? error.message : "Não foi possível gerar as relações."); }
    finally { setIsGenerating(false); }
  }

  return <RelationsRun key={`${data.approach ?? approach}-${data.run_id ?? "vazio"}`} data={data} approach={approach} onApproach={selectApproach} onGenerate={generate} isGenerating={isGenerating} isLoading={isLoading} generationError={generationError} />;
}

function RelationsRun({ data, approach, onApproach, onGenerate, isGenerating, isLoading, generationError }: {
  data: ConversationRelationRun;
  approach: InferenceApproach;
  onApproach: (approach: InferenceApproach) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  isLoading: boolean;
  generationError: string | null;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const usableRelations = useMemo(() => data.relations.filter((relation) => relation.source_chunk_id !== null && relation.type !== "sem_relacao"), [data.relations]);
  const [currentStep, setCurrentStep] = useState(usableRelations.length);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(usableRelations.length ? 0 : null);

  useEffect(() => {
    if (!isPlaying || usableRelations.length === 0) return;
    const timer = window.setInterval(() => setCurrentStep((step) => {
      if (step >= usableRelations.length) { setIsPlaying(false); return step; }
      return step + 1;
    }), 850);
    return () => window.clearInterval(timer);
  }, [isPlaying, usableRelations.length]);

  const chunksById = useMemo(() => new Map(data.chunks.map((chunk) => [chunk.id, chunk])), [data.chunks]);
  const participants = useMemo(() => {
    const names: string[] = [];
    for (const chunk of data.chunks) { const name = chunk.speaker_id?.trim() || "Orador não identificado"; if (!names.includes(name)) names.push(name); }
    return names.map((name, index) => ({ id: name, name, x: names.length === 1 ? 540 : 120 + index * (840 / (names.length - 1)), color: /presidente/i.test(name) ? "#ff4b3e" : participantColors[index % participantColors.length] }));
  }, [data.chunks]);
  const selected = selectedIndex === null ? null : usableRelations[selectedIndex] ?? null;
  const selectedSource = selected?.source_chunk_id ? chunksById.get(selected.source_chunk_id) : undefined;
  const selectedTarget = selected ? chunksById.get(selected.target_chunk_id) : undefined;
  const visibleRelations = usableRelations.slice(0, currentStep);
  const presentTypes = [...new Set(usableRelations.map((relation) => relation.type))];


  if (data.status === "not_started") return <section className="relationsSection"><div className="relationEmptyState"><span>RELAÇÕES ENTRE FALAS</span><h2>{isLoading ? "Carregando…" : data.available?.length ? `Ainda não gerada com “${approachLabels[approach]}”` : "Esta audiência ainda não foi analisada"}</h2><p>{data.available?.length ? `Já existe resultado com ${data.available.map((item) => approachLabels[item.approach]).join(", ")}: escolha no seletor para ver sem gerar de novo, ou gere com esta abordagem.` : "Escolha a abordagem e gere as interações entre os participantes."}</p><label className="relationApproachField">Abordagem<select value={approach} onChange={(event) => onApproach(event.target.value as InferenceApproach)}>{approachOptions(data)}</select></label><button className="relationGenerateButton" type="button" onClick={onGenerate} disabled={isGenerating}>{isGenerating ? "Analisando falas…" : "Gerar relações"}</button>{generationError && <p className="relationGenerationError" role="alert">{generationError}</p>}</div></section>;

  return <section className="deputyInteractions" aria-label="Interações entre deputados">
    <header className="sequenceHeading"><div><p>SEQUÊNCIA DA AUDIÊNCIA</p><h2>Interações entre deputados</h2><span>O tempo avança de cima para baixo e cada seta mostra quem iniciou e quem recebeu a interação.</span></div><div className="relationRunControls"><label>Abordagem<select value={approach} onChange={(event) => onApproach(event.target.value as InferenceApproach)}>{approachOptions(data)}</select></label>
    {/* <button className="relationRerunButton" type="button" onClick={onGenerate} disabled={isGenerating}>
      {isGenerating ? "Analisando…" : "Gerar de novo"}</button> */}
      </div></header>
    {generationError && <p className="relationGenerationError" role="alert">{generationError}</p>}
    <div className="sequenceLayout"><div className="sequenceCard">
      <div className="sequencePlayer"><button type="button" aria-label="Voltar ao início" onClick={() => { setIsPlaying(false); setCurrentStep(0); }} className="sequenceReset">↤</button><button type="button" aria-label={isPlaying ? "Pausar" : "Reproduzir"} onClick={() => { if (currentStep >= usableRelations.length) setCurrentStep(0); setIsPlaying((value) => !value); }} className="sequencePlay"><PlayIcon paused={isPlaying} /></button><div><div className="sequencePlayerLabel"><span>Linha do tempo</span><strong>{currentStep} / {usableRelations.length}</strong></div><input type="range" min="0" max={Math.max(1, usableRelations.length)} value={currentStep} onChange={(event) => { setIsPlaying(false); setCurrentStep(Number(event.target.value)); }} style={{ "--progress": `${usableRelations.length ? currentStep / usableRelations.length * 100 : 0}%` } as React.CSSProperties} /></div></div>
      <div className="sequenceLegend">{presentTypes.map((type) => <span key={type}><i style={{ backgroundColor: relationStyles[type].color }} />{relationNames[type]}</span>)}</div>
      <InteractionSequence participants={participants} relations={usableRelations} currentStep={currentStep} chunksById={chunksById} onSelect={setSelectedIndex} selectedIndex={selectedIndex} />
      <div className="sequenceFooter">Participantes identificados nas falas · Ordem de cima para baixo</div>
    </div><aside className="sequenceAside"><div className="sequenceStats"><p>ATÉ A RELAÇÃO {currentStep}</p><div><Stat value={visibleRelations.length} label="Interações" /><Stat value={participants.length} label="Participantes" /><Stat value={visibleRelations.filter((item) => item.type === "concordar" || item.type === "concordar_parcialmente").length} label="Concordâncias" /><Stat value={visibleRelations.filter((item) => item.type === "discordar" || item.type === "discordar_parcialmente").length} label="Discordâncias" /></div></div><div className="sequenceHelp"><p>COMO INTERPRETAR</p><h3>Direção das falas</h3><span>A seta parte da fala anterior ou referenciada e aponta para a fala que reage a ela. Clique em uma seta para ver a explicação.</span></div></aside></div>
    {selected && <RelationExplanation relation={selected} source={selectedSource} target={selectedTarget} />}
    <div className="relationRunMeta"><span>Abordagem: {data.approach === "protocol" ? "Protocolo completo" : data.approach === "protocol_rag" ? "Protocolo + embeddings" : "RAG por pares"}</span><span>Modelo: {data.model}</span><span>{data.created_at ? new Date(data.created_at).toLocaleString("pt-BR") : ""}</span></div>
    {data.audit?.length > 0 && <RelationAudit entries={data.audit} chunksById={chunksById} />}
  </section>;
}

function InteractionSequence({ participants, relations, currentStep, chunksById, onSelect, selectedIndex }: { participants: Array<{ id: string; name: string; x: number; color: string }>; relations: ConversationRelation[]; currentStep: number; chunksById: Map<string, RelationChunk>; onSelect: (index: number) => void; selectedIndex: number | null; }) {
  const [hovered, setHovered] = useState<{ index: number; x: number; y: number } | null>(null);
  const actorMap = new Map(participants.map((actor) => [actor.name, actor]));
  const height = Math.max(650, 170 + relations.length * 48); const yForIndex = (index: number) => 150 + index * 48;
  return <div className="interactionSequence"><svg viewBox={`0 0 1080 ${height}`} aria-label="Diagrama temporal das interações entre os participantes">
    <defs>{Object.entries(relationStyles).map(([type, style]) => <marker key={type} id={`sequence-arrow-${type}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={style.color} /></marker>)}</defs>
    <text x="22" y="116" fill="#a1a1aa" fontSize="10" fontWeight="700" letterSpacing="1">ORDEM</text>
    {participants.map((actor) => <g key={actor.id}><circle cx={actor.x} cy="48" r="25" fill={actor.color} stroke="white" strokeWidth="4" className="sequenceActorCircle" /><text x={actor.x} y="52" textAnchor="middle" fill="white" fontSize="10" fontWeight="800">{initials(actor.name)}</text><text x={actor.x} y="88" textAnchor="middle" fill="#1c2127" fontSize="12" fontWeight="700">{shortName(actor.name)}</text><text x={actor.x} y="103" textAnchor="middle" fill="#999999" fontSize="10">Participante</text><line x1={actor.x} x2={actor.x} y1="116" y2={height - 24} stroke="#d4d4d8" strokeWidth="1.5" strokeDasharray="5 7" /></g>)}
    {relations.map((relation, index) => { const sourceChunk = relation.source_chunk_id ? chunksById.get(relation.source_chunk_id) : undefined; const targetChunk = chunksById.get(relation.target_chunk_id); const source = sourceChunk ? actorMap.get(sourceChunk.speaker_id?.trim() || "Orador não identificado") : undefined; const target = targetChunk ? actorMap.get(targetChunk.speaker_id?.trim() || "Orador não identificado") : undefined; if (!source || !target) return null; const visible = index < currentStep; const style = relationStyles[relation.type]; const y = yForIndex(index); const sameActor = source.id === target.id; const direction = target.x >= source.x ? 1 : -1; const startX = source.x + direction * 13; const endX = target.x - direction * 16; const midX = sameActor ? source.x + 67 : (startX + endX) / 2; const label = relationNames[relation.type]; const labelWidth = Math.max(88, label.length * 6.4 + 20); const path = sameActor ? `M ${source.x + 12} ${y} C ${source.x + 94} ${y - 30}, ${source.x + 94} ${y + 30}, ${source.x + 12} ${y + 2}` : `M ${startX} ${y} L ${endX} ${y}`; return <g key={relationKey(relation, index)} opacity={visible ? 1 : 0} pointerEvents={visible ? "auto" : "none"} className={`sequenceEvent${selectedIndex === index ? " selected" : ""}`} onClick={() => onSelect(index)} onMouseMove={(event) => setHovered({ index, x: Math.max(12, Math.min(event.clientX + 14, window.innerWidth - 346)), y: event.clientY > window.innerHeight - 180 ? event.clientY - 140 : event.clientY + 14 })} onMouseLeave={() => setHovered(null)}><rect x={target.x - 6} y={y - 12} width="12" height="24" rx="4" fill={target.color} stroke="white" strokeWidth="2" /><path d={path} fill="none" stroke={style.color} strokeWidth={selectedIndex === index ? 4 : 2} strokeDasharray={style.dash} markerEnd={`url(#sequence-arrow-${relation.type})`} /><rect x={midX - labelWidth / 2} y={y - 21} width={labelWidth} height="18" rx="5" fill="white" /><text x={midX} y={y - 8} textAnchor="middle" fill="#1c2127" fontSize="11" fontWeight="700">{label}</text><text x="64" y={y + 4} textAnchor="end" fill="#71717a" fontSize="10" fontFamily="monospace">{String(index + 1).padStart(2, "0")}</text></g>; })}
    <line x1="68" x2="68" y1="148" y2={relations.length ? yForIndex(Math.max(0, currentStep - 1)) : 148} stroke="#ff4b3e" strokeWidth="2" /><circle cx="68" cy={relations.length ? yForIndex(Math.max(0, currentStep - 1)) : 148} r="4" fill="#ff4b3e" /><text x="78" y={(relations.length ? yForIndex(Math.max(0, currentStep - 1)) : 148) + 4} fill="#ec3226" fontSize="10" fontWeight="700">AGORA</text>
  </svg>{hovered && <div className="sequenceHoverExplanation" style={{ left: hovered.x, top: hovered.y }} role="tooltip"><header><i style={{ backgroundColor: relationStyles[relations[hovered.index].type].color }} /><strong>{relationNames[relations[hovered.index].type]}</strong><span>{Math.round(relations[hovered.index].confidence * 100)}%</span></header><p>{relations[hovered.index].reason}</p></div>}</div>;
}

function Stat({ value, label }: { value: number; label: string }) { return <div><strong>{value}</strong><span>{label}</span></div>; }
function RelationExplanation({ relation, source, target }: { relation: ConversationRelation; source?: RelationChunk; target?: RelationChunk }) { return <div className="sequenceExplanation"><header><div><span style={{ color: "#ec3226" }}>{relation.scope === "direct" ? "RELAÇÃO DIRETA" : "RELAÇÃO INDIRETA"}</span><h3>{relationNames[relation.type]}</h3></div><strong>{Math.round(relation.confidence * 100)}% de confiança</strong></header><p>{relation.reason}</p><div>{[source, target].map((chunk, index) => chunk ? <article key={chunk.id}><span>{index === 0 ? "FALA ANTERIOR OU REFERENCIADA" : "FALA QUE REAGE"}</span><strong>#{chunk.chunk_index + 1} · {chunk.speaker_id ?? "Orador não identificado"}</strong><p>{chunk.text}</p></article> : null)}</div></div>; }

function RelationAudit({ entries, chunksById }: { entries: ConversationRelationRun["audit"]; chunksById: Map<string, RelationChunk> }) {
  return <section className="relationAudit"><header><p>AUDITORIA DA INFERÊNCIA</p><h2>RAG, prompts e respostas do modelo</h2><span>{entries.length} chamadas registradas integralmente para reprodução e revisão.</span></header><div className="relationAuditCalls">{entries.map((entry, index) => <details key={`${entry.target_chunk_id}-${index}`}><summary><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{entry.target_chunk_id}</strong><small>{chunksById.get(entry.target_chunk_id)?.speaker_id ?? "Orador não identificado"} · {entry.retrieved_chunks.length} chunks recuperados</small></div><em>Ver auditoria</em></summary><div className="relationAuditBody"><section><h3>Chunks recuperados pelo RAG</h3>{entry.retrieved_chunks.map((chunk) => <article key={chunk.chunk_id}><div><strong>{chunk.chunk_id}</strong><span>similaridade {(chunk.similarity * 100).toFixed(1)}%</span></div><p>{chunk.text}</p></article>)}</section><section><h3>Prompt de entrada</h3>{entry.prompt.map((message, messageIndex) => <article className="auditPrompt" key={`${message.role}-${messageIndex}`}><strong>{message.role}</strong><pre>{message.content}</pre></article>)}</section><section><h3>Resposta original da LLM</h3><pre className="auditResponse">{entry.raw_response}</pre></section><section><h3>Resposta estruturada</h3><pre className="auditResponse">{JSON.stringify(entry.parsed_response, null, 2)}</pre></section></div></details>)}</div></section>;
}
