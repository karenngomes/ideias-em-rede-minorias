"use client";

import type { FocusEvent, MouseEvent, PointerEvent, ReactNode } from "react";
import { useRef } from "react";

function highlight(row: HTMLTableRowElement, annotationId: string | null) {
  const marks = row.querySelectorAll<HTMLElement>(".persuasionHighlight");
  row.classList.toggle("isHighlightFiltering", Boolean(annotationId));
  marks.forEach((mark) => {
    const ids = (mark.dataset.highlightIds ?? "").split(" ");
    mark.classList.toggle("isHighlightFocused", Boolean(annotationId && ids.includes(annotationId)));
  });
}

function targetFrom(element: EventTarget | null) {
  return element instanceof Element
    ? element.closest<HTMLElement>("[data-highlight-target], [data-paragraph-target]")
    : null;
}

function focusParagraph(row: HTMLTableRowElement, paragraphIndex: string | null) {
  const segments = row.querySelectorAll<HTMLElement>(".transcriptParagraphSegment");
  row.classList.toggle("isParagraphFiltering", paragraphIndex !== null);
  segments.forEach((segment) => {
    segment.classList.toggle(
      "isParagraphFocused",
      paragraphIndex !== null && segment.dataset.paragraphIndex === paragraphIndex,
    );
  });
}

export function ClassificationHoverRow({ children }: { children: ReactNode }) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const pinnedAnnotationRef = useRef<string | null>(null);

  function activate(event: PointerEvent<HTMLTableRowElement> | FocusEvent<HTMLTableRowElement>) {
    const target = targetFrom(event.target);
    const annotationId = target?.dataset.highlightTarget;
    if (annotationId && rowRef.current) highlight(rowRef.current, annotationId);
  }

  function deactivate(event: PointerEvent<HTMLTableRowElement> | FocusEvent<HTMLTableRowElement>) {
    const target = targetFrom(event.target);
    const related = targetFrom(event.relatedTarget);
    if (target && target !== related && rowRef.current) {
      highlight(rowRef.current, pinnedAnnotationRef.current);
    }
  }

  function centerEvidence(event: MouseEvent<HTMLTableRowElement>) {
    const target = targetFrom(event.target);
    const annotationId = target?.dataset.highlightTarget;
    const paragraphIndex = target?.dataset.paragraphTarget ?? null;
    const row = rowRef.current;
    if (!row) return;
    if (!target) {
      pinnedAnnotationRef.current = null;
      row.classList.remove("isHighlightPinned");
      highlight(row, null);
      focusParagraph(row, null);
      return;
    }

    const evidence = annotationId
      ? Array.from(row.querySelectorAll<HTMLElement>(".persuasionHighlight"))
          .find((mark) => (mark.dataset.highlightIds ?? "").split(" ").includes(annotationId))
      : undefined;
    const paragraph = paragraphIndex === null
      ? undefined
      : Array.from(row.querySelectorAll<HTMLElement>(".transcriptParagraphSegment"))
          .find((segment) => segment.dataset.paragraphIndex === paragraphIndex);
    const destination = evidence ?? paragraph;
    if (!destination) return;

    pinnedAnnotationRef.current = annotationId ?? null;
    row.classList.toggle("isHighlightPinned", Boolean(annotationId));
    highlight(row, annotationId ?? null);
    focusParagraph(row, paragraphIndex);
    destination.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }

  return (
    <tr
      className="interactiveClassificationRow"
      ref={rowRef}
      onPointerOver={activate}
      onPointerOut={deactivate}
      onFocus={activate}
      onBlur={deactivate}
      onClick={centerEvidence}
    >
      {children}
    </tr>
  );
}
