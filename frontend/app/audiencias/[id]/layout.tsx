import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText, Users } from "lucide-react";
import { AudienceNav } from "@/components/audience-nav";
import { extractDate, getAudiencia, getChunkCount, getClassifiedRecords } from "@/lib/api-server";
import { minorityGroupOf, PILOT_GROUP } from "@/lib/minorities";

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
  let chunkCount;
  let classified;
  try {
    [audiencia, chunkCount, classified] = await Promise.all([getAudiencia(id), getChunkCount(id), getClassifiedRecords()]);
  } catch {
    notFound();
  }

  const record = classified.items.find((item) => item.id === id);
  const group = record ? minorityGroupOf(record.runs.map((run) => run.experiments_tag)) : undefined;
  const date = extractDate(audiencia.materia);
  const lead = audiencia.materia.split("\n").filter((line) => line.trim()).slice(0, 2).join(" — ");

  return (
    <>
      <div className="px-5 pt-6 lg:px-8">
        <div className="mx-auto max-w-[1500px]">
          <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900"><ChevronLeft className="size-4"/>Voltar para audiências</Link>

          <section className="overflow-hidden rounded-3xl bg-zinc-900 px-6 py-8 text-white shadow-[0_20px_60px_rgba(24,24,27,0.18)] sm:px-10 sm:py-10">
            <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.14em]">
              <span className="rounded-md bg-orange-500 px-2.5 py-1 text-white">Audiência pública</span>
              <span className="rounded-md border border-white/15 px-2.5 py-1 text-zinc-300">#{audiencia.id}</span>
              {date && <span className="rounded-md border border-white/15 px-2.5 py-1 text-zinc-300">{date}</span>}
              {group && group !== PILOT_GROUP && <span className="rounded-md border border-orange-400/40 bg-orange-500/10 px-2.5 py-1 text-orange-300">Minorias · {group}</span>}
            </div>
            <h1 className="mt-6 max-w-5xl text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">{audiencia.metadados.assunto}</h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-zinc-300 sm:text-base">{lead}</p>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6 text-sm text-zinc-300">
              <span className="flex items-center gap-2"><Users className="size-4 text-orange-400"/><strong className="text-white">{audiencia.metadados.envolvidos.length}</strong> participantes identificados</span>
              <span className="flex items-center gap-2"><FileText className="size-4 text-orange-400"/><strong className="text-white">{chunkCount.toLocaleString("pt-BR")}</strong> trechos de fala</span>
            </div>
          </section>

          {audiencia.metadados.envolvidos.length > 0 && (
            <section className="py-8">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Pessoas</p>
              <h2 className="mb-4 text-2xl font-semibold tracking-[-0.03em]">Participantes destacados</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {audiencia.metadados.envolvidos.map((person, index) => (
                  <div key={`${person.nome}-${index}`} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-orange-50 text-sm font-bold text-orange-700">{person.nome.slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">{person.nome}</p>
                      <p className="truncate text-xs text-zinc-500" title={person.cargo}>{person.cargo || "Cargo não informado"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <AudienceNav id={audiencia.id}/>
      {children}
    </>
  );
}
