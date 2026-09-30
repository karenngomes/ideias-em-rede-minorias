import { mediana } from "@/lib/comparacao";

// Cores validadas (scripts/validate_palette.js do guia de visualização): coral para M, azul para C.
export const GROUP_COLORS = { M: "#ff4b3e", C: "#3d63d9" } as const;
export const GROUP_LABELS = { M: "Minorias (M)", C: "Demais (C)" } as const;

const WIDTH = 760;
const LEFT = 118;
const RIGHT = 24;
const ROW = 56;

type Point = { id: number; value: number; title: string };

// Marcas redondas no eixo (passos de 1, 2, 2,5 ou 5 vezes uma potência de 10).
function ticks(min: number, max: number, target = 5) {
  const raw = (max - min) / (target - 1 || 1);
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((candidate) => candidate >= raw) ?? raw;
  const start = Math.ceil(min / step) * step;
  const values = [];
  for (let value = start; value <= max + step * 1e-9; value += step) values.push(Number(value.toFixed(10)));
  return values;
}

// Deslocamento vertical estável por audiência, para os pontos não se sobreporem.
function jitter(id: number) {
  const x = Math.sin(id * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export function StripPlot({ rows, min, max, format, zero = false }: {
  rows: Array<{ grupo: "M" | "C"; points: Point[] }>;
  min: number;
  max: number;
  format: (value: number) => string;
  zero?: boolean;
}) {
  const height = rows.length * ROW + 34;
  const x = (value: number) => LEFT + ((value - min) / (max - min || 1)) * (WIDTH - LEFT - RIGHT);
  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" role="img" aria-label="Distribuição por audiência, minorias e demais">
      {ticks(min, max).map((tick) => (
        <g key={tick}>
          <line x1={x(tick)} x2={x(tick)} y1={6} y2={rows.length * ROW} stroke="#ececec" strokeWidth={1}/>
          <text x={x(tick)} y={height - 12} textAnchor="middle" fontSize={11} fill="#8a8a8a">{format(tick)}</text>
        </g>
      ))}
      {zero && min < 0 && <line x1={x(0)} x2={x(0)} y1={6} y2={rows.length * ROW} stroke="#9a9a9a" strokeWidth={1}/>}
      {rows.map((row, index) => {
        const cy = index * ROW + ROW / 2;
        const median = mediana(row.points.map((point) => point.value));
        return (
          <g key={row.grupo}>
            <circle cx={12} cy={cy} r={5} fill={GROUP_COLORS[row.grupo]}/>
            <text x={24} y={cy - 2} fontSize={12} fontWeight={600} fill="#1c2127">{GROUP_LABELS[row.grupo]}</text>
            <text x={24} y={cy + 13} fontSize={10} fill="#8a8a8a">{row.points.length} audiências</text>
            {row.points.map((point) => (
              <a key={point.id} href={`/audiencias/${point.id}`}>
                <circle cx={x(point.value)} cy={cy + jitter(point.id) * (ROW / 2 - 12)} r={4.5} fill={GROUP_COLORS[row.grupo]} fillOpacity={0.75} stroke="#ffffff" strokeWidth={2} className="cursor-pointer hover:fill-opacity-100">
                  <title>{`#${point.id} · ${point.title}\n${format(point.value)}`}</title>
                </circle>
              </a>
            ))}
            {median != null && (
              <g>
                <line x1={x(median)} x2={x(median)} y1={cy - ROW / 2 + 6} y2={cy + ROW / 2 - 6} stroke="#1c2127" strokeWidth={2} strokeLinecap="round"/>
                <text x={x(median) + 6} y={cy - ROW / 2 + 14} fontSize={11} fontWeight={600} fill="#1c2127" stroke="#ffffff" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">mediana {format(median)}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function GroupedBars({ categories, max, format }: {
  categories: Array<{ label: string; values: Record<"M" | "C", { value: number; detail: string } | null> }>;
  max: number;
  format: (value: number) => string;
}) {
  const bar = 14;
  const gap = 2;
  const block = bar * 2 + gap + 22;
  const height = categories.length * block;
  const x = (value: number) => ((value / (max || 1)) * (WIDTH - LEFT - 170));
  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" role="img" aria-label="Barras agrupadas por papel, minorias e demais">
      {categories.map((category, index) => {
        const top = index * block + 8;
        return (
          <g key={category.label}>
            <text x={0} y={top + bar + 4} fontSize={12} fontWeight={600} fill="#1c2127">{category.label}</text>
            {(["M", "C"] as const).map((grupo, row) => {
              const item = category.values[grupo];
              const y = top + row * (bar + gap);
              const width = item ? Math.max(2, x(item.value)) : 0;
              return (
                <g key={grupo}>
                  {item && <path d={`M${LEFT},${y} h${width - 4} a4,4 0 0 1 4,4 v${bar - 8} a4,4 0 0 1 -4,4 h${-(width - 4)} z`} fill={GROUP_COLORS[grupo]}><title>{`${GROUP_LABELS[grupo]}: ${format(item.value)} (${item.detail})`}</title></path>}
                  <text x={LEFT + width + 8} y={y + bar - 3} fontSize={11} fill="#1c2127">
                    {item ? <><tspan fontWeight={600}>{format(item.value)}</tspan><tspan fill="#8a8a8a"> · {item.detail}</tspan></> : <tspan fill="#8a8a8a">sem dados</tspan>}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#666666]">
      {(["M", "C"] as const).map((grupo) => (
        <span key={grupo} className="flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS[grupo] }}/>{GROUP_LABELS[grupo]}</span>
      ))}
    </div>
  );
}
