// Tipos do pacote de dados de conteúdo e os dados derivados usados pela página
// Turno a turno. Tudo se resolve pelo turno_id (veja dados/conteudo/CONTRATO.md).

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

type Proporcoes = { participacao_civil_palavras: number | null; citacao_civil_opinioes: number | null; deficit_civil: number | null };

export type Cobertura = {
  n_falantes: number;
  n_parlamentares: number;
  n_convidados: number;
  proporcoes: { com_mesa: Proporcoes; sem_mesa: Proporcoes };
  citados_ausentes: string[];
  falantes_silenciados: string[];
  falantes: Array<{ nome: string; parlamentar: boolean; mesa: boolean; n_turnos: number; n_palavras: number; turnos: number[] }>;
};

export type Qualificador = { tipo: string; trecho: string; preservado?: boolean };

type OpiniaoArquivo = { texto: string; ancora: { turno_id: number }; nucleo?: string; qualificadores?: Qualificador[] };

export type AudienciaBundle = {
  turnos: Turno[];
  opinioes: { assunto: string; envolvidos: Array<{ nome: string; cargo: string; opinioes: OpiniaoArquivo[] }> } | null;
  dqi: { n_turnos: number; n_turnos_codificados: number; codigos: CodigoDqi[] } | null;
  cobertura: Cobertura | null;
  grafo: {
    nos: Array<{ id: string; tipo: "participante" | "opiniao"; rotulo: string; dados: { falante?: string; cargo?: string; turno_id?: number } }>;
    arestas: Array<{ origem: string; destino: string; tipo: "emitiu" | "fala_apos" | "concede_palavra" | "mesmo_tema"; peso: number; dados?: { turno_id?: number } }>;
  } | null;
  resumo: { secoes: Array<{ titulo: string; sintese: string; participantes: string[]; deriva_de: string[]; posicoes: Array<{ falante: string; texto: string; turno_id: number }> }> } | null;
  materia: { blocos: Array<{ tipo: string; texto: string; falante: string | null; cargo: string; ancora: { turno_id: number } | null; ancorado: boolean }> } | null;
  argumento_intra: { itens: Array<{ opiniao: string; falante: string; turno_id: number; fundamentos: Array<{ tipo: string; trecho: string; ancorado: boolean }>; contraponto: { trecho?: string } | null }> } | null;
};

export type Opiniao = {
  id: string;
  texto: string;
  falante: string;
  turno_id: number;
  tema: number;
  qualificadores: Qualificador[];
  fundamentos: Array<{ tipo: string; trecho: string }>;
};

export type Audiencia = ReturnType<typeof derive>;

export const temaCores = ["#ff4b3e", "#344b7f", "#e0a01b", "#2f8f6b", "#8a3d50", "#5b8fd6", "#c2185b", "#6d8b2f", "#9c6ade", "#d9772b"];

export function temaCor(tema: number) {
  return tema < 0 ? "#999999" : temaCores[tema % temaCores.length];
}

export function derive(bundle: AudienciaBundle) {
  const turnos = bundle.turnos;
  const secoes = bundle.resumo?.secoes ?? [];
  // O resumo pode ter várias seções com o mesmo título; o tema (e a cor) é o título,
  // para o mapa, a legenda e o resumo usarem a mesma cor.
  const temas = Array.from(new Set(secoes.map((secao) => secao.titulo)));
  const temaDaSecao = secoes.map((secao) => temas.indexOf(secao.titulo));
  const temaPorOpiniao = new Map<string, number>();
  secoes.forEach((secao, indice) => secao.deriva_de.forEach((id) => {
    if (!temaPorOpiniao.has(id)) temaPorOpiniao.set(id, temaDaSecao[indice]);
  }));

  const chave = (turno: number, texto: string) => `${turno}::${texto.trim().toLowerCase()}`;
  const qualificadores = new Map<string, Qualificador[]>();
  bundle.opinioes?.envolvidos.forEach((pessoa) => pessoa.opinioes.forEach((opiniao) => {
    if (opiniao.qualificadores?.length) qualificadores.set(chave(opiniao.ancora.turno_id, opiniao.texto), opiniao.qualificadores);
  }));
  const fundamentos = new Map<string, Array<{ tipo: string; trecho: string }>>();
  bundle.argumento_intra?.itens.forEach((item) => fundamentos.set(chave(item.turno_id, item.opiniao), item.fundamentos.filter((f) => f.ancorado)));

  const opinioes: Opiniao[] = (bundle.grafo?.nos ?? [])
    .filter((no) => no.tipo === "opiniao" && no.dados.turno_id != null)
    .map((no) => {
      const turno = Number(no.dados.turno_id);
      return {
        id: no.id,
        texto: no.rotulo,
        falante: String(no.dados.falante ?? ""),
        turno_id: turno,
        tema: temaPorOpiniao.get(no.id) ?? -1,
        qualificadores: qualificadores.get(chave(turno, no.rotulo)) ?? [],
        fundamentos: fundamentos.get(chave(turno, no.rotulo)) ?? [],
      };
    });

  // Participantes na ordem em que falam pela primeira vez.
  const participantes = Array.from(new Set(turnos.map((turno) => turno.falante_norm)));
  // cobertura.json já agrega quem é parlamentar; sem ela, usa o sufixo "- UF" do partido.
  const parlamentares = new Set(
    bundle.cobertura
      ? bundle.cobertura.falantes.filter((falante) => falante.parlamentar).map((falante) => falante.nome)
      : turnos.filter((turno) => /- [A-Z]{2}$/.test(turno.partido ?? "")).map((turno) => turno.falante_norm),
  );

  // Quem preside a sessão (a "mesa" em cobertura.json).
  const mesa = new Set((bundle.cobertura?.falantes ?? []).filter((falante) => falante.mesa).map((falante) => falante.nome));

  return {
    turnos,
    opinioes,
    participantes,
    parlamentares,
    mesa,
    secoes,
    temas,
    temaDaSecao,
    arestas: bundle.grafo?.arestas ?? [],
    codigos: bundle.dqi?.codigos ?? [],
    dqi: bundle.dqi,
    cobertura: bundle.cobertura,
  };
}

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

export type PersuasaoTurno = { turno_id: number; chunk_index: number; superclass: string; trecho: string; explicacao: string };

// Liga cada evidência de persuasão (segmentada pela API) ao turno do pacote de conteúdo que contém
// o mesmo texto, preferindo a fala da mesma pessoa.
export function persuasaoPorTurno(turnos: Turno[], annotations: Array<{ chunk_index: number; speaker: string; superclass: string; trecho: string; explicacao: string }>) {
  const norm = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const items: PersuasaoTurno[] = [];
  let unmatched = 0;
  annotations.forEach((annotation) => {
    const candidates = turnos.filter((turno) => turno.texto.includes(annotation.trecho));
    const turno = candidates.find((item) => norm(item.falante_norm) === norm(annotation.speaker)) ?? candidates[0];
    if (turno) items.push({ turno_id: turno.turno_id, chunk_index: annotation.chunk_index, superclass: annotation.superclass, trecho: annotation.trecho, explicacao: annotation.explicacao });
    else unmatched += 1;
  });
  return { items, unmatched };
}
