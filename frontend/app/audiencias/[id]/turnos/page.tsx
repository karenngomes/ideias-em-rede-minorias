import { DemoNotice } from "@/components/demo-notice";
import { TurnWorkspace } from "@/components/turnos/turn-workspace";

export default function Page() {
  return (
    <>
      <DemoNotice>
        <strong>Audiência simulada.</strong> Esta tela mostra uma audiência fictícia (nº 901) no formato dos dados de turnos, opiniões, DQI, cobertura, grafo e resumo. Ela vale para qualquer audiência até os dados reais serem integrados.
      </DemoNotice>
      <TurnWorkspace/>
    </>
  );
}
