// Server-side client: server components call the FastAPI backend directly.
import type { ClassifiedRecord } from "@/lib/persuasion-api";

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
