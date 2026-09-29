"use client";

import { arestas, codigos, opinioes, parlamentares, participantes, temaCores, turnos, type Opiniao } from "@/lib/thalia";

export type ChartMode = "posicoes" | "interacao";

const WIDTH = 820;
const LABEL = 170;
const ROW = 50;
const TOP = 18;

export function TurnChart({ mode, turn, selected, onSelect, onTurn }: {
  mode: ChartMode;
  turn: number;
  selected?: string;
  onSelect: (opiniao: Opiniao) => void;
  onTurn: (turn: number) => void;
}) {
  const total = turnos.length;
  const height = TOP + participantes.length * ROW + 34;
  const x = (t: number) => LABEL + ((t - 1) / Math.max(1, total - 1)) * (WIDTH - LABEL - 24);
  const y = (nome: string) => TOP + participantes.indexOf(nome) * ROW + ROW / 2;
  const current = turnos[turn - 1];
  const interrupted = new Set(codigos.filter((codigo) => codigo.dimensao === "participacao" && codigo.rotulo === "interrompido").map((codigo) => codigo.turno_id));
  const opinionById = new Map(opinioes.map((opiniao) => [opiniao.id, opiniao]));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full select-none" role="img" aria-label={mode === "posicoes" ? "Mapa de posições ao longo dos turnos" : "Rede de interação ao longo dos turnos"}>
      <rect x={x(turn) + 6} y={TOP - 6} width={Math.max(0, WIDTH - 24 - x(turn))} height={participantes.length * ROW + 6} fill="#f0f0f0" opacity={0.7}/>

      {participantes.map((nome) => {
        const active = current?.falante_norm === nome;
        return (
          <g key={nome}>
            <line x1={LABEL - 8} x2={WIDTH - 24} y1={y(nome)} y2={y(nome)} stroke={active ? "#1c2127" : "#e4e4e4"} strokeWidth={active ? 1.2 : 1}/>
            <text x={LABEL - 16} y={y(nome) + 4} textAnchor="end" fontSize={11} fontWeight={active ? 700 : 500} fill={active ? "#1c2127" : "#666666"}>{nome.replace(/^Deputad[oa] /, "")}</text>
            <circle cx={12} cy={y(nome)} r={3.5} fill={parlamentares.has(nome) ? "#1c2127" : "#ff4b3e"}/>
          </g>
        );
      })}

      {mode === "interacao" && (
        <>
          <polyline
            fill="none" stroke="#c9c9c9" strokeWidth={1.2}
            points={turnos.filter((t) => t.turno_id <= turn).map((t) => `${x(t.turno_id)},${y(t.falante_norm)}`).join(" ")}
          />
          {arestas.filter((aresta) => aresta.tipo === "concede_palavra" && (aresta.dados.turno_id ?? 0) <= turn).map((aresta) => {
            const from = aresta.origem.replace("p::", "");
            const to = aresta.destino.replace("p::", "");
            const t = aresta.dados.turno_id ?? 1;
            const x1 = x(t), y1 = y(from), x2 = x(t + 1), y2 = y(to);
            return <path key={`${t}-${to}`} d={`M${x1},${y1} C${x1 + 30},${y1} ${x2 - 30},${y2} ${x2},${y2}`} fill="none" stroke="#ff4b3e" strokeWidth={2} markerEnd="url(#arrow)"/>;
          })}
          {turnos.map((t) => {
            const visible = t.turno_id <= turn;
            return (
              <g key={t.turno_id} onClick={() => onTurn(t.turno_id)} className="cursor-pointer">
                <circle cx={x(t.turno_id)} cy={y(t.falante_norm)} r={t.turno_id === turn ? 6.5 : 4.5} fill={visible ? "#1c2127" : "#d4d4d4"} stroke="#fff" strokeWidth={1.5}/>
                {visible && interrupted.has(t.turno_id) && <text x={x(t.turno_id)} y={y(t.falante_norm) - 9} textAnchor="middle" fontSize={11} fontWeight={700} fill="#ff4b3e">✕</text>}
              </g>
            );
          })}
        </>
      )}

      {mode === "posicoes" && (
        <>
          {arestas.filter((aresta) => aresta.tipo === "mesmo_tema").map((aresta) => {
            const a = opinionById.get(aresta.origem);
            const b = opinionById.get(aresta.destino);
            if (!a || !b || Math.max(a.turno_id, b.turno_id) > turn) return null;
            const x1 = x(a.turno_id), y1 = y(a.falante), x2 = x(b.turno_id), y2 = y(b.falante);
            const lift = Math.min(60, Math.abs(x2 - x1) / 3 + 12);
            return <path key={`${a.id}-${b.id}`} d={`M${x1},${y1} Q${(x1 + x2) / 2},${Math.min(y1, y2) - lift} ${x2},${y2}`} fill="none" stroke={temaCores[a.tema] ?? "#999"} strokeWidth={1.4} strokeDasharray="4 3" opacity={0.75}/>;
          })}
          {opinioes.map((opiniao) => {
            const visible = opiniao.turno_id <= turn;
            const isSelected = opiniao.id === selected;
            return (
              <g key={opiniao.id} onClick={() => onSelect(opiniao)} className="cursor-pointer">
                <title>{`${opiniao.falante}, turno ${opiniao.turno_id}: ${opiniao.texto}`}</title>
                {isSelected && <circle cx={x(opiniao.turno_id)} cy={y(opiniao.falante)} r={12} fill="none" stroke="#1c2127" strokeWidth={1.5}/>}
                <circle cx={x(opiniao.turno_id)} cy={y(opiniao.falante)} r={opiniao.turno_id === turn ? 8.5 : 7} fill={visible ? temaCores[opiniao.tema] ?? "#999" : "#dcdcdc"} stroke="#fff" strokeWidth={2}/>
              </g>
            );
          })}
        </>
      )}

      <line x1={x(turn)} x2={x(turn)} y1={TOP - 8} y2={TOP + participantes.length * ROW} stroke="#1c2127" strokeWidth={1.2} strokeDasharray="2 3"/>
      {[1, Math.round(total / 2), total].map((t) => (
        <text key={t} x={x(t)} y={height - 10} textAnchor="middle" fontSize={10} fill="#999">{t}</text>
      ))}
      <text x={WIDTH - 24} y={height - 22} textAnchor="end" fontSize={10} fill="#999">turno da audiência</text>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#ff4b3e"/>
        </marker>
      </defs>
    </svg>
  );
}
