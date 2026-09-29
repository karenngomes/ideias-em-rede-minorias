"use client";

import * as d3 from "d3";
import { Pause, Play, RotateCcw, Search, SkipBack, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type NodeKind = "topic" | "subtopic" | "deputy";

type GraphNode = d3.SimulationNodeDatum & {
  id: string;
  name: string;
  kind: NodeKind;
  party?: string;
  state?: string;
  parent?: string;
  description?: string;
  connected?: boolean;
};

type GraphLink = d3.SimulationLinkDatum<GraphNode> & {
  source: string | GraphNode;
  target: string | GraphNode;
  relation: "estrutura" | "favor" | "contra";
  minute?: number;
};

const sourceNodes: GraphNode[] = [
  { id: "topic", name: "Transição energética justa", kind: "topic", description: "Pauta central da audiência pública" },
  { id: "jobs", name: "Priorizar empregos locais", kind: "subtopic", parent: "topic", description: "Novos projetos de energia devem priorizar a contratação e a qualificação de trabalhadores das comunidades locais." },
  { id: "energy", name: "Ampliar energia solar e eólica", kind: "subtopic", parent: "topic", description: "O Brasil deve acelerar a expansão das matrizes solar e eólica para reduzir o uso de fontes poluentes." },
  { id: "communities", name: "Dar poder de decisão às comunidades", kind: "subtopic", parent: "topic", description: "Comunidades afetadas devem participar das decisões e poder rejeitar projetos que causem impactos sociais graves." },
  { id: "funding", name: "Usar recursos públicos na transição", kind: "subtopic", parent: "topic", description: "O governo deve oferecer crédito e incentivos públicos para financiar projetos de transição energética." },
  { id: "ana", name: "Ana Martins", kind: "deputy", party: "PT", state: "PE", connected: true },
  { id: "bruno", name: "Bruno Almeida", kind: "deputy", party: "PSD", state: "MG", connected: true },
  { id: "carla", name: "Carla Nogueira", kind: "deputy", party: "PT", state: "BA", connected: true },
  { id: "diego", name: "Diego Ramos", kind: "deputy", party: "UNIÃO", state: "CE", connected: true },
  { id: "elisa", name: "Elisa Ferreira", kind: "deputy", party: "PL", state: "SP", connected: true },
  { id: "fabio", name: "Fábio Lima", kind: "deputy", party: "PSD", state: "PA", connected: true },
  { id: "gabriela", name: "Gabriela Costa", kind: "deputy", party: "PL", state: "RJ", connected: false },
  { id: "henrique", name: "Henrique Tavares", kind: "deputy", party: "UNIÃO", state: "GO", connected: false },
  { id: "ines", name: "Inês Moura", kind: "deputy", party: "PL", state: "PR", connected: false },
];

const sourceLinks: GraphLink[] = [
  { source: "topic", target: "jobs", relation: "estrutura" },
  { source: "topic", target: "energy", relation: "estrutura" },
  { source: "topic", target: "communities", relation: "estrutura" },
  { source: "topic", target: "funding", relation: "estrutura" },
  { source: "ana", target: "jobs", relation: "favor", minute: 8 },
  { source: "bruno", target: "energy", relation: "favor", minute: 15 },
  { source: "ana", target: "communities", relation: "favor", minute: 24 },
  { source: "carla", target: "jobs", relation: "favor", minute: 29 },
  { source: "carla", target: "funding", relation: "contra", minute: 35 },
  { source: "diego", target: "communities", relation: "contra", minute: 35 },
  { source: "elisa", target: "energy", relation: "favor", minute: 42 },
  { source: "elisa", target: "communities", relation: "favor", minute: 48 },
  { source: "fabio", target: "funding", relation: "favor", minute: 54 },
];

const palette = {
  topic: "#f97316",
  subtopic: "#2563eb",
  deputy: "#0f766e",
  inactive: "#a1a1aa",
  favor: "#16a34a",
  contra: "#dc2626",
};

const parties = [
  { id: "PL", name: "PL", color: "#2563eb" },
  { id: "PT", name: "PT", color: "#dc2626" },
  { id: "UNIÃO", name: "União Brasil", color: "#06b6d4" },
  { id: "PSD", name: "PSD", color: "#f59e0b" },
] as const;

const partyColors = Object.fromEntries(parties.map((party) => [party.id, party.color]));

const ideologies = [
  { id: "direita", name: "Direita", color: "#1d4ed8" },
  { id: "esquerda", name: "Esquerda", color: "#dc2626" },
  { id: "centro-direita", name: "Centro-direita", color: "#0891b2" },
  { id: "centro-esquerda", name: "Centro-esquerda", color: "#d97706" },
] as const;

const partyIdeology: Record<string, string> = {
  PL: "direita",
  PT: "esquerda",
  "UNIÃO": "centro-direita",
  PSD: "centro-esquerda",
};

export type NetworkGraphView = "interactions" | "deputy-interactions" | "summary";

const interactionEvents = [
  { minute: 6, source: "president", target: "ana", type: "Dar a palavra" },
  { minute: 11, source: "ana", target: "bruno", type: "Questionou" },
  { minute: 18, source: "bruno", target: "ana", type: "Discorda" },
  { minute: 25, source: "carla", target: "president", type: "Solicitar palavra" },
  { minute: 31, source: "president", target: "carla", type: "Dar a palavra" },
  { minute: 36, source: "carla", target: "diego", type: "Concorda" },
  { minute: 43, source: "diego", target: "carla", type: "Complementar" },
  { minute: 49, source: "bruno", target: "diego", type: "Questionou" },
  { minute: 55, source: "diego", target: "bruno", type: "Discorda" },
] as const;

const interactionStyles: Record<string, { color: string; dash?: string }> = {
  "Questionou": { color: "#7c3aed" },
  "Discorda": { color: "#dc2626" },
  "Concorda": { color: "#16a34a" },
  "Dar a palavra": { color: "#2563eb" },
  "Complementar": { color: "#d97706" },
  "Solicitar palavra": { color: "#52525b", dash: "5 4" },
};

export function NetworkGraph({ view }: { view: NetworkGraphView }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeTab = view;
  const [filterMode, setFilterMode] = useState<"party" | "ideology">("party");
  const [enabledParties, setEnabledParties] = useState<Set<string>>(() => new Set(parties.map((party) => party.id)));
  const [enabledIdeologies, setEnabledIdeologies] = useState<Set<string>>(() => new Set(ideologies.map((ideology) => ideology.id)));

  const activeOpinionLinks = useMemo(
    () => sourceLinks.filter((link) => link.relation !== "estrutura" && (link.minute ?? 0) <= currentMinute),
    [currentMinute],
  );
  const activeDeputyIds = useMemo(() => new Set(activeOpinionLinks.flatMap((link) => [link.source as string, link.target as string])), [activeOpinionLinks]);
  const filteredOpinionLinks = useMemo(() => activeOpinionLinks.filter((link) => {
    const deputy = sourceNodes.find((node) => node.id === link.source);
    return filterMode === "party" ? enabledParties.has(deputy?.party ?? "") : enabledIdeologies.has(partyIdeology[deputy?.party ?? ""]);
  }), [activeOpinionLinks, enabledParties, enabledIdeologies, filterMode]);
  const activeDeputiesCount = sourceNodes.filter((node) => node.kind === "deputy" && activeDeputyIds.has(node.id) && (filterMode === "party" ? enabledParties.has(node.party ?? "") : enabledIdeologies.has(partyIdeology[node.party ?? ""]))).length;
  const selectedNode = useMemo(() => sourceNodes.find((node) => node.id === selected), [selected]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setCurrentMinute((minute) => {
        if (minute >= 60) {
          setIsPlaying(false);
          return 60;
        }
        return minute + 1;
      });
    }, 450);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    const allowedDeputyIds = new Set(sourceNodes.filter((node) => node.kind === "deputy" && (filterMode === "party" ? enabledParties.has(node.party ?? "") : enabledIdeologies.has(partyIdeology[node.party ?? ""]))).map((node) => node.id));
    const nodes = sourceNodes
      .filter((node) => node.kind !== "deputy" || allowedDeputyIds.has(node.id))
      .map((node) => ({ ...node }));
    const links = sourceLinks
      .filter((link) => link.relation === "estrutura" || allowedDeputyIds.has(link.source as string))
      .map((link) => ({ ...link }));
    const firstAppearance = new Map<string, number>();
    sourceLinks.forEach((link) => {
      if (link.relation === "estrutura") return;
      const deputyId = link.source as string;
      firstAppearance.set(deputyId, Math.min(firstAppearance.get(deputyId) ?? Infinity, link.minute ?? 0));
    });
    let simulation: d3.Simulation<GraphNode, undefined>;

    const draw = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      svg.selectAll("*").remove();
      svg.attr("viewBox", `0 0 ${width} ${height}`);

      const root = svg.append("g");
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.55, 2.2])
        .on("zoom", (event) => root.attr("transform", event.transform));
      svg.call(zoom).on("dblclick.zoom", null);

      const inactiveX = Math.max(width - 130, width * 0.78);
      root.append("line")
        .attr("x1", inactiveX - 95).attr("x2", inactiveX - 95)
        .attr("y1", 42).attr("y2", height - 42)
        .attr("stroke", "#e4e4e7").attr("stroke-dasharray", "4 6");
      root.append("text")
        .attr("x", inactiveX).attr("y", 42).attr("text-anchor", "middle")
        .attr("fill", "#71717a").attr("font-size", 11).attr("font-weight", 700)
        .attr("letter-spacing", "0.08em").text("SEM MANIFESTAÇÃO");

      const link = root.append("g").selectAll("line").data(links).join("line")
        .attr("data-opinion-link", (d) => d.relation === "estrutura" ? null : "true")
        .attr("data-minute", (d) => d.minute ?? 0)
        .attr("stroke", (d) => d.relation === "estrutura" ? "#fdba74" : d.relation === "favor" ? palette.favor : palette.contra)
        .attr("stroke-width", (d) => d.relation === "estrutura" ? 2.5 : 2.2)
        .attr("stroke-dasharray", (d) => d.relation === "estrutura" ? "5 5" : "1000")
        .attr("stroke-dashoffset", (d) => d.relation !== "estrutura" && (d.minute ?? 0) > currentMinute ? 1000 : 0)
        .attr("opacity", (d) => d.relation !== "estrutura" && (d.minute ?? 0) > currentMinute ? 0 : 1);

      link.append("title").text((d) => d.relation === "favor" ? `Posicionamento a favor aos ${d.minute} min` : d.relation === "contra" ? `Posicionamento contra aos ${d.minute} min` : "Relação entre pauta e tópico");

      const node = root.append("g").selectAll<SVGGElement, GraphNode>("g").data(nodes).join("g")
        .attr("cursor", "pointer")
        .attr("data-deputy-node", (d) => d.kind === "deputy" && d.connected ? "true" : null)
        .attr("data-first-minute", (d) => firstAppearance.get(d.id) ?? 0)
        .on("click", (_, d) => setSelected((current) => current === d.id ? null : d.id));

      node.append("circle")
        .attr("r", (d) => d.kind === "topic" ? 25 : d.kind === "subtopic" ? 17 : 12)
        .attr("fill", (d) => d.kind === "deputy" ? partyColors[d.party ?? ""] : palette[d.kind])
        .attr("stroke", "white").attr("stroke-width", 3)
        .style("filter", "drop-shadow(0 3px 5px rgb(15 23 42 / 0.16))");

      node.filter((d) => d.kind === "deputy").append("text")
        .attr("text-anchor", "middle").attr("dy", "0.35em")
        .attr("fill", "white").attr("font-size", 9).attr("font-weight", 800)
        .text((d) => d.name.split(" ").map((part) => part[0]).join("").slice(0, 2));

      node.append("text")
        .attr("x", (d) => d.kind === "topic" ? 34 : d.kind === "subtopic" ? 25 : 18)
        .attr("y", 4).attr("fill", "#18181b")
        .attr("font-size", (d) => d.kind === "topic" ? 13 : 11)
        .attr("font-weight", (d) => d.kind === "deputy" ? 500 : 700)
        .text((d) => d.name);

      node.append("title").text((d) => d.kind === "deputy"
        ? `${d.name} · ${d.party}-${d.state}${d.connected ? " · possui manifestação" : " · não se manifestou"}`
        : `${d.name} · ${d.description}`);

      const relevant = selected ? new Set([selected]) : null;
      if (relevant) {
        links.forEach((item) => {
          const source = typeof item.source === "string" ? item.source : item.source.id;
          const target = typeof item.target === "string" ? item.target : item.target.id;
          if (source === selected) relevant.add(target);
          if (target === selected) relevant.add(source);
        });
      }

      const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
      node.attr("opacity", (d) => {
        if (d.kind === "deputy" && d.connected && (firstAppearance.get(d.id) ?? 0) > currentMinute) return 0;
        const selectedMatch = !relevant || relevant.has(d.id);
        const searchMatch = !normalizedQuery || `${d.name} ${d.party ?? ""} ${d.state ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
        return selectedMatch && searchMatch ? 1 : 0.14;
      });
      link.attr("opacity", (d) => {
        if (d.relation !== "estrutura" && (d.minute ?? 0) > currentMinute) return 0;
        if (!selected) return normalizedQuery ? 0.18 : 1;
        const source = typeof d.source === "string" ? d.source : d.source.id;
        const target = typeof d.target === "string" ? d.target : d.target.id;
        return source === selected || target === selected ? 1 : 0.08;
      });

      simulation?.stop();
      simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance((d) => d.relation === "estrutura" ? 105 : 130).strength(0.55))
        .force("charge", d3.forceManyBody().strength(-420))
        .force("collision", d3.forceCollide<GraphNode>().radius((d) => d.kind === "topic" ? 75 : d.kind === "subtopic" ? 60 : 45))
        .force("x", d3.forceX<GraphNode>((d) => d.kind === "deputy" && !d.connected ? inactiveX : width * 0.42).strength((d) => d.kind === "deputy" && !d.connected ? 0.5 : 0.08))
        .force("y", d3.forceY<GraphNode>(height / 2).strength(0.08))
        .on("tick", () => {
          nodes.forEach((d) => {
            d.x = Math.max(35, Math.min(width - 35, d.x ?? width / 2));
            d.y = Math.max(65, Math.min(height - 35, d.y ?? height / 2));
          });
          link.attr("x1", (d) => (d.source as GraphNode).x ?? 0).attr("y1", (d) => (d.source as GraphNode).y ?? 0)
            .attr("x2", (d) => (d.target as GraphNode).x ?? 0).attr("y2", (d) => (d.target as GraphNode).y ?? 0);
          node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
        });

      node.call(d3.drag<SVGGElement, GraphNode>()
        .on("start", (event, d) => { if (!event.active) simulation.alphaTarget(0.25).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on("end", (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => { observer.disconnect(); simulation?.stop(); };
  }, [selected, query, revision, enabledParties, enabledIdeologies, filterMode, activeTab]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const relevant = selected ? new Set([selected]) : null;
    if (relevant) {
      sourceLinks.forEach((link) => {
        const source = link.source as string;
        const target = link.target as string;
        if (source === selected) relevant.add(target);
        if (target === selected) relevant.add(source);
      });
    }
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

    svg.selectAll<SVGLineElement, GraphLink>("[data-opinion-link]")
      .interrupt()
      .transition()
      .duration(700)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", function () {
        return Number(this.dataset.minute) <= currentMinute ? 0 : 1000;
      })
      .attr("opacity", function (link) {
        if (Number(this.dataset.minute) > currentMinute) return 0;
        if (normalizedQuery) return 0.18;
        if (!selected) return 1;
        const source = typeof link.source === "string" ? link.source : link.source.id;
        const target = typeof link.target === "string" ? link.target : link.target.id;
        return source === selected || target === selected ? 1 : 0.08;
      });

    svg.selectAll<SVGGElement, GraphNode>("[data-deputy-node]")
      .interrupt()
      .transition()
      .duration(500)
      .ease(d3.easeCubicOut)
      .attr("opacity", function (node) {
        if (Number(this.dataset.firstMinute) > currentMinute) return 0;
        const selectedMatch = !relevant || relevant.has(node.id);
        const searchMatch = !normalizedQuery || `${node.name} ${node.party ?? ""} ${node.state ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
        return selectedMatch && searchMatch ? 1 : 0.14;
      });
  }, [currentMinute, query, selected]);

  const toggleParty = (partyId: string) => {
    setSelected(null);
    setEnabledParties((current) => {
      const next = new Set(current);
      if (next.has(partyId)) next.delete(partyId);
      else next.add(partyId);
      return next;
    });
  };

  const toggleIdeology = (ideologyId: string) => {
    setSelected(null);
    setEnabledIdeologies((current) => {
      const next = new Set(current);
      if (next.has(ideologyId)) next.delete(ideologyId);
      else next.add(ideologyId);
      return next;
    });
  };

  return (
    <div className="bg-[#f8f7f3] text-zinc-950">

      {activeTab === "interactions" ? <>

      <section className="mx-auto max-w-[1500px] px-5 py-6 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Mapa de manifestações</p><h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Quem falou sobre o quê?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">Explore as conexões entre deputados, a pauta principal e os temas debatidos durante a audiência.</p></div>
          <div className="relative w-full lg:w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar deputado ou pauta" className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-9 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"/>{query && <button aria-label="Limpar busca" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-800"><X className="size-4"/></button>}</div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_40px_rgba(24,24,27,0.05)]">
            <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-4 sm:px-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div><p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Filtros dos deputados</p><p className="mt-0.5 text-xs text-zinc-500">Escolha um critério e ative os grupos que deseja comparar</p></div>
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-600"><span className="sr-only">Tipo de filtro</span><select value={filterMode} onChange={(event) => { setSelected(null); setFilterMode(event.target.value as "party" | "ideology"); }} className="h-9 min-w-48 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"><option value="party">Filtrar por partido</option><option value="ideology">Filtrar por ideologia política</option></select></label>
              </div>
              <div className="flex flex-wrap gap-2">
                {filterMode === "party" ? parties.map((party) => {
                  const active = enabledParties.has(party.id);
                  const count = sourceNodes.filter((node) => node.party === party.id).length;
                  return <FilterButton key={party.id} active={active} color={party.color} name={party.name} count={count} onClick={() => toggleParty(party.id)}/>;
                }) : ideologies.map((ideology) => {
                  const active = enabledIdeologies.has(ideology.id);
                  const count = sourceNodes.filter((node) => node.kind === "deputy" && partyIdeology[node.party ?? ""] === ideology.id).length;
                  return <FilterButton key={ideology.id} active={active} color={ideology.color} name={ideology.name} count={count} onClick={() => toggleIdeology(ideology.id)}/>;
                })}
              </div>
            </div>
            <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <button onClick={() => { setIsPlaying(false); setCurrentMinute(0); setSelected(null); }} aria-label="Voltar ao início" className="grid size-9 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950"><SkipBack className="size-4"/></button>
                <button onClick={() => { if (currentMinute >= 60) setCurrentMinute(0); setIsPlaying((playing) => !playing); }} aria-label={isPlaying ? "Pausar linha do tempo" : "Reproduzir linha do tempo"} className="grid size-10 shrink-0 place-items-center rounded-full bg-zinc-900 text-white transition hover:bg-orange-600">{isPlaying ? <Pause className="size-4 fill-current"/> : <Play className="ml-0.5 size-4 fill-current"/>}</button>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-semibold text-zinc-600">Linha do tempo da audiência</span><span className="font-mono text-sm font-bold tabular-nums text-zinc-950">{formatMinute(currentMinute)}</span></div>
                  <div className="relative flex h-4 items-center">
                    <input type="range" min="0" max="60" step="1" value={currentMinute} onChange={(event) => { setIsPlaying(false); setCurrentMinute(Number(event.target.value)); }} aria-label="Minuto da audiência" className="timeline-range relative z-10 w-full cursor-pointer" style={{ "--progress": `${(currentMinute / 60) * 100}%` } as React.CSSProperties}/>
                    {[8, 15, 24, 29, 35, 42, 48, 54].map((minute) => <span key={minute} className="pointer-events-none absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-400" style={{ left: `${(minute / 60) * 100}%` }}/>) }
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-zinc-400"><span>Início</span><span>30 min</span><span>60 min</span></div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-600"><Legend color={palette.topic} label="Pauta principal"/><Legend color={palette.subtopic} label="Tópico avaliável"/><Legend color={palette.favor} label="A favor" line/><Legend color={palette.contra} label="Contra" line/><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-zinc-300 bg-white"/>Sem manifestação = sem linha</span></div>
              <button onClick={() => { setSelected(null); setQuery(""); setRevision((value) => value + 1); }} className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-950"><RotateCcw className="size-3.5"/>Reorganizar</button>
            </div>
            <div ref={containerRef} className="relative h-[560px] min-h-[460px] w-full"><svg ref={svgRef} className="h-full w-full touch-none" aria-label="Grafo das manifestações dos deputados"/></div>
            <div className="border-t border-zinc-100 px-4 py-2.5 text-xs text-zinc-400">Arraste os nós para reorganizar · Use a roda do mouse para ampliar</div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Até {formatMinute(currentMinute)}</p>{isPlaying && <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-green-700"><span className="size-1.5 animate-pulse rounded-full bg-green-600"/>Ao vivo</span>}</div><div className="mt-4 grid grid-cols-2 gap-4"><Stat value={String(activeDeputiesCount)} label="Com fala"/><Stat value={String(filteredOpinionLinks.length)} label="Opiniões"/><Stat value={String(filteredOpinionLinks.filter((link) => link.relation === "favor").length)} label="A favor"/><Stat value={String(filteredOpinionLinks.filter((link) => link.relation === "contra").length)} label="Contra"/></div></div>
            <div className="min-h-48 rounded-2xl bg-zinc-900 p-5 text-white">
              {selectedNode ? <><div className="flex items-start justify-between gap-3"><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-300">{selectedNode.kind === "deputy" ? "Deputado" : selectedNode.kind === "topic" ? "Pauta principal" : "Tópico avaliável"}</span><button onClick={() => setSelected(null)} aria-label="Fechar detalhes" className="text-zinc-400 hover:text-white"><X className="size-4"/></button></div><h3 className="mt-4 text-xl font-semibold leading-tight">{selectedNode.name}</h3>{selectedNode.kind === "deputy" ? <><p className="mt-2 text-sm text-zinc-400">{selectedNode.party} · {selectedNode.state}</p><p className="mt-5 text-sm leading-6 text-zinc-300">{selectedNode.connected ? "As linhas verdes mostram posições a favor; as vermelhas mostram posições contra." : "Não foi registrada manifestação deste parlamentar sobre os temas da audiência."}</p></> : <p className="mt-4 text-sm leading-6 text-zinc-300">{selectedNode.description}</p>}</> : <><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Como explorar</p><h3 className="mt-4 text-lg font-semibold">Selecione um nó</h3><p className="mt-2 text-sm leading-6 text-zinc-400">Clique em um deputado ou tópico para isolar suas conexões e conhecer a afirmação avaliada.</p></>}
            </div>
          </aside>
        </div>
      </section>
      </> : activeTab === "deputy-interactions" ? <DeputyInteractionsTab currentMinute={currentMinute} setCurrentMinute={setCurrentMinute} isPlaying={isPlaying} setIsPlaying={setIsPlaying}/> : activeTab === "summary" ? <SummaryTab/> : null}
    </div>
  );
}

function Legend({ color, label, line = false }: { color: string; label: string; line?: boolean }) {
  return <span className="flex items-center gap-1.5"><span className={line ? "h-0.5 w-4" : "size-2.5 rounded-full"} style={{ backgroundColor: color }}/>{label}</span>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div><strong className="block text-2xl font-semibold tracking-tight">{value}</strong><span className="text-xs text-zinc-500">{label}</span></div>;
}

function FilterButton({ active, color, name, count, onClick }: { active: boolean; color: string; name: string; count: number; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition ${active ? "border-zinc-300 bg-white text-zinc-900 shadow-sm" : "border-zinc-200 bg-zinc-50 text-zinc-400 opacity-60"}`}><span className="size-2.5 rounded-full" style={{ backgroundColor: color }}/>{name}<span className="text-[10px] font-normal text-zinc-400">{count}</span></button>;
}

function formatMinute(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function DeputyInteractionsTab({ currentMinute, setCurrentMinute, isPlaying, setIsPlaying }: { currentMinute: number; setCurrentMinute: React.Dispatch<React.SetStateAction<number>>; isPlaying: boolean; setIsPlaying: React.Dispatch<React.SetStateAction<boolean>> }) {
  const allParties = new Set<string>(parties.map((party) => party.id));
  const allIdeologies = new Set<string>(ideologies.map((ideology) => ideology.id));
  return <section role="tabpanel" aria-label="Interações entre deputados" className="min-h-[calc(100vh-61px)] bg-[#f8f7f3] px-5 py-8 lg:px-8"><div className="mx-auto max-w-[1500px]"><div className="mb-6"><p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Sequência da audiência</p><h2 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Interações entre deputados</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">O tempo avança de cima para baixo e cada seta mostra quem iniciou e quem recebeu a interação.</p></div><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]"><div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_40px_rgba(24,24,27,0.05)]"><div className="border-b border-zinc-100 bg-zinc-50/70 px-5 py-4"><div className="flex items-center gap-3"><button onClick={() => { setIsPlaying(false); setCurrentMinute(0); }} aria-label="Voltar ao início" className="grid size-9 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600"><SkipBack className="size-4"/></button><button onClick={() => { if (currentMinute >= 60) setCurrentMinute(0); setIsPlaying((playing) => !playing); }} aria-label={isPlaying ? "Pausar" : "Reproduzir"} className="grid size-10 shrink-0 place-items-center rounded-full bg-zinc-900 text-white hover:bg-orange-600">{isPlaying ? <Pause className="size-4 fill-current"/> : <Play className="ml-0.5 size-4 fill-current"/>}</button><div className="min-w-0 flex-1"><div className="mb-2 flex justify-between"><span className="text-xs font-semibold text-zinc-600">Linha do tempo</span><span className="font-mono text-sm font-bold">{formatMinute(currentMinute)}</span></div><input type="range" min="0" max="60" value={currentMinute} onChange={(event) => { setIsPlaying(false); setCurrentMinute(Number(event.target.value)); }} className="timeline-range w-full cursor-pointer" style={{ "--progress": `${(currentMinute / 60) * 100}%` } as React.CSSProperties}/></div></div></div><div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-zinc-100 px-5 py-3 text-xs text-zinc-600">{Object.entries(interactionStyles).map(([label, style]) => <Legend key={label} color={style.color} label={label} line/>)}</div><InteractionSequence currentMinute={currentMinute} filterMode="party" enabledParties={allParties} enabledIdeologies={allIdeologies}/><div className="border-t border-zinc-100 px-5 py-2.5 text-xs text-zinc-400">Presidente em vermelho · Quatro deputados · Tempo de cima para baixo</div></div><aside className="space-y-4"><div className="rounded-2xl border border-zinc-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Até {formatMinute(currentMinute)}</p><div className="mt-4 grid grid-cols-2 gap-4"><Stat value={String(interactionEvents.filter((event) => event.minute <= currentMinute).length)} label="Interações"/><Stat value="5" label="Participantes"/><Stat value={String(interactionEvents.filter((event) => event.minute <= currentMinute && event.type === "Concorda").length)} label="Concordâncias"/><Stat value={String(interactionEvents.filter((event) => event.minute <= currentMinute && event.type === "Discorda").length)} label="Discordâncias"/></div></div><div className="rounded-2xl bg-zinc-900 p-5 text-white"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Como interpretar</p><h3 className="mt-4 text-lg font-semibold">Direção das falas</h3><p className="mt-2 text-sm leading-6 text-zinc-400">A seta parte de quem iniciou a interação e aponta para quem a recebeu. Pedidos de palavra usam linha pontilhada.</p></div></aside></div></div></section>;
}

function InteractionSequence({ currentMinute, filterMode, enabledParties, enabledIdeologies }: { currentMinute: number; filterMode: "party" | "ideology"; enabledParties: Set<string>; enabledIdeologies: Set<string> }) {
  const actors = [
    { id: "president", name: "Presidente", detail: "da sessão", party: null, x: 110, color: "#ef4444" },
    { id: "ana", name: "Ana Martins", detail: "PT-PE", party: "PT", x: 325, color: partyColors.PT },
    { id: "bruno", name: "Bruno Almeida", detail: "PSD-MG", party: "PSD", x: 540, color: partyColors.PSD },
    { id: "carla", name: "Carla Nogueira", detail: "PT-BA", party: "PT", x: 755, color: partyColors.PT },
    { id: "diego", name: "Diego Ramos", detail: "UNIÃO-CE", party: "UNIÃO", x: 970, color: partyColors["UNIÃO"] },
  ];
  const isVisible = (party: string | null) => !party || (filterMode === "party" ? enabledParties.has(party) : enabledIdeologies.has(partyIdeology[party]));
  const visibleActors = new Set(actors.filter((actor) => isVisible(actor.party)).map((actor) => actor.id));
  const yForMinute = (minute: number) => 130 + minute * 8;

  return (
    <div className="w-full overflow-x-auto bg-white">
      <svg viewBox="0 0 1080 650" className="h-auto min-h-[520px] min-w-[900px] w-full" aria-label="Diagrama temporal das interações entre os participantes">
        <defs>{Object.entries(interactionStyles).map(([type, style], index) => <marker key={type} id={`arrow-${index}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={style.color}/></marker>)}</defs>

        <text x="24" y="108" fill="#a1a1aa" fontSize="10" fontWeight="700" letterSpacing="1">TEMPO</text>
        {[0, 10, 20, 30, 40, 50, 60].map((minute) => <g key={minute}><text x="28" y={yForMinute(minute) + 4} fill="#a1a1aa" fontSize="10" fontFamily="monospace">{minute}m</text><line x1="64" x2="1040" y1={yForMinute(minute)} y2={yForMinute(minute)} stroke="#f4f4f5"/></g>)}

        {actors.map((actor) => <g key={actor.id} opacity={isVisible(actor.party) ? 1 : 0.12} className="transition-opacity duration-300"><circle cx={actor.x} cy="48" r="25" fill={actor.color} stroke="white" strokeWidth="4" style={{ filter: "drop-shadow(0 3px 5px rgb(24 24 27 / 0.18))" }}/><text x={actor.x} y="88" textAnchor="middle" fill="#18181b" fontSize="12" fontWeight="700">{actor.name}</text><text x={actor.x} y="103" textAnchor="middle" fill="#a1a1aa" fontSize="10">{actor.detail}</text><line x1={actor.x} x2={actor.x} y1="116" y2="625" stroke="#d4d4d8" strokeWidth="1.5" strokeDasharray="5 7"/></g>)}

        {interactionEvents.map((event) => {
          const source = actors.find((actor) => actor.id === event.source)!;
          const target = actors.find((actor) => actor.id === event.target)!;
          const style = interactionStyles[event.type];
          const styleIndex = Object.keys(interactionStyles).indexOf(event.type);
          const visible = event.minute <= currentMinute && visibleActors.has(event.source) && visibleActors.has(event.target);
          const direction = target.x > source.x ? 1 : -1;
          const startX = source.x + direction * 12;
          const endX = target.x - direction * 15;
          const midX = (startX + endX) / 2;
          const y = yForMinute(event.minute);
          const labelWidth = Math.max(82, event.type.length * 6.7 + 20);
          return <g key={`${event.minute}-${event.type}`} opacity={visible ? 1 : 0} transform={visible ? "translate(0 0)" : "translate(0 -5)"} className="transition-all duration-700"><rect x={target.x - 6} y={y - 12} width="12" height="24" rx="4" fill={target.color} stroke="white" strokeWidth="2"/><line x1={startX} x2={endX} y1={y} y2={y} stroke={style.color} strokeWidth="2" strokeDasharray={style.dash} markerEnd={`url(#arrow-${styleIndex})`}/><rect x={midX - labelWidth / 2} y={y - 20} width={labelWidth} height="18" rx="5" fill="white"/><text x={midX} y={y - 7} textAnchor="middle" fill={style.color} fontSize="11" fontWeight="700">{event.type}</text><text x={66} y={y + 4} textAnchor="end" fill="#71717a" fontSize="10" fontFamily="monospace">{formatMinute(event.minute)}</text></g>;
        })}

        <line x1="68" x2="68" y1="130" y2={yForMinute(currentMinute)} stroke="#f97316" strokeWidth="2"/><circle cx="68" cy={yForMinute(currentMinute)} r="4" fill="#f97316"/><text x="78" y={Math.min(640, yForMinute(currentMinute) + 4)} fill="#f97316" fontSize="10" fontWeight="700">AGORA</text>
      </svg>
    </div>
  );
}

const summaryParagraphs = [
  "A audiência pública discutiu caminhos para uma transição energética que concilie expansão de fontes renováveis, proteção social e participação das comunidades afetadas. O debate revelou consenso sobre a importância de diversificar a matriz energética, mas divergências quanto ao papel do financiamento público, à velocidade das mudanças e ao poder de decisão local.",
  "Os parlamentares favoráveis a uma atuação estatal mais forte defenderam crédito direcionado, qualificação profissional e contrapartidas sociais para novos empreendimentos. Outra corrente sustentou que incentivos amplos podem transferir riscos ao orçamento público e propôs maior participação do setor privado.",
  "Emprego e renda ocuparam posição central. Foi defendida a prioridade para trabalhadores das regiões que recebem projetos solares e eólicos, com programas de formação anteriores à instalação dos empreendimentos. Também houve preocupação com a possibilidade de vagas especializadas serem preenchidas por profissionais de outras localidades.",
  "A participação comunitária foi tratada como condição de legitimidade. Parte dos participantes pediu consultas capazes de influenciar efetivamente as decisões. Outros alertaram que a definição técnica dos projetos não poderia ser substituída integralmente por deliberações locais, sugerindo modelos de governança compartilhada.",
  "Sobre financiamento, foram apresentadas duas posições. A primeira considera que crédito público reduz riscos iniciais e acelera investimentos estratégicos. A segunda teme subsídios permanentes e defende critérios objetivos, prazos definidos e avaliação periódica dos benefícios entregues à sociedade.",
  "A expansão solar e eólica recebeu apoio majoritário, acompanhada de ressalvas sobre transmissão, armazenamento e estabilidade do sistema. Os participantes reconheceram que aumentar capacidade instalada não resolve, isoladamente, gargalos de distribuição e acesso à energia.",
  "As intervenções também mostraram diferenças sobre o ritmo da transição. Uma abordagem propôs metas mais rápidas para aproveitar oportunidades industriais e reduzir emissões. Outra priorizou previsibilidade regulatória e transição gradual, evitando impactos sobre tarifas e atividades econômicas dependentes de fontes convencionais.",
  "No campo institucional, houve pedidos de transparência para critérios de licenciamento, incentivos e monitoramento. Indicadores de emprego local, redução de emissões, custo da energia e impacto territorial foram sugeridos como base para revisões anuais das políticas.",
  "A audiência não produziu acordo sobre todos os instrumentos, mas aproximou posições em três pontos: necessidade de qualificação profissional, transparência na aplicação de recursos e participação social desde as fases iniciais dos projetos. Permaneceram abertas as discussões sobre poder de veto comunitário e extensão dos incentivos públicos.",
  "Como encaminhamento, recomendou-se consolidar as contribuições em uma proposta com metas graduais, mecanismos de avaliação e responsabilidades distribuídas entre União, estados, municípios, empresas e comunidades. A comissão deverá solicitar dados adicionais antes de deliberar sobre fontes e condições de financiamento.",
];

const summaryReferences: Record<number, Array<{ speaker: string; minute: string; quote: string }>> = {
  0: [{ speaker: "Ana Martins", minute: "00:08", quote: "Esta transição precisa começar pelos trabalhadores." }],
  1: [{ speaker: "Carla Nogueira", minute: "00:35", quote: "Não estamos propondo um cheque em branco para qualquer projeto." }],
  2: [{ speaker: "Ana Martins", minute: "00:24", quote: "Os novos empregos precisam chegar primeiro a quem vive no território." }],
  3: [{ speaker: "Diego Ramos", minute: "00:35", quote: "Precisamos combinar participação com responsabilidade técnica." }],
  5: [{ speaker: "Bruno Almeida", minute: "00:15", quote: "Ampliar renováveis exige olhar também para rede e armazenamento." }],
  7: [{ speaker: "Fábio Lima", minute: "00:54", quote: "Sem indicadores, não saberemos quais incentivos entregaram resultado." }],
  8: [{ speaker: "Elisa Ferreira", minute: "00:48", quote: "Transparência e consulta precisam começar antes da decisão tomada." }],
};

const summaryReferenceNumbers: Record<number, number> = { 0: 1, 1: 2, 2: 3, 3: 4, 5: 5, 7: 6, 8: 7 };

function SummaryTab() {
  const [level, setLevel] = useState(1);
  const visibleParagraphs = level === 1 ? summaryParagraphs.slice(0, 2) : level === 2 ? summaryParagraphs.slice(0, 6) : summaryParagraphs;
  const pages = level >= 3 ? [visibleParagraphs.slice(0, 5), visibleParagraphs.slice(5)] : [visibleParagraphs];
  const labels = ["Abstract", "1 página", "2 páginas", "2 páginas + citações"];
  return <section role="tabpanel" aria-label="Resumo textual com níveis de detalhamento" className="min-h-[calc(100vh-61px)] bg-[#f1f0ec] px-5 py-8 lg:px-8"><div className="mx-auto max-w-[1500px]"><div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Síntese da audiência</p><h2 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Resumo com níveis de detalhamento</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">Ajuste o controle para alternar entre uma visão rápida e uma análise completa com referências às falas.</p></div><div className="w-full rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:w-[460px]"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Nível {level} de 4</span><span className="text-sm font-semibold text-orange-600">{labels[level - 1]}</span></div><input type="range" min="1" max="4" step="1" value={level} onChange={(event) => setLevel(Number(event.target.value))} aria-label="Nível de detalhamento do resumo" className="timeline-range w-full cursor-pointer" style={{ "--progress": `${((level - 1) / 3) * 100}%` } as React.CSSProperties}/><div className="mt-3 grid grid-cols-4 gap-2 text-center text-[10px] text-zinc-400">{labels.map((label, index) => <button key={label} onClick={() => setLevel(index + 1)} className={level === index + 1 ? "font-bold text-zinc-900" : "hover:text-zinc-700"}>{label}</button>)}</div></div></div><div className={`mx-auto grid max-w-6xl gap-6 ${pages.length === 2 ? "xl:grid-cols-2" : "max-w-3xl"}`}>{pages.map((paragraphs, pageIndex) => <article key={pageIndex} className={`relative bg-white px-8 py-10 shadow-[0_12px_45px_rgba(24,24,27,0.09)] sm:px-12 sm:py-14 ${level === 1 ? "min-h-[520px]" : "min-h-[760px]"}`}><div className="mb-8 border-b border-zinc-200 pb-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">Audiência pública · Transição energética</p><h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Síntese dos debates e encaminhamentos</h3></div><div className="space-y-5">{paragraphs.map((paragraph) => { const paragraphIndex = summaryParagraphs.indexOf(paragraph); return <p key={paragraphIndex} className="text-[14px] leading-7 text-zinc-700">{paragraph}{level === 4 && summaryReferences[paragraphIndex]?.map((reference, index) => <CitationHover key={`${reference.speaker}-${index}`} number={(summaryReferenceNumbers[paragraphIndex] ?? 0) + index} reference={reference}/>)}</p>; })}</div><footer className="absolute inset-x-8 bottom-7 flex items-center justify-between border-t border-zinc-100 pt-4 text-[10px] text-zinc-400 sm:inset-x-12"><span>Ideias em Rede</span><span>{pageIndex + 1} / {pages.length}</span></footer></article>)}</div>{level === 4 && <p className="mx-auto mt-5 max-w-6xl text-center text-xs text-zinc-500">Passe o mouse ou use o foco do teclado sobre as referências numeradas para consultar a fala original.</p>}</div></section>;
}

function CitationHover({ number, reference }: { number: number; reference: { speaker: string; minute: string; quote: string } }) {
  return <span className="group relative ml-1 inline-block align-super"><button type="button" aria-label={`Ver fala de ${reference.speaker}`} className="rounded bg-orange-100 px-1 py-0.5 text-[9px] font-bold text-orange-700 outline-none hover:bg-orange-200 focus:ring-2 focus:ring-orange-400">{number}</button><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-72 -translate-x-1/2 rounded-lg bg-zinc-900 p-3 text-left text-xs font-normal leading-5 text-white shadow-xl group-hover:block group-focus-within:block"><strong className="block text-orange-300">{reference.speaker} · {reference.minute}</strong><span className="mt-1 block text-zinc-300">“{reference.quote}”</span><span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900"/></span></span>;
}
