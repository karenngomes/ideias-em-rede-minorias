import type { Metadata } from "next";
import Link from "next/link";
import { CategoryDumbbell, GroupedBars, Legend, StripPlot } from "@/components/comparacao/charts";
import persuasao from "@/data/persuasao-por-audiencia.json";
import testes from "@/data/testes-estatisticos.json";
import { getComparacao, mediana, type AudienciaIndicadores, type Grupo, type Papel } from "@/lib/comparacao";

export const metadata: Metadata = { title: "Minorias × demais | Karkará · Ideias em Rede" };

const pct = (value: number) => `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const pts = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value * 100)} pts`;
const mil = (value: number) => `${Math.round(value / 1000).toLocaleString("pt-BR")} mil`;

const num = (value: number, digits = 2) => value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pValue = (p: number) => (p < 0.001 ? "p < 0,001" : `p = ${num(p, 3)}`);
const signed = (value: number, unit: string) => `${value >= 0 ? "+" : "−"}${num(Math.abs(value * 100), 1)} ${unit}`;
const interval = (ic: number[], unit: string) => `IC95% ${signed(ic[0], unit)} a ${signed(ic[1], unit)}`;

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

  // Persuasão: análise do David, com o agrupamento dele (as demais seções usam a rotulagem da Thalia).
  const grupoDe = new Map(audiencias.map((a) => [a.id, a]));
  const categoriaNomes: Record<string, string> = { ataque_a_reputacao: "Ataque à reputação", justificativa: "Justificativa", simplificacao: "Simplificação", distracao: "Distração", chamada: "Chamada à ação", linguagem_manipulativa: "Linguagem manipulativa", nenhuma: "Nenhuma técnica" };
  const persuasaoAudiencias = Object.entries(persuasao.audiencias)
    .map(([id, values]) => ({ id: Number(id), values, info: grupoDe.get(Number(id)), grupo: (persuasao.grupos_do_autor.minorias.includes(Number(id)) ? "M" : "C") as Grupo }))
    .filter((item) => item.info);
  const nPersuasao = { M: persuasaoAudiencias.filter((a) => a.grupo === "M").length, C: persuasaoAudiencias.filter((a) => a.grupo === "C").length };
  const divergentes = persuasaoAudiencias.filter((a) => a.grupo !== a.info!.grupo);
  const persuasaoCategorias = persuasao.categorias.map((key, index) => ({
    label: categoriaNomes[key] ?? key,
    points: {
      M: persuasaoAudiencias.filter((a) => a.grupo === "M").map((a) => ({ id: a.id, value: a.values[index], title: a.info!.assunto })),
      C: persuasaoAudiencias.filter((a) => a.grupo === "C").map((a) => ({ id: a.id, value: a.values[index], title: a.info!.assunto })),
    },
  }));

  const h3Significativas = persuasao.categorias.filter((key) => testes.h3.categorias[key as keyof typeof testes.h3.categorias].p_holm < 0.05);

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
          As {n.M} audiências convocadas sobre pautas de minorias (grupo M) comparadas com as outras {n.C} (grupo C), a partir dos dados de turnos, DQI e cobertura (Thalia) e da classificação de persuasão (David).
          Cada ponto é uma audiência; clique para abri-la.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <Legend/>
          <p className="text-xs text-[#999]">Testes preliminares, gerados em {new Date(testes.gerado_em).toLocaleDateString("pt-BR")}: DQI e persuasão ainda sem validação humana.</p>
        </div>

        <Section eyebrow="H1 · Interrupções" title="Quem é interrompido no meio da fala" badge="sem modelo"
          text={<>Parte das falas de cada papel marcadas como interrompidas, somando todas as audiências de cada grupo. Nas audiências de minorias, convidados são interrompidos <strong className="text-ink">{ratio("M")?.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×</strong> mais que parlamentares; nas demais, <strong className="text-ink">{ratio("C")?.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×</strong>.</>}
          note="As interrupções saem da estrutura da transcrição, sem modelo, mas parte delas pode ser fala de alguém não identificado ou manifestação da plateia. Ainda precisam de conferência."
          test={<TestBox name={`${testes.h1.teste}, ${testes.h1.n_falas.toLocaleString("pt-BR")} falas`} significant={testes.h1.interacao.p < 0.05}>
            <p>A diferença entre convidados e parlamentares é maior nas audiências de minorias? Razão de chances da interação <strong>{num(testes.h1.interacao.or)}</strong> (IC95% {num(testes.h1.interacao.ic[0])}–{num(testes.h1.interacao.ic[1])}), {pValue(testes.h1.interacao.p)}.</p>
            <p className="text-xs text-[#666666]">Nas demais audiências, convidados têm {num(testes.h1.convidado.or)} vezes a chance de parlamentares de serem interrompidos (IC95% {num(testes.h1.convidado.ic[0])}–{num(testes.h1.convidado.ic[1])}), {pValue(testes.h1.convidado.p)}. O intervalo inclui 1, então o dado ainda não sustenta a hipótese.</p>
          </TestBox>}>
          <GroupedBars categories={interruptionCategories} max={maxInterruption} format={pct}/>
        </Section>

        <Section eyebrow="H2 · Respeito" title="Respeito explícito nas falas" badge="via LLM"
          text={<>Parte dos códigos de respeito (a grupos, a demandas e a contra-argumentos) que são explicitamente positivos. Mediana de <strong className="text-ink">{pct(medianOf(positivo, "M") ?? 0)}</strong> nas audiências de minorias e <strong className="text-ink">{pct(medianOf(positivo, "C") ?? 0)}</strong> nas demais.</>}
          note="Atribuído por modelo de linguagem e ainda sem conferência humana: o instrumento indica, não afirma."
          test={<TestBox name={testes.h2.respeito.teste} significant={testes.h2.respeito.p < 0.05}>
            <p>Diferença de medianas (M − C) de <strong>{signed(testes.h2.respeito.diferenca, "pp")}</strong> ({interval(testes.h2.respeito.ic, "pp")}), {pValue(testes.h2.respeito.p)}. Tamanho de efeito r = {num(testes.h2.respeito.r)} (grande a partir de 0,5).</p>
          </TestBox>}>
          <StripPlot rows={positivo} min={0} max={Math.ceil(Math.max(...positivo.flatMap((r) => r.points.map((p) => p.value))) * 10) / 10} format={pct}/>
        </Section>

        <Section eyebrow="H2 · Hostilidade" title="Respeito negativo ou degradante" badge="via LLM"
          test={<TestBox name={testes.h2.hostilidade.teste} significant={testes.h2.hostilidade.p < 0.05}>
            <p>Audiências com algum código negativo: {testes.h2.hostilidade.m[0]} de {testes.h2.hostilidade.m[1]} em M e {testes.h2.hostilidade.c[0]} de {testes.h2.hostilidade.c[1]} em C. Razão de chances {num(testes.h2.hostilidade.or)}, {pValue(testes.h2.hostilidade.p)}.</p>
          </TestBox>}
          text={<>A outra ponta da escala. Quase não aparece em nenhum dos grupos: {negativo.map((row) => `${row.points.filter((p) => p.value > 0).length} de ${row.points.length} audiências ${row.grupo === "M" ? "de minorias" : "demais"}`).join(" e ")} têm algum código negativo.</>}>
          <StripPlot rows={negativo} min={0} max={Math.ceil(Math.max(0.01, ...negativo.flatMap((r) => r.points.map((p) => p.value))) * 100) / 100} format={pct}/>
        </Section>

        <Section eyebrow="H3 · Persuasão" title="Técnicas de persuasão por grupo" badge="via LLM"
          text={<>Análise do David: média do percentual de parágrafos de cada audiência com cada técnica, em {nPersuasao.M} audiências sobre minorias e {nPersuasao.C} de temáticas variadas. As audiências de minorias têm mais chamada à ação, ataque à reputação e justificativa, e menos trechos sem nenhuma técnica. Uma fala pode ter mais de uma técnica.</>}
          note={`Classificação multilabel via LLM, em validação humana, só nas ${nPersuasao.M + nPersuasao.C} audiências classificadas até agora: sinal descritivo, não causal. Os grupos são os do David${divergentes.length ? `; na rotulagem da Thalia, usada nas outras seções, a audiência ${divergentes.map((a) => a.id).join(", ")} é do grupo de minorias. Com essa rotulagem, as diferenças mudam pouco (por exemplo, chamada à ação +9,4 pp em vez de +9,6 pp)` : ""}.`}>
          <CategoryDumbbell categories={persuasaoCategorias} max={100}/>
          <TestBox name={testes.h3.teste} significant={h3Significativas.length > 0} label={`${h3Significativas.length} de ${persuasao.categorias.length} técnicas com diferença significativa`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead><tr className="text-[#666666]"><th className="py-1 font-medium">Técnica</th><th className="py-1 text-right font-medium">M − C</th><th className="py-1 text-right font-medium">p</th><th className="py-1 text-right font-medium">p corrigido (Holm)</th></tr></thead>
                <tbody>
                  {persuasao.categorias.map((key) => {
                    const item = testes.h3.categorias[key as keyof typeof testes.h3.categorias];
                    return (
                      <tr key={key} className={`border-t border-black/5 ${item.p_holm < 0.05 ? "font-semibold text-ink" : ""}`}>
                        <td className="py-1">{categoriaNomes[key]}</td>
                        <td className="py-1 text-right tabular-nums">{signed(item.diferenca, "pp")}</td>
                        <td className="py-1 text-right tabular-nums">{num(item.p, 3)}</td>
                        <td className="py-1 text-right tabular-nums">{num(item.p_holm, 3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[#666666]">
              Com a correção para as {persuasao.categorias.length} técnicas, {h3Significativas.length ? <>fica abaixo de 0,05 {h3Significativas.map((key) => `“${categoriaNomes[key].toLowerCase()}”`).join(", ")}</> : "nenhuma fica abaixo de 0,05"}. Com {nPersuasao.M} audiências por grupo, falta poder estatístico para detectar diferenças desse tamanho.
            </p>
          </TestBox>
        </Section>

        <Section eyebrow="H4 · Cobertura" title="A sociedade civil fala mais do que aparece na matéria?" badge="sem modelo"
          text={<>Déficit da sociedade civil: parte das palavras ditas por convidados menos a parte das posições citadas na matéria original da Agência Câmara (com quem preside). Positivo significa que a sociedade civil fala mais do que aparece. Mediana de <strong className="text-ink">{pts(medianOf(deficit, "M") ?? 0)}</strong> nas audiências de minorias e <strong className="text-ink">{pts(medianOf(deficit, "C") ?? 0)}</strong> nas demais.</>}
          note="Audiências sem denominador (“sem dado”) ficam de fora; não é o mesmo que zero."
          test={<TestBox name={testes.h4.teste} significant={testes.h4.p < 0.05 || testes.h4.ajustado.p < 0.05}>
            <p>Diferença de medianas (M − C) de <strong>{signed(testes.h4.diferenca, "pts")}</strong> ({interval(testes.h4.ic, "pts")}), {pValue(testes.h4.p)}. Controlando o tamanho da audiência, o efeito de ser do grupo M é de {signed(testes.h4.ajustado.efeito, "pts")}, {pValue(testes.h4.ajustado.p)}.</p>
          </TestBox>}>
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

function Section({ eyebrow, title, badge, text, note, test, children }: {
  eyebrow: string;
  title: string;
  badge: "sem modelo" | "via LLM";
  text: React.ReactNode;
  note?: string;
  test?: React.ReactNode;
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
      {test}
      {note && <p className="mt-3 text-[11px] leading-5 text-[#999]">{note}</p>}
    </section>
  );
}

function TestBox({ name, significant, label, children }: { name: string; significant: boolean; label?: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-xl bg-paper px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#666666]">Teste estatístico · <span className="font-medium normal-case tracking-normal">{name}</span></p>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${significant ? "bg-ink text-white" : "border border-black/15 text-[#666666]"}`}>
          {label ?? (significant ? "diferença significativa" : "sem diferença significativa")}
        </span>
      </div>
      <div className="mt-2 space-y-1 text-sm leading-6 text-[#333]">{children}</div>
    </div>
  );
}
