import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { hypotheses, loadHomeData, Methodology } from "@/components/home/shared";

export default async function PreviewC() {
  const { health, minorities, example } = await loadHomeData();
  const groups = Array.from(
    minorities.reduce((map, record) => map.set(record.group, [...(map.get(record.group) ?? []), record]), new Map<string, typeof minorities>()),
  );

  return (
    <main>
      <section className="bg-orange-500 px-5 py-16 text-white lg:px-8 lg:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-sm font-semibold text-orange-100">Ideias em Rede</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-bold leading-[1.02] tracking-[-0.05em] sm:text-7xl">Audiências públicas, lidas voz por voz.</h1>
          <div className="mt-10 grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <p className="max-w-xl text-lg leading-8 text-orange-50">Como deliberam as audiências da Câmara sobre minorias, e como essa deliberação chega ao público?</p>
            <Link href="#grupos" className="inline-flex items-center gap-2 self-start rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800 sm:self-auto">Começar <ArrowRight className="size-4"/></Link>
          </div>
        </div>
      </section>

      <section id="grupos" className="px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">Escolha um grupo</h2>
            <Link href="/audiencias" className="text-sm font-semibold text-zinc-600 hover:text-zinc-950">ou veja as {health.lds_records} audiências →</Link>
          </div>
          <div className="divide-y divide-zinc-200 border-y border-zinc-200">
            {groups.map(([group, records]) => (
              <div key={group} className="grid gap-4 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                <h3 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{group}</h3>
                <ul className="space-y-2">
                  {records.map((record) => (
                    <li key={record.id}>
                      <Link href={`/audiencias/${record.id}/argumentacao`} className="group flex items-start justify-between gap-3 text-sm leading-6 text-zinc-700 hover:text-zinc-950">
                        <span>{record.assunto}</span>
                        <ArrowUpRight className="mt-1 size-4 shrink-0 text-zinc-300 group-hover:text-orange-500"/>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-orange-50 px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">O que esperamos encontrar</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">Quando o Legislativo abre espaço formal para grupos historicamente vulnerabilizados, essa arena funciona como as outras audiências?</p>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-orange-200 sm:grid-cols-2">
            {hypotheses.map((text, index) => (
              <li key={index} className="bg-orange-50 p-6">
                <span className="text-4xl font-bold tracking-[-0.05em] text-orange-500">{index + 1}</span>
                <p className="mt-3 text-base leading-7 text-zinc-800">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Methodology example={example}/>
    </main>
  );
}
