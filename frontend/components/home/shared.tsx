import Link from "next/link";
import { ArrowRight, FileText, Megaphone, Network, Newspaper, Quote, Scale } from "lucide-react";
import { getHealth } from "@/lib/api-server";
import { getMinorityAudiences } from "@/lib/minorities";

export const hypotheses = [
  "Convidados são mais interrompidos que parlamentares, sobretudo nas audiências de minorias.",
  "Nas audiências de minorias, as justificativas apelam mais ao bem comum sensível à diferença e menos ao interesse de grupo.",
  "O nível de justificação das falas é diferente entre os dois grupos.",
  "Há mais elogio explícito e mais hostilidade nas audiências de minorias, sem mudar a média de respeito.",
  "As técnicas de persuasão se distribuem de forma diferente entre os grupos.",
];

const methods = [
  { icon: FileText, title: "Sumarização ancorada", text: "Resumos em que cada frase aponta para a fala original.", view: "turnos" },
  { icon: Quote, title: "Extração de opiniões", text: "O que cada participante defendeu, ligado ao turno de fala.", view: "turnos" },
  { icon: Newspaper, title: "Análise de cobertura", text: "Quem falou na sessão × quem a matéria citou.", view: "turnos" },
  { icon: Megaphone, title: "Técnicas de persuasão", text: "Seis técnicas por parágrafo, comparadas com anotação humana.", view: "turnos" },
  { icon: Network, title: "Rede de interação", text: "Quem falou depois de quem e quem concedeu a palavra.", view: "turnos" },
  { icon: Scale, title: "Qualidade deliberativa", text: "Sete indicadores do DQI, como justificação e respeito.", view: "turnos" },
];

export type MinorityRecord = Awaited<ReturnType<typeof loadHomeData>>["minorities"][number];

export async function loadHomeData() {
  const [health, minorities] = await Promise.all([getHealth(), getMinorityAudiences()]);
  return { health, minorities, example: minorities.find((record) => record.persuasao)?.id ?? minorities[0]?.id };
}

export function Methodology({ example }: { example?: number }) {
  return (
  <section className="bg-zinc-900 px-5 py-20 text-white lg:px-8">
    <div className="mx-auto max-w-[1200px]">
      <h2 className="text-center text-3xl font-semibold tracking-[-0.03em]">Metodologia</h2>
      <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-zinc-400">Cada etapa vira uma visualização. Todo resultado aponta de volta para a fala que o sustenta.</p>
      <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {methods.map(({ icon: Icon, title, text, view }) => (
          <div key={title} className="flex flex-col items-center text-center">
            <Icon className="size-10 text-orange-400" strokeWidth={1.5}/>
            <h3 className="mt-4 text-base font-semibold">{title}</h3>
            <p className="mt-2 max-w-[280px] text-sm leading-6 text-zinc-400">{text}</p>
            {view && example
              ? <Link href={`/audiencias/${example}/${view}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-orange-400 hover:text-orange-300">Ver visualização <ArrowRight className="size-3.5"/></Link>
              : <span className="mt-3 text-xs text-zinc-500">Em construção</span>}
          </div>
        ))}
      </div>
    </div>
  </section>
  );
}

export function MinorityList({ minorities }: { minorities: MinorityRecord[] }) {
  return (
    <ul className="divide-y divide-zinc-200 border-y border-zinc-200">
      {minorities.map((record) => (
        <li key={record.id}>
          <Link href={`/audiencias/${record.id}`} className="group flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:gap-4">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-orange-600 sm:w-48">{record.group}</span>
            <span className="flex-1 text-sm font-medium text-zinc-800 group-hover:text-zinc-950">{record.assunto}</span>
            <ArrowRight className="hidden size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-orange-500 sm:block"/>
          </Link>
        </li>
      ))}
    </ul>
  );
}
