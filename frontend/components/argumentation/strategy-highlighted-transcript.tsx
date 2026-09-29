import type { ApproachClassification } from "@/lib/persuasion-api";
import { superclassColors, superclassNames } from "@/lib/persuasion";

type StrategySpan = {
  annotationId: string;
  superclass: string;
  start: number;
  end: number;
  explanation: string;
};

function displayName(value: string) {
  return value.replaceAll("_", " ").replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

export function StrategyHighlightedTranscript({
  text,
  classification,
}: {
  text: string;
  classification?: ApproachClassification | null;
}) {
  const superclassSpans: StrategySpan[] = classification?.superclass_classifications?.flatMap((item, itemIndex) =>
    item.span_offsets.filter(
      (span): span is { start: number; end: number } => span.start != null && span.end != null,
    ).map((span) => ({
      ...span,
      annotationId: `super-${itemIndex}`,
      superclass: item.superclass,
      explanation: item.explanation,
    })),
  ) ?? [];

  const spans = superclassSpans
    .filter((span) => span.start >= 0 && span.end <= text.length && span.start < span.end);
  if (!spans.length) return <>{text}</>;

  const boundaries = Array.from(new Set([
    0,
    text.length,
    ...spans.flatMap((span) => [span.start, span.end]),
    ...(classification?.segmentation?.segments.flatMap((paragraph) => [paragraph.start, paragraph.end]) ?? []),
  ])).sort((a, b) => a - b);

  return <>{boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    const active = spans.filter((span) => span.start < end && span.end > start);
    const segment = text.slice(start, end);
    const paragraphIndex = classification?.segmentation?.segments.find(
      (paragraph) => start >= paragraph.start && start < paragraph.end,
    )?.index;
    if (!active.length) return (
      <span
        className={paragraphIndex === undefined ? undefined : "transcriptParagraphSegment"}
        data-paragraph-index={paragraphIndex}
        key={`${start}-${end}`}
      >
        {segment}
      </span>
    );
    const title = active.map((span) => [
      `Classe: ${superclassNames[span.superclass] ?? displayName(span.superclass)}`,
      `Justificativa: ${span.explanation}`,
    ].join("\n")).join("\n\n");
    const highlightIds = Array.from(new Set(active.map((span) => span.annotationId))).join(" ");
    return (
      <mark
        className={`persuasionHighlight${paragraphIndex === undefined ? "" : " transcriptParagraphSegment"}`}
        data-highlight-ids={highlightIds}
        data-paragraph-index={paragraphIndex}
        key={`${start}-${end}`}
        title={title}
        style={{
          backgroundColor: superclassColors[active[0].superclass] ?? "#e5e7eb",
          borderBottomColor: superclassColors[active[1]?.superclass ?? active[0].superclass] ?? "#9ca3af",
        }}
      >
        {segment}
      </mark>
    );
  })}</>;
}
