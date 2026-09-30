import Link from "next/link";
import { ArrowRight, FileText, Megaphone, Network, Newspaper, Quote, Scale } from "lucide-react";
import { getHealth } from "@/lib/api-server";
import { getMinorityAudiences } from "@/lib/minorities";

const hypotheses = [
  "Convidados são interrompidos com mais frequência que parlamentares.",
  "Há mais elogio explícito e mais hostilidade, mas a média de respeito não muda.",
  "Chamada à ação e linguagem carregada aparecem mais, sobretudo na sociedade civil.",
  "A sociedade civil fala mais do que aparece na matéria da Agência Câmara.",
];

const methods = [
  { icon: FileText, title: "Sumarização ancorada", text: "Resumos em que cada frase aponta para a fala original.", view: "turnos" },
  { icon: Quote, title: "Extração de opiniões", text: "O que cada participante defendeu, ligado ao turno de fala." },
  { icon: Newspaper, title: "Análise de cobertura", text: "Quem falou na sessão × quem a matéria citou." },
  { icon: Megaphone, title: "Técnicas de persuasão", text: "Seis técnicas por parágrafo, comparadas com anotação humana.", view: "argumentacao" },
  { icon: Network, title: "Rede de interação", text: "Quem falou depois de quem e quem concedeu a palavra.", view: "turnos" },
  { icon: Scale, title: "Qualidade deliberativa", text: "Sete indicadores do DQI, como justificação e respeito." },
];

export default async function PreviewD() {
  const [health, minorities] = await Promise.all([getHealth(), getMinorityAudiences()]);
  const example = minorities.find((record) => record.persuasao)?.id ?? minorities[0]?.id;

  return (
    <main>
      <section className="bg-zinc-900 px-5 py-20 text-center text-white lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <h1 className="text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">Ideias em Rede</h1>
          <p className="mt-5 text-xl text-orange-400">Como deliberam as audiências públicas sobre minorias?</p>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-zinc-300">
            {health.lds_records} audiências da Câmara dos Deputados e {health.transcript_chunks.toLocaleString("pt-BR")} trechos de fala para entender quem argumenta, como argumenta e quem chega ao público.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="#audiencias" className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400">Explorar audiências</Link>
            {example && <Link href={`/audiencias/${example}/argumentacao`} className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/40">Ver um exemplo</Link>}
          </div>

          <div className="mx-auto mt-16 max-w-4xl border border-white/10 border-l-4 border-l-orange-500 px-8 py-8 text-left text-base leading-8 text-zinc-300">
            <p>Quando o Legislativo abre espaço formal para grupos historicamente vulnerabilizados, essa arena funciona da mesma forma que as outras audiências?</p>
            <p className="mt-4">O trabalho acompanha o caminho das <strong className="text-white">audiências sobre minorias</strong> até a <strong className="text-white">dinâmica deliberativa</strong> e, por fim, até a <strong className="text-white">representação na cobertura institucional</strong>, comparando esse recorte com as demais audiências.</p>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-center text-3xl font-semibold tracking-[-0.03em]">Hipóteses</h2>
          <ol className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
            <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-0.5 bg-orange-200 md:block"/>
            {hypotheses.map((hypothesis, index) => (
              <li key={index} className="relative flex flex-col items-center text-center">
                <span className="grid size-14 place-items-center rounded-full bg-orange-500 text-lg font-semibold text-white ring-8 ring-white">{index + 1}</span>
                <p className="mt-5 max-w-[240px] text-sm font-medium leading-6 text-zinc-700">{hypothesis}</p>
              </li>
            ))}
          </ol>
          <p className="mt-14 text-center text-sm text-zinc-500">E uma pergunta aberta: quais são as principais características argumentativas dessas audiências?</p>
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

      <section id="audiencias" className="bg-paper px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-center text-3xl font-semibold tracking-[-0.03em]">Recorte de minorias</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-zinc-500">{minorities.length} audiências convocadas sobre pautas de minorias, {minorities.filter((record) => record.persuasao).length} delas com as técnicas de persuasão classificadas.</p>
          <ul className="mx-auto mt-12 max-w-4xl divide-y divide-zinc-200 border-y border-zinc-200">
            {minorities.map((record) => (
              <li key={record.id}>
                <Link href={`/audiencias/${record.id}`} className="group flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-orange-600 sm:w-48">{record.group}</span>
                  <span className="flex-1 text-sm font-medium text-zinc-800 group-hover:text-zinc-950">{record.assunto}</span>
                  <ArrowRight className="hidden size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-orange-500 sm:block"/>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-10 text-center">
            <Link href="/audiencias" className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700 hover:text-zinc-950">Ver todas as {health.lds_records} audiências <ArrowRight className="size-4"/></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
