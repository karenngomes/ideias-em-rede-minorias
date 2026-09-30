// Indicadores por audiência para comparar o grupo M (pautas de minorias) com o
// grupo C (as demais), a partir do pacote da Thalia. Tudo é descritivo.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getIndice } from "@/lib/thalia-data";

const DATA_DIR = process.env.THALIA_DATA_DIR ?? path.join(process.cwd(), "..", "dados", "conteudo", "dados");

export type Grupo = "M" | "C";
export type Papel = "convidado" | "parlamentar" | "preside";

export type AudienciaIndicadores = {
  id: number;
  grupo: Grupo;
  assunto: string;
  palavras: number;
  falas: number;
  respeitoPositivo: number | null;
  respeitoMedio: number | null;
  bemComumDiferenca: number | null;
  interesseDeGrupo: number | null;
  nivelJustificacao: number | null;
  respeitoNegativo: number | null;
  deficitCivil: number | null;
};

export type Comparacao = {
  audiencias: AudienciaIndicadores[];
  interrupcoes: Record<Grupo, Record<Papel, { interrompidas: number; total: number }>>;
};

type Cobertura = { falantes: Array<{ nome: string; parlamentar: boolean; mesa: boolean; n_palavras: number; n_turnos: number }>; proporcoes: { com_mesa: { deficit_civil: number | null } } };
type Dqi = { codigos: Array<{ dimensao: string; rotulo: string; nivel: number; falante: string }> };

const share = <T,>(items: T[], test: (item: T) => boolean) => (items.length ? items.filter(test).length / items.length : null);
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

async function readJson<T>(...parts: string[]) {
  return JSON.parse(await readFile(path.join(DATA_DIR, ...parts), "utf-8")) as T;
}

async function compute(): Promise<Comparacao> {
  const indice = await getIndice();
  const empty = () => ({ interrompidas: 0, total: 0 });
  const interrupcoes: Comparacao["interrupcoes"] = {
    M: { convidado: empty(), parlamentar: empty(), preside: empty() },
    C: { convidado: empty(), parlamentar: empty(), preside: empty() },
  };

  const audiencias = await Promise.all(Array.from(indice.values()).map(async (item) => {
    const folder = `audiencia_${String(item.sample_id).padStart(3, "0")}`;
    const [cobertura, dqi] = await Promise.all([readJson<Cobertura>("audiencias", folder, "cobertura.json"), readJson<Dqi>("audiencias", folder, "dqi.json")]);
    const papel = new Map<string, Papel>(cobertura.falantes.map((falante) => [falante.nome, falante.mesa ? "preside" : falante.parlamentar ? "parlamentar" : "convidado"]));

    dqi.codigos.forEach((codigo) => {
      if (codigo.dimensao !== "participacao") return;
      const quem = papel.get(codigo.falante);
      if (!quem) return;
      const alvo = interrupcoes[item.grupo][quem];
      alvo.total += 1;
      if (codigo.rotulo === "interrompido") alvo.interrompidas += 1;
    });

    // Respeito a grupos, a demandas e a contra-argumentos, juntos.
    const respeito = dqi.codigos.filter((codigo) => codigo.dimensao.startsWith("respeito_"));
    const conteudo = dqi.codigos.filter((codigo) => codigo.dimensao === "justificacao_conteudo");
    const nivel = dqi.codigos.filter((codigo) => codigo.dimensao === "justificacao_nivel").map((codigo) => codigo.nivel);
    return {
      id: item.sample_id,
      grupo: item.grupo,
      assunto: item.assunto,
      palavras: cobertura.falantes.reduce((total, falante) => total + falante.n_palavras, 0),
      falas: cobertura.falantes.reduce((total, falante) => total + falante.n_turnos, 0),
      respeitoPositivo: respeito.length ? respeito.filter((c) => c.rotulo === "explicito_positivo" || c.rotulo === "valoriza").length / respeito.length : null,
      respeitoNegativo: respeito.length ? respeito.filter((c) => c.rotulo === "negativo" || c.rotulo === "degradante").length / respeito.length : null,
      // Nível médio de respeito, de 0 (negativo) a 1 (explícito positivo / valoriza).
      respeitoMedio: mean(respeito.map((c) => c.nivel / (c.dimensao === "respeito_contra" ? 3 : 2))),
      bemComumDiferenca: share(conteudo, (c) => c.rotulo === "bem_comum_diferenca"),
      interesseDeGrupo: share(conteudo, (c) => c.rotulo === "interesse_de_grupo"),
      nivelJustificacao: mean(nivel),
      deficitCivil: cobertura.proporcoes.com_mesa.deficit_civil,
    };
  }));

  return { audiencias: audiencias.sort((a, b) => a.id - b.id), interrupcoes };
}

// O pacote não muda enquanto o servidor roda; calcula uma vez.
let cached: Promise<Comparacao> | null = null;
export function getComparacao() {
  cached ??= compute().catch((error) => { cached = null; throw error; });
  return cached;
}

export function mediana(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
