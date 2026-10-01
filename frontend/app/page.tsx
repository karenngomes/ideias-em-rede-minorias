import Link from "next/link";
import { ArrowRight, FileText, Megaphone, Network, Newspaper, Quote, Scale } from "lucide-react";
import { getHealth } from "@/lib/api-server";
import { getMinorityAudiences } from "@/lib/minorities";
import { getSilenciadosCorpus } from "@/lib/thalia-data";

const hypotheses = [
  "Convidados são mais interrompidos que parlamentares, sobretudo nas audiências de minorias.",
  "Nas audiências de minorias, as justificativas apelam mais ao bem comum sensível à diferença e menos ao interesse de grupo.",
  "O nível de justificação das falas é diferente entre os dois grupos.",
  "Há mais elogio explícito e mais hostilidade nas audiências de minorias, sem mudar a média de respeito.",
  "As técnicas de persuasão se distribuem de forma diferente entre os grupos.",
];

const methods = [
  { icon: FileText, title: "Sumarização ancorada", text: "Resumos em que cada frase aponta para a fala original.", view: "turnos" },
  { icon: Quote, title: "Extração de opiniões", text: "O que cada participante defendeu, ligado ao turno de fala.", view: "turnos" },
  { icon: Newspaper, title: "Análise de cobertura", text: "Quem falou na sessão × quem a matéria citou.", view: "turnos" },
  { icon: Megaphone, title: "Técnicas de persuasão", text: "Seis técnicas por parágrafo, comparadas com anotação humana.", view: "turnos" },
  { icon: Network, title: "Rede de interação", text: "Quem falou depois de quem e quem concedeu a palavra.", view: "turnos" },
  { icon: Scale, title: "Qualidade deliberativa", text: "Sete indicadores do DQI, como justificação e respeito.", view: "turnos" },
];

export default async function Home() {
  const [health, minorities, corpus] = await Promise.all([getHealth(), getMinorityAudiences(), getSilenciadosCorpus()]);
  const categorias = Array.from(minorities.flatMap((record) => record.categorias).reduce((map, categoria) => map.set(categoria, (map.get(categoria) ?? 0) + 1), new Map<string, number>())).sort((a, b) => b[1] - a[1]);
  const destaques = minorities.filter((record) => record.persuasao).slice(0, 5);
  const silenciados = corpus.falantes ? Math.round((corpus.silenciados / corpus.falantes) * 100) : null;
  const example = minorities.find((record) => record.persuasao)?.id ?? minorities[0]?.id;

  return (
    <main>
      <section className="px-5 pb-20 pt-16 lg:px-8 lg:pt-24">
        <div className="mx-auto grid max-w-[1200px] items-end gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Audiências públicas · Câmara dos Deputados</p>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-7xl">Quem é ouvido quando o Legislativo <em className="font-serif font-normal text-orange-600">abre espaço</em> às minorias?</h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-zinc-600">
              Uma ferramenta para analisar qualquer audiência pública: quem fala, como argumenta e quem chega ao público. Aplicada às {health.lds_records} audiências do corpus, com um estudo de caso sobre as audiências de minorias.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#audiencias" className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600">Explorar audiências</Link>
              {example && <Link href={`/audiencias/${example}`} className="inline-flex items-center gap-1.5 px-2 py-2.5 text-sm font-semibold text-zinc-700 hover:text-zinc-950">Ver um exemplo <ArrowRight className="size-4"/></Link>}
            </div>
          </div>
          <figure className="border-t-2 border-zinc-900 pt-5">
            <p className="text-7xl font-semibold tracking-[-0.05em] text-orange-600">{silenciados ?? "–"}%</p>
            <figcaption className="mt-3 text-sm leading-6 text-zinc-600">de quem fala numa audiência <strong className="text-zinc-900">não aparece na matéria</strong> da Agência Câmara sobre ela.</figcaption>
            <p className="mt-4 text-[11px] leading-5 text-zinc-400">{corpus.silenciados.toLocaleString("pt-BR")} de {corpus.falantes.toLocaleString("pt-BR")} falantes no corpus, pelos dados de cobertura.</p>
          </figure>
        </div>
      </section>

      <section className="border-t border-zinc-200 px-5 py-20 lg:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">O artigo</p>
          <div>
            <p className="max-w-3xl font-serif text-3xl italic leading-snug text-zinc-900 sm:text-4xl">“Como deliberam as audiências públicas sobre minorias, e como essa deliberação chega ao público?”</p>
            <p className="mt-8 max-w-2xl text-base leading-8 text-zinc-600">Quando o Legislativo abre espaço formal para grupos historicamente vulnerabilizados, essa arena funciona como as outras audiências? O trabalho acompanha o caminho das <strong className="text-zinc-900">audiências sobre minorias</strong> até a <strong className="text-zinc-900">dinâmica deliberativa</strong> e, por fim, até a <strong className="text-zinc-900">representação na cobertura institucional</strong>, comparando esse recorte com as demais audiências.</p>
            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600">A ferramenta não depende do tema: transcrição, opiniões, deliberação e cobertura funcionam para qualquer audiência. O recorte de minorias é o estudo de caso em que os resultados estão sendo validados; levar a validação a outros temas fica como trabalho futuro.</p>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200 px-5 py-20 lg:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Hipóteses</p>
          <div>
            <ol className="grid gap-x-12 sm:grid-cols-2">
              {hypotheses.map((hypothesis, index) => (
                <li key={index} className="flex gap-5 border-t border-zinc-200 py-6">
                  <span className="font-serif text-3xl italic leading-none text-orange-600">H{index + 1}</span>
                  <p className="text-base leading-7 text-zinc-800">{hypothesis}</p>
                </li>
              ))}
            </ol>
            <p className="border-t border-zinc-200 pt-6 text-sm text-zinc-500">E uma pergunta aberta: quais são as principais características argumentativas dessas audiências?</p>
            <Link href="/comparacao" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-800 hover:text-orange-700">Ver os resultados na comparação minorias × demais <ArrowRight className="size-4"/></Link>
          </div>
        </div>
      </section>

      <section className="bg-zinc-900 px-5 py-20 text-white lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-center text-3xl font-semibold tracking-[-0.03em]">Metodologia</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-zinc-400">Cada etapa vira uma visualização. Todo resultado aponta de volta para a fala que o sustenta.</p>
          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {methods.map(({ icon: Icon, title, text, view }) => (
              <div key={title} className="flex flex-col items-center text-center">
                <Icon className="size-10 text-orange-400" strokeWidth={1.5}/>
                <h3 className="mt-4 text-base font-semibold">{title}</h3>
                <p className="mt-2 max-w-[280px] text-sm leading-6 text-zinc-400">{text}</p>
                {view && example
                  ? <Link href={`/audiencias/${example}/${view}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-orange-400 hover:text-orange-300">Ver visualização <ArrowRight className="size-3.5"/></Link>
                  : <span className="mt-3 text-xs text-zinc-500">Em construção</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="audiencias" className="px-5 py-20 lg:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Recorte de minorias</p>
            <p className="mt-3 text-sm leading-6 text-zinc-500">{minorities.length} audiências convocadas sobre pautas de minorias, em {categorias.length} categorias que podem se sobrepor.</p>
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              {categorias.map(([categoria, total]) => (
                <Link key={categoria} href={`/audiencias?categoria=${encodeURIComponent(categoria)}`} className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-sm text-zinc-700 transition hover:border-orange-300 hover:text-zinc-950">
                  {categoria}<span className="font-mono text-xs text-zinc-400">{total}</span>
                </Link>
              ))}
            </div>

            <p className="mb-2 mt-10 text-xs font-semibold uppercase tracking-wider text-zinc-500">Com análise de persuasão</p>
            <ul className="divide-y divide-zinc-200 border-y border-zinc-200">
              {destaques.map((record) => (
                <li key={record.id}>
                  <Link href={`/audiencias/${record.id}`} className="group flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:gap-4">
                    <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-orange-600 sm:w-48">{record.categorias[0] ?? "Minorias"}</span>
                    <span className="flex-1 text-sm font-medium text-zinc-800 group-hover:text-zinc-950">{record.assunto}</span>
                    <ArrowRight className="hidden size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-orange-500 sm:block"/>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              <Link href="/audiencias?grupo=M" className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-800 hover:text-orange-700">Ver as {minorities.length} audiências do recorte <ArrowRight className="size-4"/></Link>
              <Link href="/audiencias" className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-950">Todas as {health.lds_records} audiências <ArrowRight className="size-4"/></Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
