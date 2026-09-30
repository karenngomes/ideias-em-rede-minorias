import type { Metadata } from "next";
import Link from "next/link";
import { CategoryDumbbell, GroupedBars, Legend, StripPlot } from "@/components/comparacao/charts";
import persuasao from "@/data/persuasao-por-audiencia.json";
import { getComparacao, mediana, type AudienciaIndicadores, type Grupo, type Papel } from "@/lib/comparacao";

export const metadata: Metadata = { title: "Minorias × demais | Karkará · Ideias em Rede" };

const pct = (value: number) => `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const pts = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value * 100)} pts`;
const mil = (value: number) => `${Math.round(value / 1000).toLocaleString("pt-BR")} mil`;

function rows(audiencias: AudienciaIndicadores[], pick: (item: AudienciaIndicadores) => number | null) {
  return (["M", "C"] as Grupo[]).map((grupo) => ({
    grupo,
    points: audiencias
      .filter((item) => item.grupo === grupo && pick(item) != null)
      .map((item) => ({ id: item.id, value: pick(item) as number, title: item.assunto })),
  }));
}

// Arredonda o domínio para 10 pontos percentuais, para o eixo ter marcas redondas.
function extent(values: number[]) {
  return { min: Math.floor(Math.min(...values) * 10) / 10, max: Math.ceil(Math.max(...values) * 10) / 10 };
}

export default async function ComparacaoPage() {
  const { audiencias, interrupcoes } = await getComparacao();
  const n = { M: audiencias.filter((a) => a.grupo === "M").length, C: audiencias.filter((a) => a.grupo === "C").length };

  const rate = (grupo: Grupo, papel: Papel) => {
    const { interrompidas, total } = interrupcoes[grupo][papel];
    return total ? { value: interrompidas / total, detail: `${interrompidas} de ${total} falas` } : null;
  };
  const papeis: Array<{ papel: Papel; label: string }> = [
    { papel: "convidado", label: "Convidados" },
    { papel: "parlamentar", label: "Parlamentares" },
    { papel: "preside", label: "Quem preside" },
  ];
  const interruptionCategories = papeis.map(({ papel, label }) => ({ label, values: { M: rate("M", papel), C: rate("C", papel) } }));
  const maxInterruption = Math.max(...interruptionCategories.flatMap((c) => [c.values.M?.value ?? 0, c.values.C?.value ?? 0]));
  const ratio = (grupo: Grupo) => {
    const convidado = rate(grupo, "convidado")?.value;
    const parlamentar = rate(grupo, "parlamentar")?.value;
    return convidado && parlamentar ? convidado / parlamentar : null;
  };

  // Persuasão: classificação do David, agrupada pela rotulagem da Thalia (M ou C).
  const grupoDe = new Map(audiencias.map((a) => [a.id, a]));
  const categoriaNomes: Record<string, string> = { ataque_a_reputacao: "Ataque à reputação", justificativa: "Justificativa", simplificacao: "Simplificação", distracao: "Distração", chamada: "Chamada à ação", linguagem_manipulativa: "Linguagem manipulativa", nenhuma: "Nenhuma técnica" };
  const persuasaoAudiencias = Object.entries(persuasao.audiencias).map(([id, values]) => ({ id: Number(id), values, info: grupoDe.get(Number(id)) })).filter((item) => item.info);
  const nPersuasao = { M: persuasaoAudiencias.filter((a) => a.info!.grupo === "M").length, C: persuasaoAudiencias.filter((a) => a.info!.grupo === "C").length };
  const divergentes = persuasaoAudiencias.filter((a) => (a.info!.grupo === "M") !== persuasao.grupos_do_autor.minorias.includes(a.id));
  const persuasaoCategorias = persuasao.categorias.map((key, index) => ({
    label: categoriaNomes[key] ?? key,
    points: {
      M: persuasaoAudiencias.filter((a) => a.info!.grupo === "M").map((a) => ({ id: a.id, value: a.values[index], title: a.info!.assunto })),
      C: persuasaoAudiencias.filter((a) => a.info!.grupo === "C").map((a) => ({ id: a.id, value: a.values[index], title: a.info!.assunto })),
    },
  }));

  const palavras = rows(audiencias, (a) => a.palavras);
  const positivo = rows(audiencias, (a) => a.respeitoPositivo);
  const negativo = rows(audiencias, (a) => a.respeitoNegativo);
  const deficit = rows(audiencias, (a) => a.deficitCivil);
  const deficitExtent = extent(deficit.flatMap((row) => row.points.map((point) => point.value)));
  const medianOf = (data: typeof deficit, grupo: Grupo) => mediana(data.find((row) => row.grupo === grupo)!.points.map((point) => point.value));

  return (
    <main className="px-5 py-12 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Comparação</p>
        <h1 className="text-4xl font-semibold tracking-[-0.035em]">Minorias × demais audiências</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#666666]">
          As {n.M} audiências convocadas sobre pautas de minorias (grupo M) comparadas com as outras {n.C} (grupo C), a partir dos dados de turnos, DQI e cobertura.
          Cada ponto é uma audiência; clique para abri-la.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <Legend/>
          <p className="text-xs text-[#999]">Descritivo: medianas e proporções, sem teste estatístico.</p>
        </div>

        <Section eyebrow="H1 · Interrupções" title="Quem é interrompido no meio da fala" badge="sem modelo"
          text={<>Parte das falas de cada papel marcadas como interrompidas, somando todas as audiências de cada grupo. Nas audiências de minorias, convidados são interrompidos <strong className="text-ink">{ratio("M")?.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×</strong> mais que parlamentares; nas demais, <strong className="text-ink">{ratio("C")?.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×</strong>.</>}
          note="As interrupções saem da estrutura da transcrição, sem modelo, mas parte delas pode ser fala de alguém não identificado ou manifestação da plateia. Ainda precisam de conferência.">
          <GroupedBars categories={interruptionCategories} max={maxInterruption} format={pct}/>
        </Section>

        <Section eyebrow="H2 · Respeito" title="Respeito explícito nas falas" badge="via LLM"
          text={<>Parte dos códigos de respeito (a grupos, a demandas e a contra-argumentos) que são explicitamente positivos. Mediana de <strong className="text-ink">{pct(medianOf(positivo, "M") ?? 0)}</strong> nas audiências de minorias e <strong className="text-ink">{pct(medianOf(positivo, "C") ?? 0)}</strong> nas demais.</>}
          note="Atribuído por modelo de linguagem e ainda sem conferência humana: o instrumento indica, não afirma.">
          <StripPlot rows={positivo} min={0} max={Math.ceil(Math.max(...positivo.flatMap((r) => r.points.map((p) => p.value))) * 10) / 10} format={pct}/>
        </Section>

        <Section eyebrow="H2 · Hostilidade" title="Respeito negativo ou degradante" badge="via LLM"
          text={<>A outra ponta da escala. Quase não aparece em nenhum dos grupos: {negativo.map((row) => `${row.points.filter((p) => p.value > 0).length} de ${row.points.length} audiências ${row.grupo === "M" ? "de minorias" : "demais"}`).join(" e ")} têm algum código negativo.</>}>
          <StripPlot rows={negativo} min={0} max={Math.ceil(Math.max(0.01, ...negativo.flatMap((r) => r.points.map((p) => p.value))) * 100) / 100} format={pct}/>
        </Section>

        <Section eyebrow="H3 · Persuasão" title="Técnicas de persuasão por grupo" badge="via LLM"
          text={<>Média do percentual de parágrafos de cada audiência com cada técnica, em {nPersuasao.M} audiências de minorias e {nPersuasao.C} demais. As audiências de minorias têm mais chamada à ação, ataque à reputação e justificativa, e menos trechos sem nenhuma técnica. Uma fala pode ter mais de uma técnica.</>}
          note={`Classificação do David (multilabel, via LLM, em validação humana), só nas ${nPersuasao.M + nPersuasao.C} audiências classificadas até agora: sinal descritivo, não causal. Os grupos seguem a rotulagem da Thalia${divergentes.length ? `; no agrupamento do David, a audiência ${divergentes.map((a) => a.id).join(", ")} aparece entre as temáticas variadas, e as diferenças mudam pouco (por exemplo, chamada à ação +9,6 pp em vez de +9,4 pp)` : ""}.`}>
          <CategoryDumbbell categories={persuasaoCategorias} max={100}/>
        </Section>

        <Section eyebrow="H4 · Cobertura" title="A sociedade civil fala mais do que aparece na matéria?" badge="sem modelo"
          text={<>Déficit da sociedade civil: parte das palavras ditas por convidados menos a parte das posições citadas na matéria original da Agência Câmara (com quem preside). Positivo significa que a sociedade civil fala mais do que aparece. Mediana de <strong className="text-ink">{pts(medianOf(deficit, "M") ?? 0)}</strong> nas audiências de minorias e <strong className="text-ink">{pts(medianOf(deficit, "C") ?? 0)}</strong> nas demais.</>}
          note="Audiências sem denominador (“sem dado”) ficam de fora; não é o mesmo que zero.">
          <StripPlot rows={deficit} min={deficitExtent.min} max={deficitExtent.max} format={pts} zero/>
        </Section>

        <Section eyebrow="Contexto" title="Tamanho das audiências" badge="sem modelo"
          text={<>Palavras faladas por audiência. Mediana de <strong className="text-ink">{mil(medianOf(palavras, "M") ?? 0)}</strong> nas audiências de minorias e <strong className="text-ink">{mil(medianOf(palavras, "C") ?? 0)}</strong> nas demais.</>}>
          <StripPlot rows={palavras} min={0} max={Math.ceil(Math.max(...palavras.flatMap((r) => r.points.map((p) => p.value))) / 20000) * 20000} format={mil}/>
        </Section>
      </div>
    </main>
  );
}

function Section({ eyebrow, title, badge, text, note, children }: {
  eyebrow: string;
  title: string;
  badge: "sem modelo" | "via LLM";
  text: React.ReactNode;
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-black/10 bg-white p-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">{eyebrow}</p>
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badge === "sem modelo" ? "bg-[#344b7f]/10 text-[#344b7f]" : "bg-orange-50 text-orange-700"}`}>{badge}</span>
      </div>
      <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#666666]">{text}</p>
      {children && <div className="mt-5">{children}</div>}
      {note && <p className="mt-3 text-[11px] leading-5 text-[#999]">{note}</p>}
    </section>
  );
}
