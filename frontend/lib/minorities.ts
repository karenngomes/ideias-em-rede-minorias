// Recorte de minorias a partir da rotulagem da Thalia (dados/conteudo/dados/rotulos).
// O grupo M reúne as audiências convocadas sobre pautas de grupos historicamente
// vulnerabilizados; as categorias não são exclusivas.
import { getClassifiedRecords } from "@/lib/api-server";
import { getCategoriasMinoria, getIndice } from "@/lib/thalia-data";

export type MinorityAudience = {
  id: number;
  assunto: string;
  tema: string;
  categorias: string[];
  group: string;
  persuasao: boolean;
};

export async function getMinorityAudiences(): Promise<MinorityAudience[]> {
  const [indice, categorias, classified] = await Promise.all([
    getIndice(),
    getCategoriasMinoria(),
    getClassifiedRecords().catch(() => ({ items: [] })),
  ]);
  const withPersuasion = new Set(classified.items.map((record) => record.id));
  return Array.from(indice.values())
    .filter((item) => item.grupo === "M")
    .sort((a, b) => a.sample_id - b.sample_id)
    .map((item) => {
      const cats = categorias.get(item.sample_id) ?? [];
      return { id: item.sample_id, assunto: item.assunto, tema: item.tema, categorias: cats, group: cats.join(" · ") || "Minorias", persuasao: withPersuasion.has(item.sample_id) };
    });
}
