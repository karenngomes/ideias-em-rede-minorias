// Leitura, no servidor, do pacote de dados da Thalia em ../dados/conteudo/dados.
// Veja dados/conteudo/README.md e CONTRATO.md para o formato de cada arquivo.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { AudienciaBundle } from "@/lib/thalia";

const DATA_DIR = process.env.THALIA_DATA_DIR ?? path.join(process.cwd(), "..", "dados", "conteudo", "dados");

export type IndiceItem = {
  sample_id: number;
  grupo: "M" | "C";
  tema: string;
  assunto: string;
  n_opinioes: number;
  falantes_com_lote_perdido: number;
  completa: boolean;
};

type Rotulos = { categorias: Record<string, { rotulo: string; ids: number[] }> };

async function readJson<T>(...parts: string[]): Promise<T> {
  return JSON.parse(await readFile(path.join(DATA_DIR, ...parts), "utf-8")) as T;
}

export const getIndice = cache(async () => {
  const items = await readJson<IndiceItem[]>("indice_audiencias.json");
  return new Map(items.map((item) => [item.sample_id, item]));
});

// Categorias do grupo M (pautas de minorias). Não são exclusivas.
export const getCategoriasMinoria = cache(async () => {
  const rotulos = await readJson<Rotulos>("rotulos", "rotulos_minorias.json");
  const byId = new Map<number, string[]>();
  Object.values(rotulos.categorias).forEach(({ rotulo, ids }) => ids.forEach((id) => byId.set(id, [...(byId.get(id) ?? []), rotulo])));
  return byId;
});

export async function getRotuloAudiencia(id: number) {
  const [indice, categorias] = await Promise.all([getIndice(), getCategoriasMinoria()]);
  const item = indice.get(id);
  return item ? { ...item, categorias: categorias.get(id) ?? [] } : undefined;
}

const ARQUIVOS = ["turnos", "opinioes", "dqi", "cobertura", "grafo", "resumo", "materia", "argumento_intra"] as const;

export async function getAudienciaBundle(id: number): Promise<AudienciaBundle | null> {
  const folder = `audiencia_${String(id).padStart(3, "0")}`;
  try {
    const values = await Promise.all(ARQUIVOS.map((nome) => readJson(`audiencias`, folder, `${nome}.json`).catch(() => null)));
    const bundle = Object.fromEntries(ARQUIVOS.map((nome, index) => [nome, values[index]])) as unknown as AudienciaBundle;
    return bundle.turnos ? bundle : null;
  } catch {
    return null;
  }
}

export async function getCoberturaResumo(id: number) {
  const folder = `audiencia_${String(id).padStart(3, "0")}`;
  try {
    const cobertura = await readJson<{ proporcoes: { com_mesa: { participacao_civil_palavras: number | null } } }>("audiencias", folder, "cobertura.json");
    return cobertura.proporcoes.com_mesa.participacao_civil_palavras;
  } catch {
    return null;
  }
}

// Quem falou na sessão, com o papel de cada pessoa (cobertura.json já agrega isso).
export async function getFalantes(id: number) {
  const folder = `audiencia_${String(id).padStart(3, "0")}`;
  try {
    const cobertura = await readJson<{ falantes: Array<{ nome: string; parlamentar: boolean; mesa: boolean; n_turnos: number }> }>("audiencias", folder, "cobertura.json");
    return cobertura.falantes;
  } catch {
    return null;
  }
}
