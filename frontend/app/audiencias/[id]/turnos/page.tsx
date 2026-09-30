import { TurnWorkspace } from "@/components/turnos/turn-workspace";
import { fetchPersuasionAudit } from "./actions";
import { getConversationRelations, getPersuasionAnnotations } from "@/lib/api-server";
import { persuasaoPorTurno } from "@/lib/thalia";
import { getAudienciaBundle } from "@/lib/thalia-data";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [bundle, persuasion, relations] = await Promise.all([
    getAudienciaBundle(id),
    getPersuasionAnnotations(id).catch(() => null),
    getConversationRelations(id).catch(() => null),
  ]);
  if (!bundle) {
    return (
      <section className="px-5 py-12 lg:px-8">
        <p className="mx-auto max-w-[1200px] rounded-2xl border border-black/10 bg-white p-8 text-center text-sm text-[#666666]">Não há dados de turnos, opiniões e deliberação para esta audiência.</p>
      </section>
    );
  }
  const persuasao = persuasion ? { tag: persuasion.tag, ...persuasaoPorTurno(bundle.turnos, persuasion.annotations) } : null;
  const loadAudit = persuasion ? fetchPersuasionAudit.bind(null, id, persuasion.jobId) : undefined;
  return <TurnWorkspace bundle={bundle} persuasao={persuasao} loadAudit={loadAudit} relations={relations}/>;
}
