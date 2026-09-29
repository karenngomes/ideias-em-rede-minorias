// Tipos e dados derivados do pacote de dados da Thalia (turnos, opiniões, DQI,
// cobertura, grafo e resumo). Por enquanto lê a audiência fictícia 901 de
// data/mocks, gerada por data/mocks/gerar_mock.py no formato documentado.
import coberturaJson from "@/data/mocks/901/cobertura.json";
import dqiJson from "@/data/mocks/901/dqi.json";
import grafoJson from "@/data/mocks/901/grafo.json";
import resumoJson from "@/data/mocks/901/resumo.json";
import turnosJson from "@/data/mocks/901/turnos.json";

export type Turno = {
  turno_id: number;
  falante_raw: string;
  falante_norm: string;
  papel: string | null;
  partido: string | null;
  texto: string;
  char_start: number;
  char_end: number;
};

export type CodigoDqi = {
  dimensao: string;
  nivel: number;
  rotulo: string;
  turno_id: number;
  falante: string;
  trecho: string;
  char_start: number | null;
  char_end: number | null;
  fonte: "modelo" | "exato";
};

export type Cobertura = {
  n_falantes: number;
  n_parlamentares: number;
  n_convidados: number;
  proporcoes: Record<"com_mesa" | "sem_mesa", {
    participacao_civil_palavras: number | null;
    citacao_civil_opinioes: number | null;
    deficit_civil: number | null;
  }>;
  citados_ausentes: string[];
  falantes_silenciados: string[];
  falantes: Array<{ nome: string; parlamentar: boolean; mesa: boolean; n_turnos: number; n_palavras: number; turnos: number[] }>;
};

export type No = { id: string; tipo: "participante" | "opiniao"; rotulo: string; dados: Record<string, unknown> };
export type Aresta = { origem: string; destino: string; tipo: "emitiu" | "fala_apos" | "concede_palavra" | "mesmo_tema"; peso: number; dados: { turno_id?: number } };

export type Posicao = { falante: string; texto: string; turno_id: number };
export type Secao = { titulo: string; sintese: string; participantes: string[]; deriva_de: string[]; posicoes: Posicao[] };

export type Opiniao = { id: string; texto: string; falante: string; turno_id: number; tema: number };

export const turnos = turnosJson as Turno[];
export const codigos = (dqiJson.codigos as CodigoDqi[]);
export const dqiResumo = { n_turnos: dqiJson.n_turnos, n_turnos_codificados: dqiJson.n_turnos_codificados };
export const cobertura = coberturaJson as Cobertura;
export const arestas = grafoJson.arestas as Aresta[];
export const secoes = resumoJson.secoes as Secao[];

const temaPorOpiniao = new Map<string, number>();
secoes.forEach((secao, indice) => secao.deriva_de.forEach((id) => temaPorOpiniao.set(id, indice)));

export const opinioes: Opiniao[] = (grafoJson.nos as No[])
  .filter((no) => no.tipo === "opiniao")
  .map((no) => ({
    id: no.id,
    texto: no.rotulo,
    falante: String(no.dados.falante),
    turno_id: Number(no.dados.turno_id),
    tema: temaPorOpiniao.get(no.id) ?? -1,
  }));

// Participantes na ordem em que falam pela primeira vez.
export const participantes = Array.from(new Set(turnos.map((turno) => turno.falante_norm)));

// Parlamentar é quem tem sufixo "- UF" no partido em alguma fala; vale para a pessoa.
export const parlamentares = new Set(turnos.filter((turno) => /- [A-Z]{2}$/.test(turno.partido ?? "")).map((turno) => turno.falante_norm));

export const temaCores = ["#ff4b3e", "#344b7f", "#e0a01b", "#2f8f6b", "#8a3d50", "#5b8fd6"];

export const dimensoes: Array<{ id: string; titulo: string; pergunta: string; niveis: string[] }> = [
  { id: "participacao", titulo: "Participação", pergunta: "A pessoa foi interrompida no meio da fala?", niveis: ["interrompido", "normal"] },
  { id: "justificacao_nivel", titulo: "Nível de justificação", pergunta: "As posições vêm acompanhadas de razões?", niveis: ["nenhuma", "inferior", "qualificada", "sofisticada"] },
  { id: "justificacao_conteudo", titulo: "Conteúdo da justificação", pergunta: "As razões apelam ao interesse do grupo ou ao bem comum?", niveis: ["interesse_de_grupo", "neutro", "bem_comum_utilitario", "bem_comum_diferenca"] },
  { id: "respeito_grupos", titulo: "Respeito a grupos", pergunta: "Fala dos grupos afetados com respeito explícito?", niveis: ["negativo", "neutro", "explicito_positivo"] },
  { id: "respeito_demandas", titulo: "Respeito a demandas", pergunta: "Trata as demandas dos outros com respeito?", niveis: ["negativo", "neutro", "explicito_positivo"] },
  { id: "respeito_contra", titulo: "Respeito a contra-argumentos", pergunta: "Como trata os argumentos contrários?", niveis: ["degradante", "ignora", "inclui", "valoriza"] },
  { id: "politica_construtiva", titulo: "Política construtiva", pergunta: "Propõe algo concreto ou só toma posição?", niveis: ["posicional", "proposta_alternativa", "proposta_mediadora"] },
];

export function rotuloLegivel(rotulo: string) {
  return rotulo.replaceAll("_", " ").replace("explicito", "explícito").replace("diferenca", "diferença").replace("utilitario", "utilitário");
}

export function palavras(texto: string) {
  return texto.split(/\s+/).filter(Boolean).length;
}
