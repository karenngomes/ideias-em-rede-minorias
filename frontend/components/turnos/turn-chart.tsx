"use client";

import { useMemo } from "react";
import { temaCor, type Audiencia, type Opiniao } from "@/lib/audiencias";

export type ChartMode = "posicoes" | "interacao";

const WIDTH = 820;
const LABEL = 170;
const TOP = 18;

export function TurnChart({ data, mode, showThemes, turn, selected, onSelect, onTurn }: {
  data: Audiencia;
  mode: ChartMode;
  showThemes: boolean;
  turn: number;
  selected?: string;
  onSelect: (opiniao: Opiniao) => void;
  onTurn: (turn: number) => void;
}) {
  const { turnos, opinioes, participantes, parlamentares, arestas, codigos } = data;
  const total = turnos.length;
  // Linhas mais baixas quando há muitos participantes, para o gráfico caber.
  const row = Math.max(14, Math.min(50, 480 / Math.max(1, participantes.length)));
  const fontSize = row >= 24 ? 11 : 9;
  const height = TOP + participantes.length * row + 34;
  const x = (t: number) => LABEL + ((t - 1) / Math.max(1, total - 1)) * (WIDTH - LABEL - 24);
  const rowIndex = useMemo(() => new Map(participantes.map((nome, index) => [nome, index])), [participantes]);
  const y = (nome: string) => TOP + (rowIndex.get(nome) ?? 0) * row + row / 2;
  const current = turnos[turn - 1];
  const interrupted = useMemo(() => new Set(codigos.filter((c) => c.dimensao === "participacao" && c.rotulo === "interrompido").map((c) => c.turno_id)), [codigos]);
  const opinionById = useMemo(() => new Map(opinioes.map((opiniao) => [opiniao.id, opiniao])), [opinioes]);
  const sameTheme = useMemo(() => arestas.filter((aresta) => aresta.tipo === "mesmo_tema"), [arestas]);
  const grants = useMemo(() => arestas.filter((aresta) => aresta.tipo === "concede_palavra"), [arestas]);
  const dotRadius = Math.max(3, Math.min(8, row / 5));
  // Várias opiniões da mesma pessoa no mesmo turno cairiam no mesmo ponto; empilha na vertical,
  // sempre no x do turno e dentro da linha da pessoa (encostando quando são muitas).
  const offsets = useMemo(() => {
    const groups = new Map<string, string[]>();
    opinioes.forEach((opiniao) => {
      const key = `${opiniao.falante}::${opiniao.turno_id}`;
      groups.set(key, [...(groups.get(key) ?? []), opiniao.id]);
    });
    const result = new Map<string, { dx: number; dy: number }>();
    groups.forEach((ids) => {
      const step = ids.length > 1 ? Math.min(dotRadius * 2.1, (row - dotRadius * 2) / (ids.length - 1)) : 0;
      ids.forEach((id, index) => result.set(id, { dx: 0, dy: (index - (ids.length - 1) / 2) * step }));
    });
    return result;
  }, [opinioes, dotRadius, row]);
  const ox = (opiniao: Opiniao) => x(opiniao.turno_id) + (offsets.get(opiniao.id)?.dx ?? 0);
  const oy = (opiniao: Opiniao) => y(opiniao.falante) + (offsets.get(opiniao.id)?.dy ?? 0);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full select-none" role="img" aria-label={mode === "posicoes" ? "Mapa de posições ao longo dos turnos" : "Rede de interação ao longo dos turnos"}>
      <rect x={x(turn) + 6} y={TOP - 6} width={Math.max(0, WIDTH - 24 - x(turn))} height={participantes.length * row + 6} fill="#f0f0f0" opacity={0.7}/>

      {participantes.map((nome) => {
        const active = current?.falante_norm === nome;
        return (
          <g key={nome}>
            <line x1={LABEL - 8} x2={WIDTH - 24} y1={y(nome)} y2={y(nome)} stroke={active ? "#1c2127" : "#e4e4e4"} strokeWidth={active ? 1.2 : 1}/>
            <text x={LABEL - 16} y={y(nome) + fontSize / 3} textAnchor="end" fontSize={fontSize} fontWeight={active ? 700 : 500} fill={active ? "#1c2127" : "#666666"}>
              {nome.length > 22 ? `${nome.slice(0, 21)}…` : nome}
            </text>
            <circle cx={12} cy={y(nome)} r={3.5} fill={parlamentares.has(nome) ? "#1c2127" : "#ff4b3e"}/>
          </g>
        );
      })}

      {mode === "interacao" && (
        <>
          <polyline fill="none" stroke="#c9c9c9" strokeWidth={1.1} points={turnos.slice(0, turn).map((t) => `${x(t.turno_id)},${y(t.falante_norm)}`).join(" ")}/>
          {grants.map((aresta, index) => {
            const t = aresta.dados?.turno_id ?? 0;
            if (!t || t > turn) return null;
            const x1 = x(t), y1 = y(aresta.origem.replace("p::", "")), x2 = x(Math.min(total, t + 1)), y2 = y(aresta.destino.replace("p::", ""));
            return <path key={`${t}-${index}`} d={`M${x1},${y1} C${x1 + 30},${y1} ${x2 - 30},${y2} ${x2},${y2}`} fill="none" stroke="#ff4b3e" strokeWidth={1.8} markerEnd="url(#arrow)"/>;
          })}
          {turnos.map((t) => {
            const visible = t.turno_id <= turn;
            return (
              <g key={t.turno_id} onClick={() => onTurn(t.turno_id)} className="cursor-pointer">
                <circle cx={x(t.turno_id)} cy={y(t.falante_norm)} r={t.turno_id === turn ? dotRadius + 2 : dotRadius * 0.7} fill={visible ? "#1c2127" : "#d4d4d4"} stroke="#fff" strokeWidth={1}/>
                {visible && interrupted.has(t.turno_id) && <text x={x(t.turno_id)} y={y(t.falante_norm) - dotRadius - 3} textAnchor="middle" fontSize={11} fontWeight={700} fill="#ff4b3e">✕</text>}
              </g>
            );
          })}
        </>
      )}

      {mode === "posicoes" && (
        <>
          {sameTheme.map((aresta) => {
            const a = opinionById.get(aresta.origem);
            const b = opinionById.get(aresta.destino);
            // A aresta só aparece no maior dos dois turnos, para o grafo só crescer.
            if (!a || !b || Math.max(a.turno_id, b.turno_id) > turn) return null;
            const focused = selected === a.id || selected === b.id;
            if (selected ? !focused : !showThemes) return null;
            const x1 = ox(a), y1 = oy(a), x2 = ox(b), y2 = oy(b);
            const lift = Math.min(60, Math.abs(x2 - x1) / 3 + 12);
            return <path key={`${a.id}-${b.id}`} d={`M${x1},${y1} Q${(x1 + x2) / 2},${Math.min(y1, y2) - lift} ${x2},${y2}`} fill="none" stroke={temaCor(a.tema)} strokeWidth={focused ? 1.8 : 1} strokeDasharray="4 3" opacity={focused ? 0.9 : 0.25}/>;
          })}
          {opinioes.map((opiniao) => {
            const visible = opiniao.turno_id <= turn;
            const isSelected = opiniao.id === selected;
            return (
              <g key={opiniao.id} onClick={() => onSelect(opiniao)} className="cursor-pointer">
                <title>{`${opiniao.falante}, turno ${opiniao.turno_id}: ${opiniao.texto}`}</title>
                {isSelected && <circle cx={ox(opiniao)} cy={oy(opiniao)} r={dotRadius + 5} fill="none" stroke="#1c2127" strokeWidth={1.5}/>}
                <circle cx={ox(opiniao)} cy={oy(opiniao)} r={opiniao.turno_id === turn ? dotRadius + 1.5 : dotRadius} fill={visible ? temaCor(opiniao.tema) : "#dcdcdc"} stroke="#fff" strokeWidth={1.5}/>
              </g>
            );
          })}
        </>
      )}

      <line x1={x(turn)} x2={x(turn)} y1={TOP - 8} y2={TOP + participantes.length * row} stroke="#1c2127" strokeWidth={1.2} strokeDasharray="2 3"/>
      {Array.from(new Set([1, Math.round(total / 2), total])).map((t) => (
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
