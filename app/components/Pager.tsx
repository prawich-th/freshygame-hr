"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Remembers the cursor of each page visited so a cursor-paginated list can go back as well as forward. */
export function useCursorPages() {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  return {
    cursor: cursors[cursors.length - 1],
    page: cursors.length,
    next: (cursor: string) => setCursors(previous => [...previous, cursor]),
    previous: () => setCursors(previous => previous.length > 1 ? previous.slice(0, -1) : previous),
    reset: () => setCursors([null]),
  };
}

export function Pager({ page, hasNext, loading, onPrevious, onNext }: { page: number; hasNext: boolean; loading: boolean; onPrevious: () => void; onNext: () => void }) {
  if (page === 1 && !hasNext) return null;
  return <nav className="pager" aria-label="Pages">
    <button type="button" className="button button--ghost" disabled={page === 1 || loading} onClick={onPrevious}><ChevronLeft size={14} /> Previous</button>
    <span aria-live="polite">Page {page}</span>
    <button type="button" className="button button--ghost" disabled={!hasNext || loading} onClick={onNext}>Next <ChevronRight size={14} /></button>
  </nav>;
}
