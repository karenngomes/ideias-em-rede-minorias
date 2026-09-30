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

  const h5Significativas = persuasao.categorias.filter((key) => testes.h5.categorias[key as keyof typeof testes.h5.categorias].p_holm < 0.05);

  // Frases calculadas a partir dos resultados, para não ficarem desatualizadas quando o script rodar de novo.
  const meanOf = (values: number[]) => values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const deltaPorCategoria = (grupoDoItem: (item: (typeof persuasaoAudiencias)[number]) => Grupo) => Object.fromEntries(persuasao.categorias.map((key, index) => [
    key,
    meanOf(persuasaoAudiencias.filter((a) => grupoDoItem(a) === "M").map((a) => a.values[index])) - meanOf(persuasaoAudiencias.filter((a) => grupoDoItem(a) === "C").map((a) => a.values[index])),
  ])) as Record<string, number>;
  const deltasDavid = deltaPorCategoria((a) => a.grupo);
  const deltasThalia = deltaPorCategoria((a) => a.info!.grupo);
  const tecnicasMais = persuasao.categorias.filter((key) => key !== "nenhuma" && deltasDavid[key] > 0).sort((a, b) => deltasDavid[b] - deltasDavid[a]).slice(0, 3);
  const listar = (keys: string[]) => keys.map((key) => categoriaNomes[key].toLowerCase()).join(", ").replace(/, ([^,]*)$/, " e $1");
  const maiorDivergencia = persuasao.categorias.reduce((best, key) => (Math.abs(deltasDavid[key] - deltasThalia[key]) > Math.abs(deltasDavid[best] - deltasThalia[best]) ? key : best), persuasao.categorias[0]);
  const ppTexto = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} pp`;

  const h2Interesse = testes.h2.interesse_de_grupo;
  const h2InteresseTexto = h2Interesse.p >= 0.05
    ? "A parte da hipótese sobre “menos interesse de grupo” não se sustenta."
    : h2Interesse.diferenca < 0 ? "A parte da hipótese sobre “menos interesse de grupo” se sustenta." : "O interesse de grupo vai na direção contrária à hipótese: é maior nas audiências de minorias.";

  const h4Elogio = testes.h4.respeito.p < 0.05 && testes.h4.respeito.diferenca > 0;
  const h4Hostilidade = testes.h4.hostilidade.p < 0.05 && testes.h4.hostilidade.m[0] / testes.h4.hostilidade.m[1] > testes.h4.hostilidade.c[0] / testes.h4.hostilidade.c[1];
  const h4MediaMuda = testes.h4.media.p < 0.05;
  const h4Sustentada = h4Elogio && h4Hostilidade && !h4MediaMuda;
  const h4Texto = `${h4Elogio ? "Há mais elogio" : "Não há mais elogio"}, ${h4Hostilidade ? "há mais hostilidade" : "não há mais hostilidade"} e a média ${h4MediaMuda ? `também ${testes.h4.media.diferenca > 0 ? "sobe" : "cai"}` : "não muda"}. Por isso a hipótese, como foi formulada, ${h4Sustentada ? "se sustenta" : "não se sustenta"}.`;

  const palavras = rows(audiencias, (a) => a.palavras);
  const positivo = rows(audiencias, (a) => a.respeitoPositivo);
  const negativo = rows(audiencias, (a) => a.respeitoNegativo);
  const bemComum = rows(audiencias, (a) => a.bemComumDiferenca);
  const nivel = rows(audiencias, (a) => a.nivelJustificacao);
  const deficit = rows(audiencias, (a) => a.deficitCivil);
  const deficitExtent = extent(deficit.flatMap((row) => row.points.map((point) => point.value)));
  const medianOf = (data: typeof deficit, grupo: Grupo) => mediana(data.find((row) => row.grupo === grupo)!.points.map((point) => point.value));

  return (
    <main className="px-5 py-12 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Comparação</p>
        <h1 className="text-4xl font-semibold tracking-[-0.035em]">Minorias × demais audiências</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#666666]">
          O estudo de caso do artigo: as {n.M} audiências convocadas sobre pautas de minorias (grupo M) comparadas com as outras {n.C} (grupo C), a partir dos dados de turnos, DQI e cobertura e da classificação de persuasão (David).
          Cada ponto é uma audiência; clique para abri-la.
        </p>
        <p className="mt-3 max-w-3xl rounded-xl border border-black/10 bg-white px-4 py-3 text-xs leading-5 text-[#666666]">
          <strong className="text-ink">Análise exploratória.</strong> As hipóteses podem ter sido formuladas depois de olhar parte dos dados, e o DQI e a persuasão vêm de modelos de linguagem ainda sem validação humana. Os testes indicam onde há sinal; não confirmam as hipóteses.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <Legend/>
          <p className="text-xs text-[#999]">Testes gerados em {new Date(testes.gerado_em).toLocaleDateString("pt-BR")} por <code>analises/testes_estatisticos.py</code>.</p>
        </div>

        <Section eyebrow="H1 · Interrupções" title="Quem é interrompido no meio da fala" badge="sem modelo" warning="lógica em revisão"
          text={<>Parte das falas de cada papel marcadas como interrompidas, somando todas as audiências de cada grupo. Nas audiências de minorias, convidados são interrompidos <strong className="text-ink">{ratio("M")?.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×</strong> mais que parlamentares; nas demais, <strong className="text-ink">{ratio("C")?.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×</strong>.</>}
          note="A regra atual marca como interrupção qualquer fala fora da ordem esperada da sessão (presidência, convidado, réplica, tréplica), inclusive quando quem preside fala fora da vez. Isso não é necessariamente interrupção, e parte dos casos é fala de alguém não identificado ou da plateia."
          test={<TestBox name={`${testes.h1.teste}, ${testes.h1.n_falas.toLocaleString("pt-BR")} falas`} significant={testes.h1.interacao.p < 0.05}>
            <p>A diferença entre convidados e parlamentares é maior nas audiências de minorias? Razão de chances da interação <strong>{num(testes.h1.interacao.or)}</strong> (IC95% {num(testes.h1.interacao.ic[0])}–{num(testes.h1.interacao.ic[1])}), {pValue(testes.h1.interacao.p)}.</p>
            <p className="text-xs text-[#666666]">Nas demais audiências, convidados têm {num(testes.h1.convidado.or)} vezes a chance de parlamentares de serem interrompidos (IC95% {num(testes.h1.convidado.ic[0])}–{num(testes.h1.convidado.ic[1])}), {pValue(testes.h1.convidado.p)}.</p>
          </TestBox>}>
          <GroupedBars categories={interruptionCategories} max={maxInterruption} format={pct}/>
        </Section>

        <Section eyebrow="H2 · Conteúdo da justificação" title="Justificativas pelo bem comum sensível à diferença" badge="via LLM"
          text={<>Parte dos códigos de conteúdo da justificação que apelam ao bem comum sensível à diferença (em vez de interesse de grupo, neutro ou bem comum utilitário). A hipótese: mais desse tipo e menos interesse de grupo nas audiências de minorias. Mediana de <strong className="text-ink">{pct(medianOf(bemComum, "M") ?? 0)}</strong> nas audiências de minorias e <strong className="text-ink">{pct(medianOf(bemComum, "C") ?? 0)}</strong> nas demais.</>}
          note="É a dimensão que a anotação humana da Thalia está validando (bem comum × interesse de grupo). Atribuído por modelo de linguagem: o instrumento indica, não afirma."
          test={<TestBox name={testes.h2.bem_comum_diferenca.teste} significant={testes.h2.bem_comum_diferenca.p < 0.05}>
            <p>Bem comum sensível à diferença: diferença de medianas (M − C) de <strong>{signed(testes.h2.bem_comum_diferenca.diferenca, "pp")}</strong> ({interval(testes.h2.bem_comum_diferenca.ic, "pp")}), {pValue(testes.h2.bem_comum_diferenca.p)}, efeito r = {num(testes.h2.bem_comum_diferenca.r)} (grande a partir de 0,5).</p>
            <p className="text-xs text-[#666666]">Interesse de grupo: mediana de {pct(h2Interesse.mediana.M)} nas audiências de minorias e {pct(h2Interesse.mediana.C)} nas demais, {h2Interesse.p < 0.05 ? "com" : "sem"} diferença significativa ({pValue(h2Interesse.p)}). {h2InteresseTexto}</p>
          </TestBox>}>
          <StripPlot rows={bemComum} min={0} max={Math.ceil(Math.max(...bemComum.flatMap((r) => r.points.map((p) => p.value))) * 10) / 10} format={pct}/>
        </Section>

        <Section eyebrow="H3 · Nível de justificação" title="As posições vêm com razões?" badge="via LLM"
          text={<>Nível médio de justificação das falas de cada audiência, de 0 (nenhuma) a 3 (sofisticada). Mediana de <strong className="text-ink">{num(medianOf(nivel, "M") ?? 0)}</strong> nas audiências de minorias e <strong className="text-ink">{num(medianOf(nivel, "C") ?? 0)}</strong> nas demais.</>}
          note="Atribuído por modelo de linguagem, sem conferência humana."
          test={<TestBox name={testes.h3.teste} significant={testes.h3.p < 0.05}>
            <p>Diferença de medianas (M − C) de <strong>{testes.h3.diferenca >= 0 ? "+" : "−"}{num(Math.abs(testes.h3.diferenca))}</strong> na escala de 0 a 3 (IC95% {num(testes.h3.ic[0])} a {num(testes.h3.ic[1])}), {pValue(testes.h3.p)}.</p>
          </TestBox>}>
          <StripPlot rows={nivel} min={0} max={Math.ceil(Math.max(...nivel.flatMap((r) => r.points.map((p) => p.value))) * 2) / 2} format={(value) => num(value, 1)}/>
        </Section>

        <Section eyebrow="H4 · Respeito" title="Mais elogio e mais hostilidade, com a mesma média?" badge="via LLM"
          text={<>A hipótese previa mais manifestações nas duas pontas (explícito positivo e negativo) sem mudar o nível médio. O gráfico mostra a parte dos códigos de respeito (a grupos, a demandas e a contra-argumentos) que são explicitamente positivos: mediana de <strong className="text-ink">{pct(medianOf(positivo, "M") ?? 0)}</strong> nas audiências de minorias e <strong className="text-ink">{pct(medianOf(positivo, "C") ?? 0)}</strong> nas demais.</>}
          note="Atribuído por modelo de linguagem e ainda sem conferência humana: o instrumento indica, não afirma."
          test={<TestBox name="Mann-Whitney e bootstrap; teste exato de Fisher para a hostilidade" significant={h4Sustentada} label={h4Sustentada ? "hipótese sustentada" : "hipótese não sustentada como formulada"}>
            <p>Respeito explícito: <strong>{signed(testes.h4.respeito.diferenca, "pp")}</strong> ({interval(testes.h4.respeito.ic, "pp")}), {pValue(testes.h4.respeito.p)}, efeito r = {num(testes.h4.respeito.r)}.</p>
            <p>Hostilidade (algum código negativo): {testes.h4.hostilidade.m[0]} de {testes.h4.hostilidade.m[1]} audiências de minorias e {testes.h4.hostilidade.c[0]} de {testes.h4.hostilidade.c[1]} demais, {pValue(testes.h4.hostilidade.p)}, {testes.h4.hostilidade.p < 0.05 ? "diferença significativa" : "sem diferença significativa"}.</p>
            <p>Nível médio de respeito (0 a 1): {testes.h4.media.diferenca >= 0 ? "+" : "−"}{num(Math.abs(testes.h4.media.diferenca))} (IC95% {num(testes.h4.media.ic[0])} a {num(testes.h4.media.ic[1])}), {pValue(testes.h4.media.p)}.</p>
            <p className="text-xs text-[#666666]">{h4Texto}</p>
          </TestBox>}>
          <StripPlot rows={positivo} min={0} max={Math.ceil(Math.max(...positivo.flatMap((r) => r.points.map((p) => p.value))) * 10) / 10} format={pct}/>
          <p className="mb-2 mt-6 text-xs font-semibold text-ink">Respeito negativo ou degradante</p>
          <StripPlot rows={negativo} min={0} max={Math.ceil(Math.max(0.01, ...negativo.flatMap((r) => r.points.map((p) => p.value))) * 100) / 100} format={pct}/>
        </Section>

        <Section eyebrow="H5 · Persuasão" title="Técnicas de persuasão por grupo" badge="via LLM"
          text={<>Média do percentual de parágrafos de cada audiência com cada técnica, em {nPersuasao.M} audiências sobre minorias e {nPersuasao.C} de temáticas variadas. {tecnicasMais.length > 0 && <> As maiores diferenças a favor das audiências de minorias estão em {listar(tecnicasMais)}{deltasDavid.nenhuma < 0 ? ", e elas têm menos trechos sem nenhuma técnica" : ""}.</>} Uma fala pode ter mais de uma técnica.</>}
          note={`Classificação multilabel via LLM, em validação humana, só nas ${nPersuasao.M + nPersuasao.C} audiências classificadas até agora: sinal descritivo, não causal. A diferença de medianas (M − C) é ${ppTexto(deltasDavid.maior_diferenca)} para a técnica com maior diferença a favor das audiências de minorias (“${categoriaNomes[maiorDivergencia]}”), e ${ppTexto(deltasDavid.nenhuma)} para trechos sem nenhuma técnica.`}>
          <CategoryDumbbell categories={persuasaoCategorias} max={100}/>
          <TestBox name={testes.h5.teste} significant={h5Significativas.length > 0} label={`${h5Significativas.length} de ${persuasao.categorias.length} técnicas com diferença significativa`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead><tr className="text-[#666666]"><th className="py-1 font-medium">Técnica</th><th className="py-1 text-right font-medium">M − C</th><th className="py-1 text-right font-medium">p</th><th className="py-1 text-right font-medium">p corrigido (Holm)</th></tr></thead>
                <tbody>
                  {persuasao.categorias.map((key) => {
                    const item = testes.h5.categorias[key as keyof typeof testes.h5.categorias];
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
              Com a correção para as {persuasao.categorias.length} técnicas, {h5Significativas.length ? <>fica abaixo de 0,05 {h5Significativas.map((key) => `“${categoriaNomes[key].toLowerCase()}”`).join(", ")}, no limite</> : "nenhuma fica abaixo de 0,05"}. Com {nPersuasao.M} audiências por grupo, falta poder estatístico para detectar diferenças desse tamanho.
            </p>
          </TestBox>
        </Section>

        <Section eyebrow="Complementar · Cobertura" title="A sociedade civil fala mais do que aparece na matéria?" badge="sem modelo"
          text={<>Fora das hipóteses principais. Déficit da sociedade civil: parte das palavras ditas por convidados menos a parte das posições citadas na matéria original da Agência Câmara (com quem preside). Positivo significa que a sociedade civil fala mais do que aparece. Mediana de <strong className="text-ink">{pts(medianOf(deficit, "M") ?? 0)}</strong> nas audiências de minorias e <strong className="text-ink">{pts(medianOf(deficit, "C") ?? 0)}</strong> nas demais.</>}
          note="Audiências sem denominador (“sem dado”) ficam de fora; não é o mesmo que zero."
          test={<TestBox name={testes.cobertura.teste} significant={testes.cobertura.p < 0.05 || testes.cobertura.ajustado.p < 0.05}>
            <p>Diferença de medianas (M − C) de <strong>{signed(testes.cobertura.diferenca, "pts")}</strong> ({interval(testes.cobertura.ic, "pts")}), {pValue(testes.cobertura.p)}. Controlando o tamanho da audiência, o efeito de ser do grupo M é de {signed(testes.cobertura.ajustado.efeito, "pts")}, {pValue(testes.cobertura.ajustado.p)}.</p>
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

function Section({ eyebrow, title, badge, warning, text, note, test, children }: {
  eyebrow: string;
  title: string;
  badge: "sem modelo" | "via LLM";
  warning?: string;
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
        {warning && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800">{warning}</span>}
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
