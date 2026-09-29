import Link from "next/link";
import { ArrowRight, Database, FileText, Users } from "lucide-react";
import { extractDate, firstLine, getAudiencias, getClassifiedRecords, getHealth, type Audiencia } from "@/lib/api-server";
import { minorityGroupOf, PILOT_GROUP } from "@/lib/minorities";

const PAGE_SIZE = 12;

const hypotheses = [
  "Em audiências sobre pautas de minorias, falantes convidados são interrompidos com frequência desproporcionalmente maior que parlamentares.",
  "A proporção de códigos de respeito é maior nas audiências de minorias nas duas direções, com mais elogio explícito e mais hostilidade, enquanto a posição média na escala não difere.",
  "Chamada à ação e linguagem emocionalmente carregada são mais frequentes nas audiências sobre minorias, sobretudo nas falas da sociedade civil.",
  "Nas audiências sobre minorias, a sociedade civil é citada na matéria em proporção menor do que sua participação na fala, e essa diferença é maior do que nas demais audiências.",
];

type Status = "real" | "demo" | "soon";

const statusLabels: Record<Status, { label: string; className: string }> = {
  real: { label: "Dados reais", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  demo: { label: "Dados demonstrativos", className: "border-amber-200 bg-amber-50 text-amber-800" },
  soon: { label: "Em construção", className: "border-zinc-200 bg-zinc-100 text-zinc-600" },
};

const methods: Array<{ step: string; title: string; description: string; view?: string; status: Status }> = [
  {
    step: "01",
    title: "Sumarização ancorada",
    description: "Resumos em vários níveis de detalhe em que cada afirmação aponta para a fala original. O princípio de ancoragem permite verificar de onde veio cada frase, o que um sumarizador comum não garante.",
    view: "resumo",
    status: "demo",
  },
  {
    step: "02",
    title: "Extração de opiniões",
    description: "Posições atribuídas a cada participante, sempre ligadas ao turno que as sustenta. A validação usa o ground truth já anotado no corpus.",
    status: "soon",
  },
  {
    step: "03",
    title: "Análise de cobertura",
    description: "Compara quem falou na sessão com quem a matéria da Agência Câmara citou, medindo o déficit de visibilidade da sociedade civil.",
    status: "soon",
  },
  {
    step: "04",
    title: "Técnicas de persuasão",
    description: "Cada parágrafo é classificado em seis técnicas (ataque à reputação, justificativa, simplificação, distração, chamada para ação e linguagem manipulativa). A classificação do modelo é comparada com anotação humana (kappa).",
    view: "argumentacao",
    status: "real",
  },
  {
    step: "05",
    title: "Rede de interação",
    description: "Uma forma visual de resumir quem falou depois de quem, quem concedeu a palavra e quais opiniões tratam do mesmo tema ao longo da audiência.",
    view: "interacoes",
    status: "demo",
  },
  {
    step: "06",
    title: "Qualidade deliberativa (DQI)",
    description: "Sete indicadores por fala: participação, nível e conteúdo da justificação, respeito a grupos, a demandas e a contra-argumentos, e política construtiva.",
    status: "soon",
  },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const query = await searchParams;
  const requested = Number(query.page ?? "1");
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;
  const [health, audiencias, classified] = await Promise.all([getHealth(), getAudiencias(page, PAGE_SIZE), getClassifiedRecords()]);
  const groups = new Map(classified.items.map((record) => [record.id, minorityGroupOf(record.runs.map((run) => run.experiments_tag))]));
  const minorities = classified.items.filter((record) => groups.get(record.id) !== PILOT_GROUP);
  const example = minorities[0]?.id;
  const totalPages = Math.max(1, Math.ceil(audiencias.total / PAGE_SIZE));

  return (
    <main>
      <section className="relative overflow-hidden bg-zinc-900 px-5 pb-28 pt-14 text-white lg:px-8">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[560px] rounded-full bg-orange-500/10 blur-3xl"/>
        <div className="relative mx-auto max-w-[1200px]">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-orange-400">Audiências públicas e grupos minoritários</p>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">Quando o Legislativo abre espaço,<br/><em className="font-serif font-normal text-orange-400">quem é ouvido?</em></h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-300">Explore como deliberam as audiências públicas da Câmara sobre minorias, como cada participante argumenta e como essa deliberação chega ao público.</p>
        </div>
      </section>

      <div className="relative -mt-16 px-5 lg:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-3 md:grid-cols-3">
          <StatCard icon={<FileText className="size-5"/>} tone="bg-blue-50 text-blue-700" value={health.lds_records.toLocaleString("pt-BR")} label="Audiências catalogadas"/>
          <StatCard icon={<Database className="size-5"/>} tone="bg-orange-50 text-orange-700" value={health.transcript_chunks.toLocaleString("pt-BR")} label="Trechos transcritos"/>
          <StatCard icon={<Users className="size-5"/>} tone="bg-emerald-50 text-emerald-700" value={String(minorities.length)} label="Audiências no recorte de minorias"/>
        </div>
      </div>

      <div className="px-5 py-14 lg:px-8">
        <div className="mx-auto max-w-[1200px] space-y-16">
          <section className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
            <SectionTitle eyebrow="O artigo" title="Motivação"/>
            <div className="space-y-4 text-base leading-8 text-zinc-700">
              <p>Quando o Legislativo abre espaço formal para grupos historicamente vulnerabilizados, essa arena funciona da mesma forma que outras audiências? O trabalho acompanha o caminho que vai das <strong>audiências sobre minorias</strong> à <strong>dinâmica deliberativa</strong> e, por fim, à <strong>representação na cobertura institucional</strong>.</p>
              <blockquote className="border-l-4 border-orange-500 bg-white px-5 py-4 text-lg font-medium leading-8 text-zinc-900">Como deliberam as audiências públicas sobre minorias, e como essa deliberação chega ao público?</blockquote>
            </div>
          </section>

          <section className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
            <SectionTitle eyebrow="O que testamos" title="Hipóteses"/>
            <ol className="grid gap-3 md:grid-cols-2">
              {hypotheses.map((hypothesis, index) => (
                <li key={index} className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <span className="font-mono text-xs font-bold text-orange-600">H{index + 1}</span>
                  <p className="mt-2 text-sm leading-6 text-zinc-700">{hypothesis}</p>
                </li>
              ))}
              <li className="rounded-2xl border border-dashed border-zinc-300 p-5 md:col-span-2">
                <span className="font-mono text-xs font-bold text-zinc-500">Pergunta aberta</span>
                <p className="mt-2 text-sm leading-6 text-zinc-700">Quais são as principais características argumentativas presentes nessas audiências?</p>
              </li>
            </ol>
          </section>

          <section className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
            <SectionTitle eyebrow="Como analisamos" title="Metodologia" description="Cada etapa vira uma visualização da ferramenta. Todo resultado aponta de volta para a fala que o sustenta."/>
            <div className="grid gap-3 md:grid-cols-2">
              {methods.map((method) => {
                const status = statusLabels[method.status];
                const content = (
                  <>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-zinc-400">{method.step}</span>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                    </div>
                    <h3 className="text-base font-semibold text-zinc-900">{method.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{method.description}</p>
                    {method.view && example && <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700">Ver visualização <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5"/></span>}
                  </>
                );
                return method.view && example
                  ? <Link key={method.step} href={`/audiencias/${example}/${method.view}`} className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-orange-300 hover:shadow-[0_12px_40px_rgba(24,24,27,0.06)]">{content}</Link>
                  : <div key={method.step} className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5">{content}</div>;
              })}
            </div>
          </section>

          <section className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
            <SectionTitle eyebrow="Comparação" title="Minorias × demais audiências" description="Os mesmos indicadores medidos no recorte de minorias e nas outras audiências: tamanho, persuasão, argumentação e cobertura."/>
            <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm leading-6 text-zinc-600">
              O painel comparativo está em construção. Hoje a persuasão foi classificada apenas nas {minorities.length} audiências do recorte; a comparação depende de classificar também um grupo de controle.
            </div>
          </section>

          <section>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <SectionTitle eyebrow="Explorar" title="Recorte de minorias"/>
              <span className="text-xs text-zinc-500">{minorities.length} audiências com persuasão classificada</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {minorities.map((record) => (
                <Link key={record.id} href={`/audiencias/${record.id}/argumentacao`} className="group rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-orange-300 hover:shadow-[0_12px_40px_rgba(24,24,27,0.06)]">
                  <div className="mb-3 flex items-center justify-between gap-2 text-xs">
                    <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 font-bold text-orange-700">{groups.get(record.id)}</span>
                    <span className="font-mono text-zinc-400">#{record.id}</span>
                  </div>
                  <h3 className="text-sm font-semibold leading-6 text-zinc-900 group-hover:text-orange-700">{record.assunto}</h3>
                </Link>
              ))}
            </div>
          </section>

          <section id="acervo">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <SectionTitle eyebrow="Acervo" title="Todas as audiências"/>
              <span className="text-xs text-zinc-500">Página {page} de {totalPages}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {audiencias.items.map((audiencia) => <AudienceCard key={audiencia.id} audiencia={audiencia} group={groups.get(audiencia.id)}/>)}
            </div>
            <nav aria-label="Paginação" className="mt-6 flex items-center justify-center gap-2 text-sm">
              {page > 1 && <Link href={`/?page=${page - 1}#acervo`} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 hover:border-zinc-300">Anterior</Link>}
              <span className="px-2 text-zinc-500">{page} / {totalPages}</span>
              {page < totalPages && <Link href={`/?page=${page + 1}#acervo`} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 hover:border-zinc-300">Próxima</Link>}
            </nav>
          </section>
        </div>
      </div>
    </main>
  );
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-600">{eyebrow}</p>
      <h2 className="text-2xl font-semibold tracking-[-0.03em]">{title}</h2>
      {description && <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>}
    </div>
  );
}

function StatCard({ icon, tone, value, label }: { icon: React.ReactNode; tone: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_12px_40px_rgba(24,24,27,0.08)]">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tone}`}>{icon}</span>
      <div><p className="text-2xl font-semibold tabular-nums text-zinc-950">{value}</p><p className="text-xs text-zinc-500">{label}</p></div>
    </div>
  );
}

function AudienceCard({ audiencia, group }: { audiencia: Audiencia; group?: string }) {
  return (
    <Link href={`/audiencias/${audiencia.id}`} className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-orange-300 hover:shadow-[0_12px_40px_rgba(24,24,27,0.06)]">
      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-zinc-400">
        <span className="font-mono">#{audiencia.id}</span>
        <time>{extractDate(audiencia.materia) ?? "Data não informada"}</time>
      </div>
      {group && <span className="mb-2 self-start rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700">{group}</span>}
      <h3 className="text-sm font-semibold leading-6 text-zinc-900 group-hover:text-orange-700">{audiencia.metadados.assunto || firstLine(audiencia.materia)}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{firstLine(audiencia.materia)}</p>
      <div className="mt-auto flex gap-4 pt-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5"><Users className="size-3.5"/>{audiencia.metadados.envolvidos.length} participantes</span>
        <span className="flex items-center gap-1.5"><FileText className="size-3.5"/>{(audiencia.chunk_count ?? 0).toLocaleString("pt-BR")} trechos</span>
      </div>
    </Link>
  );
}
