import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { hypotheses, loadHomeData, Methodology, MinorityList } from "@/components/home/shared";
import { getCoberturaResumo } from "@/lib/conteudo-data";

export default async function PreviewA() {
  const { health, minorities, example } = await loadHomeData();
  // Parte das palavras faladas por convidados em cada audiência do recorte (cobertura.json, com a mesa).
  const shares = (await Promise.all(minorities.map(async (record) => ({ ...record, civil: await getCoberturaResumo(record.id) }))))
    .filter((row): row is typeof row & { civil: number } => row.civil != null)
    .sort((a, b) => b.civil - a.civil);

  return (
    <main className="bg-white">
      <section className="px-5 py-16 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-2">
          <div>
            <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">Audiências públicas × minorias</span>
            <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Ideias em Rede</h1>
            <p className="mt-5 text-lg leading-8 text-zinc-600">Uma ferramenta para ver como deliberam as audiências da Câmara sobre minorias: quem fala, como argumenta e quem chega ao público.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#audiencias" className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">Explorar audiências</Link>
              {example && <Link href={`/audiencias/${example}`} className="rounded-lg border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-800 hover:border-zinc-300">Ver um exemplo</Link>}
            </div>
            <dl className="mt-12 flex divide-x divide-zinc-200">
              <div className="pr-6"><dt className="text-xs text-zinc-500">Audiências</dt><dd className="text-2xl font-semibold">{health.lds_records}</dd></div>
              <div className="px-6"><dt className="text-xs text-zinc-500">Trechos de fala</dt><dd className="text-2xl font-semibold">{health.transcript_chunks.toLocaleString("pt-BR")}</dd></div>
              <div className="pl-6"><dt className="text-xs text-zinc-500">No recorte</dt><dd className="text-2xl font-semibold">{minorities.length}</dd></div>
            </dl>
          </div>

          <figure className="rounded-2xl bg-zinc-50 p-6">
            <figcaption className="mb-1 text-sm font-semibold text-zinc-900">Quem fala nas audiências do recorte</figcaption>
            <p className="mb-5 text-xs text-zinc-500">Parte das palavras de cada uma das {shares.length} audiências sobre minorias</p>
            <div className="space-y-[3px]">
              {shares.map((row) => {
                const guests = Math.round(row.civil * 100);
                return (
                  <Link key={row.id} href={`/audiencias/${row.id}`} className="flex h-[7px] overflow-hidden rounded-sm hover:opacity-80" title={`${row.assunto}: ${guests}% das palavras de convidados`}>
                    <span className="bg-zinc-800" style={{ width: `${100 - guests}%` }}/>
                    <span className="bg-orange-400" style={{ width: `${guests}%` }}/>
                  </Link>
                );
              })}
            </div>
            <div className="mt-5 flex gap-5 text-xs text-zinc-600">
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-zinc-800"/>Parlamentares</span>
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-orange-400"/>Convidados</span>
            </div>
          </figure>
        </div>
      </section>

      <section className="bg-zinc-50 px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">O que o artigo investiga</h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-600">Quando o Legislativo abre espaço formal para grupos historicamente vulnerabilizados, essa arena funciona como as outras audiências? Comparamos o recorte de minorias com as demais audiências a partir de quatro hipóteses.</p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2">
            {hypotheses.map((text, index) => (
              <li key={index} className="flex gap-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-orange-500 text-sm font-semibold text-white">{index + 1}</span>
                <p className="pt-1 text-sm leading-6 text-zinc-700">{text}</p>
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
