import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageSquare, Users } from "lucide-react";
import { extractDate, getAudiencia } from "@/lib/api-server";
import { getFalantes, getRotuloAudiencia } from "@/lib/thalia-data";

type Props = { children: React.ReactNode; params: Promise<{ id: string }> };

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Audiência #${id} | Ideias em Rede` };
}

export default async function AudienceLayout({ children, params }: Props) {
  const id = parseId((await params).id);
  if (!id) notFound();

  let audiencia;
  try {
    audiencia = await getAudiencia(id);
  } catch {
    notFound();
  }

  const [rotulo, falantes] = await Promise.all([getRotuloAudiencia(id), getFalantes(id)]);
  const falas = falantes?.reduce((total, falante) => total + falante.n_turnos, 0);
  const date = extractDate(audiencia.materia);
  const lead = audiencia.materia.split("\n").filter((line) => line.trim()).slice(0, 2).join(" — ");

  return (
    <>
      <div className="px-5 pt-6 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900"><ChevronLeft className="size-4"/>Voltar para audiências</Link>

          <section className="relative rounded-3xl bg-night px-6 py-8 text-white sm:px-10 sm:py-10" style={{ backgroundImage: "radial-gradient(60% 90% at 105% 20%, rgba(245,77,32,0.55), transparent 60%), radial-gradient(50% 80% at 95% 110%, rgba(52,75,127,0.7), transparent 65%)" }}>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.14em]">
              <span className="rounded-md bg-orange-500 px-2.5 py-1 text-white">Audiência pública</span>
              <span className="rounded-md border border-white/15 px-2.5 py-1 text-zinc-300">#{audiencia.id}</span>
              {date && <span className="rounded-md border border-white/15 px-2.5 py-1 text-zinc-300">{date}</span>}
              {rotulo?.grupo === "M" && <span className="rounded-md border border-orange-400/40 bg-orange-500/10 px-2.5 py-1 text-orange-300">Minorias · {rotulo.categorias.join(" · ")}</span>}
              {rotulo?.tema && <span className="rounded-md border border-white/15 px-2.5 py-1 text-zinc-300">{rotulo.tema}</span>}
            </div>
            <h1 className="mt-6 max-w-5xl text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">{audiencia.metadados.assunto}</h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-zinc-300 sm:text-base">{lead}</p>
            {falantes && (
              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6 text-sm text-zinc-300">
                <div className="group relative">
                  <button type="button" className="flex items-center gap-2 underline decoration-white/20 underline-offset-4 hover:decoration-white/60"><Users className="size-4 text-orange-400"/><strong className="text-white">{falantes.length}</strong> pessoas falaram</button>
                  <div className="invisible absolute left-0 top-full z-30 mt-2 max-h-80 w-80 overflow-y-auto rounded-xl bg-white p-3 text-ink opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <ul className="space-y-1.5 text-xs">
                      {falantes.map((falante) => (
                        <li key={falante.nome} className="flex items-baseline justify-between gap-3">
                          <span className="font-medium">{falante.nome}</span>
                          <span className="shrink-0 text-[#666666]">{falante.mesa ? "preside" : falante.parlamentar ? "parlamentar" : "convidado(a)"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <span className="flex items-center gap-2"><MessageSquare className="size-4 text-orange-400"/><strong className="text-white">{falas?.toLocaleString("pt-BR")}</strong> falas</span>
              </div>
            )}
          </section>

        </div>
      </div>

      {children}
    </>
  );
}
