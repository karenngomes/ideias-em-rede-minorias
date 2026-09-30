import { ConversationRelationsView } from "@/components/relacoes/conversation-relations-view";
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
  return (
    <>
      <TurnWorkspace bundle={bundle} persuasao={persuasao} loadAudit={loadAudit}/>
      {relations && (
        <section className="px-5 pb-12 lg:px-8">
          <div className="mx-auto max-w-[1200px]">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Relações entre falas</p>
            <p className="mb-4 max-w-3xl text-sm leading-6 text-[#666666]">Análise do David: um modelo de linguagem, com apoio de embeddings, identifica como cada fala reage às anteriores (responde, questiona, concorda, discorda, retoma…), inclusive falas distantes. Usa os trechos da API, não os turnos acima. <span className="rounded bg-orange-50 px-1 text-[9px] font-bold uppercase text-orange-700">via LLM</span></p>
            <ConversationRelationsView data={relations}/>
          </div>
        </section>
      )}
    </>
  );
}
