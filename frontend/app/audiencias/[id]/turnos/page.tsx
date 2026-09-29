import { TurnWorkspace } from "@/components/turnos/turn-workspace";
import { getAudienciaBundle } from "@/lib/thalia-data";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getAudienciaBundle(Number(id));
  if (!bundle) {
    return (
      <section className="px-5 py-12 lg:px-8">
        <p className="mx-auto max-w-[1200px] rounded-2xl border border-black/10 bg-white p-8 text-center text-sm text-[#666666]">Não há dados de turnos, opiniões e deliberação para esta audiência.</p>
      </section>
    );
  }
  return <TurnWorkspace bundle={bundle}/>;
}
