import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { extractDate, firstLine, getAudiencias } from "@/lib/api-server";
import { getCategoriasMinoria, getIndice } from "@/lib/thalia-data";

const PAGE_SIZE = 20;

export const metadata: Metadata = { title: "Audiências | Karkará · Ideias em Rede" };

type Query = { page?: string; grupo?: string; categoria?: string };

export default async function AudienciasPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const [indice, categoriasPorId] = await Promise.all([getIndice(), getCategoriasMinoria()]);
  const todas = Array.from(indice.values()).sort((a, b) => a.sample_id - b.sample_id);
  const contagemCategorias = Array.from(Array.from(categoriasPorId.values()).flat().reduce((map, categoria) => map.set(categoria, (map.get(categoria) ?? 0) + 1), new Map<string, number>())).sort((a, b) => b[1] - a[1]);
  const grupo = query.grupo === "M" || query.grupo === "C" ? query.grupo : query.categoria ? "M" : undefined;
  const categoria = query.categoria && contagemCategorias.some(([nome]) => nome === query.categoria) ? query.categoria : undefined;

  const filtros = (
    <div className="mx-auto mt-10 max-w-4xl space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <FilterLink href="/audiencias" active={!grupo}>Todas <span>{todas.length}</span></FilterLink>
        <FilterLink href="/audiencias?grupo=M" active={grupo === "M" && !categoria}>Minorias <span>{todas.filter((a) => a.grupo === "M").length}</span></FilterLink>
        <FilterLink href="/audiencias?grupo=C" active={grupo === "C"}>Demais <span>{todas.filter((a) => a.grupo === "C").length}</span></FilterLink>
      </div>
      {grupo === "M" && (
        <div className="flex flex-wrap gap-2 text-xs">
          {contagemCategorias.map(([nome, total]) => (
            <FilterLink key={nome} href={`/audiencias?categoria=${encodeURIComponent(nome)}`} active={categoria === nome} small>{nome} <span>{total}</span></FilterLink>
          ))}
        </div>
      )}
    </div>
  );

  // Com filtro: lista a partir do índice da Thalia, sem paginação.
  if (grupo) {
    const lista = todas.filter((a) => a.grupo === grupo && (!categoria || (categoriasPorId.get(a.sample_id) ?? []).includes(categoria)));
    return (
      <main className="px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <Header title={categoria ?? (grupo === "M" ? "Audiências sobre minorias" : "Demais audiências")} subtitle={`${lista.length} audiências${categoria ? " nesta categoria" : grupo === "M" ? " convocadas sobre pautas de minorias (grupo M)" : " fora do recorte de minorias (grupo C)"}.`}/>
          {filtros}
          <ul className="mx-auto mt-8 max-w-4xl divide-y divide-zinc-200 border-y border-zinc-200">
            {lista.map((audiencia) => (
              <Row key={audiencia.sample_id} id={audiencia.sample_id} title={audiencia.assunto} meta={[audiencia.tema, `${audiencia.n_opinioes} opiniões`]} tag={(categoriasPorId.get(audiencia.sample_id) ?? []).join(" · ")}/>
            ))}
          </ul>
        </div>
      </main>
    );
  }

  const requested = Number(query.page ?? "1");
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;
  const audiencias = await getAudiencias(page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(audiencias.total / PAGE_SIZE));

  return (
    <main className="px-5 py-16 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        <Header title="Audiências" subtitle={`${audiencias.total} audiências públicas da Câmara dos Deputados.`}/>
        {filtros}
        <ul className="mx-auto mt-8 max-w-4xl divide-y divide-zinc-200 border-y border-zinc-200">
          {audiencias.items.map((audiencia) => (
            <Row
              key={audiencia.id}
              id={audiencia.id}
              title={audiencia.metadados.assunto || firstLine(audiencia.materia)}
              meta={[extractDate(audiencia.materia), `${audiencia.metadados.envolvidos.length} participantes`, `${(audiencia.chunk_count ?? 0).toLocaleString("pt-BR")} trechos`]}
              tag={(categoriasPorId.get(audiencia.id) ?? []).join(" · ")}
            />
          ))}
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

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h1 className="text-center text-4xl font-semibold tracking-[-0.035em]">{title}</h1>
      <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-zinc-500">{subtitle}</p>
    </>
  );
}

function FilterLink({ href, active, small = false, children }: { href: string; active: boolean; small?: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`inline-flex items-center gap-2 rounded-full border ${small ? "px-3 py-1" : "px-3.5 py-1.5"} transition [&>span]:font-mono [&>span]:text-[0.85em] ${active ? "border-ink bg-ink text-white [&>span]:text-white/60" : "border-zinc-200 bg-white text-zinc-700 hover:border-orange-300 hover:text-zinc-950 [&>span]:text-zinc-400"}`}>
      {children}
    </Link>
  );
}

function Row({ id, title, meta, tag }: { id: number; title: string; meta: Array<string | undefined>; tag?: string }) {
  return (
    <li>
      <Link href={`/audiencias/${id}`} className="group flex gap-4 py-5">
        <span className="w-10 shrink-0 pt-0.5 font-mono text-xs text-zinc-400">#{id}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-900 group-hover:text-orange-700">{title}</span>
          <span className="mt-1 block text-xs text-zinc-500">
            {meta.filter(Boolean).join(" · ")}
            {tag && <span className="ml-2 font-semibold text-orange-600">{tag}</span>}
          </span>
        </span>
        <ArrowRight className="mt-0.5 hidden size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-orange-500 sm:block"/>
      </Link>
    </li>
  );
}
