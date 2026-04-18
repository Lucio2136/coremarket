import { useState, useCallback } from "react";

const KEY = "quotr_saved_markets";

function readSaved(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeSaved(ids: Set<string>) {
  localStorage.setItem(KEY, JSON.stringify([...ids]));
}

export function useSavedMarkets() {
  const [saved, setSaved] = useState<Set<string>>(() => readSaved());

  const isSaved = useCallback((id: string) => saved.has(id), [saved]);

  const toggleSave = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeSaved(next);
      return next;
    });
  }, []);

  return { saved, isSaved, toggleSave, savedCount: saved.size };
}
