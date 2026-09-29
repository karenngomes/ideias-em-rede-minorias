import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { hypotheses, loadHomeData, Methodology, MinorityList } from "@/components/home/shared";
import { getClassifiedRecords, getHighlightedExcerpt, getSummary } from "@/lib/api-server";
import { superclassNames } from "@/lib/persuasion";

const path = [
  { step: "Audiências sobre minorias", text: "Quem ocupa o espaço aberto pelo Legislativo: parlamentares, convidados e sociedade civil.", hypotheses: [] as number[] },
  { step: "Dinâmica deliberativa", text: "Como o debate acontece: interrupções, respeito e técnicas de persuasão.", hypotheses: [0, 1, 2] },
  { step: "Cobertura institucional", text: "Quem chega ao público na matéria da Agência Câmara.", hypotheses: [3] },
];

export default async function PreviewB() {
  const { health, minorities, example } = await loadHomeData();
  const classified = await getClassifiedRecords();
  const first = classified.items.find((record) => record.id === minorities.find((item) => item.persuasao)?.id);
  const jobId = first?.runs[0]?.job_id;
  const excerpt = first && jobId
    ? await getSummary(jobId).then((summary) => getHighlightedExcerpt(first.id, jobId, summary.parlamentares))
    : null;

  return (
    <main>
      <section className="bg-zinc-900 px-5 py-16 text-white lg:px-8 lg:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-sm text-zinc-400">Ideias em Rede · leia as audiências públicas pelo que foi dito</p>
          {excerpt && (
            <blockquote className="mt-10 max-w-4xl">
              <p className="text-2xl leading-[1.6] text-zinc-400 sm:text-3xl sm:leading-[1.6]">
                {excerpt.before}
                <mark className="relative rounded bg-orange-500/20 px-1 text-white decoration-orange-400 decoration-2 underline underline-offset-8">{excerpt.highlight}</mark>
                {excerpt.after}
              </p>
              <footer className="mt-8 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold text-white">{excerpt.speaker}</span>
                <span className="text-zinc-500">convidada(o) · audiência #{first?.id}</span>
                <span className="rounded-md bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">{superclassNames[excerpt.superclass] ?? excerpt.superclass}</span>
              </footer>
            </blockquote>
          )}
          <div className="mt-14 flex flex-col gap-6 border-t border-white/10 pt-8 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Como deliberam as audiências públicas sobre minorias, e como isso chega ao público?</h1>
            <Link href="#audiencias" className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-orange-100 sm:self-auto">Explorar audiências <ArrowRight className="size-4"/></Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">O caminho da pesquisa</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">Comparamos {minorities.length} audiências sobre minorias com as demais {health.lds_records - minorities.length} audiências do corpus.</p>
          <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-0">
            {path.map((item, index) => (
              <li key={item.step} className="relative md:pr-10">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full border-2 border-orange-500 text-sm font-semibold text-orange-600">{index + 1}</span>
                  {index < path.length - 1 && <span className="hidden h-0.5 flex-1 bg-gradient-to-r from-orange-300 to-transparent md:block"/>}
                </div>
                <h3 className="mt-5 text-lg font-semibold">{item.step}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.text}</p>
                {item.hypotheses.map((hypothesis) => (
                  <p key={hypothesis} className="mt-3 border-l-2 border-orange-300 pl-3 text-sm leading-6 text-zinc-800"><strong className="text-orange-600">H{hypothesis + 1}</strong> {hypotheses[hypothesis]}</p>
                ))}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Methodology example={example}/>

      <section id="audiencias" className="px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="mb-6 text-2xl font-semibold tracking-[-0.03em]">Recorte de minorias</h2>
          <MinorityList minorities={minorities}/>
          <Link href="/audiencias" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700 hover:text-zinc-950">Ver todas as {health.lds_records} audiências <ArrowRight className="size-4"/></Link>
        </div>
      </section>
    </main>
  );
}
