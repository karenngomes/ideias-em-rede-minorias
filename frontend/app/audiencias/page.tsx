import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { extractDate, firstLine, getAudiencias, getClassifiedRecords } from "@/lib/api-server";
import { minorityGroupOf, PILOT_GROUP } from "@/lib/minorities";

const PAGE_SIZE = 20;

export const metadata: Metadata = { title: "Audiências | Ideias em Rede" };

export default async function AudienciasPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const query = await searchParams;
  const requested = Number(query.page ?? "1");
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;
  const [audiencias, classified] = await Promise.all([getAudiencias(page, PAGE_SIZE), getClassifiedRecords()]);
  const groups = new Map(classified.items.map((record) => [record.id, minorityGroupOf(record.runs.map((run) => run.experiments_tag))]));
  const totalPages = Math.max(1, Math.ceil(audiencias.total / PAGE_SIZE));

  return (
    <main className="px-5 py-16 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        <h1 className="text-center text-4xl font-semibold tracking-[-0.035em]">Audiências</h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-zinc-500">{audiencias.total} audiências públicas da Câmara dos Deputados.</p>

        <ul className="mx-auto mt-12 max-w-4xl divide-y divide-zinc-200 border-y border-zinc-200">
          {audiencias.items.map((audiencia) => {
            const group = groups.get(audiencia.id);
            return (
              <li key={audiencia.id}>
                <Link href={`/audiencias/${audiencia.id}`} className="group flex gap-4 py-5">
                  <span className="w-10 shrink-0 pt-0.5 font-mono text-xs text-zinc-400">#{audiencia.id}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-zinc-900 group-hover:text-orange-700">{audiencia.metadados.assunto || firstLine(audiencia.materia)}</span>
                    <span className="mt-1 block text-xs text-zinc-500">
                      {[extractDate(audiencia.materia), `${audiencia.metadados.envolvidos.length} participantes`, `${(audiencia.chunk_count ?? 0).toLocaleString("pt-BR")} trechos`].filter(Boolean).join(" · ")}
                      {group && group !== PILOT_GROUP && <span className="ml-2 font-semibold text-orange-600">{group}</span>}
                    </span>
                  </span>
                  <ArrowRight className="mt-0.5 hidden size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-orange-500 sm:block"/>
                </Link>
              </li>
            );
          })}
        </ul>

        <nav aria-label="Paginação" className="mt-8 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? <Link href={`/audiencias?page=${page - 1}`} className="font-semibold text-zinc-700 hover:text-zinc-950">← Anterior</Link> : <span className="text-zinc-300">← Anterior</span>}
          <span className="text-zinc-500">{page} de {totalPages}</span>
          {page < totalPages ? <Link href={`/audiencias?page=${page + 1}`} className="font-semibold text-zinc-700 hover:text-zinc-950">Próxima →</Link> : <span className="text-zinc-300">Próxima →</span>}
        </nav>
      </div>
    </main>
  );
}
