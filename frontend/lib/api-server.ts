// Server-side client: server components call the FastAPI backend directly.
import type { ClassificationSummary, ClassifiedRecord, TranscriptionChunk } from "@/lib/persuasion-api";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

export type Envolvido = { nome: string; cargo: string; opinioes: string[] };

export type Audiencia = {
  id: number;
  materia: string;
  metadados: { assunto: string; envolvidos: Envolvido[] };
  chunk_count?: number;
  classified_chunk_count?: number;
};

export type Page<T> = { page: number; page_size: number; total: number; items: T[] };

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`API ${response.status}: ${path}`);
  return response.json() as Promise<T>;
}

export function getAudiencias(page: number, pageSize: number) {
  return request<Page<Audiencia>>(`/lds?page=${page}&page_size=${pageSize}`);
}

export function getAudiencia(id: number) {
  return request<Audiencia>(`/lds/${id}`);
}

export async function getChunkCount(id: number) {
  const page = await request<Page<unknown>>(`/lds/${id}/chunks?page=1&page_size=1`);
  return page.total;
}

export function getClassifiedRecords() {
  return request<{ items: ClassifiedRecord[] }>("/persuasion-classified-records");
}

export function extractDate(materia: string) {
  return materia.match(/\b\d{2}\/\d{2}\/\d{4}\b/)?.[0];
}

export function firstLine(value: string) {
  return value.split("\n").find((line) => line.trim())?.trim() ?? "";
}

export type Health = { lds_records: number; transcript_chunks: number };

export function getHealth() {
  return request<Health>("/health");
}

export async function getSummary(jobId: string) {
  return request<ClassificationSummary>(`/persuasion-classifications/${jobId}/summary`);
}

// A short window of a real speech around one reliable persuasion evidence.
export async function getHighlightedExcerpt(recordId: number, jobId: string, parliamentarians: string[]) {
  const page = await request<{ items: TranscriptionChunk[] }>(`/lds/${recordId}/chunks?page=1&page_size=60&classification_job_id=${jobId}`);
  for (const chunk of page.items) {
    if (parliamentarians.includes(chunk.speaker_name)) continue;
    const hit = chunk.selected_classification?.superclass_classifications?.find(
      (item) => item.evidence_reliable !== false && item.superclass !== "justificativa" && item.span_offsets[0]?.start != null,
    );
    if (!hit) continue;
    const start = hit.span_offsets[0].start as number;
    const end = hit.span_offsets[0].end as number;
    if (end - start > 220) continue;
    const before = chunk.text.slice(Math.max(0, start - 140), start);
    const after = chunk.text.slice(end, end + 120);
    return {
      speaker: chunk.speaker_name,
      superclass: hit.superclass,
      before: (start > 140 ? "…" : "") + before.replace(/^\S*\s/, ""),
      highlight: chunk.text.slice(start, end),
      after: after.replace(/\s\S*$/, "") + "…",
    };
  }
  return null;
}

export type PersuasionAnnotation = { speaker: string; superclass: string; trecho: string; explicacao: string };

// Todas as anotações de persuasão com evidência literal da execução mais recente da audiência.
export async function getPersuasionAnnotations(recordId: number) {
  const records = await getClassifiedRecords().catch(() => ({ items: [] as ClassifiedRecord[] }));
  const run = records.items.find((record) => record.id === recordId)?.runs[0];
  if (!run) return null;
  const annotations: PersuasionAnnotation[] = [];
  for (let page = 1; ; page += 1) {
    const chunks = await request<Page<TranscriptionChunk>>(`/lds/${recordId}/chunks?page=${page}&page_size=200&classification_job_id=${run.job_id}`);
    chunks.items.forEach((chunk) => chunk.selected_classification?.superclass_classifications?.forEach((item) => {
      if (item.evidence_reliable === false || !item.text_spans[0]) return;
      annotations.push({ speaker: chunk.speaker_name, superclass: item.superclass, trecho: item.text_spans[0], explicacao: item.explanation });
    }));
    if (page * chunks.page_size >= chunks.total) break;
  }
  return { tag: run.experiments_tag, annotations };
}
