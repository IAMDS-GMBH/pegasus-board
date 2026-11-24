import { type KeyboardEvent, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type ColumnPhaseInputProps = {
  phase: string | null;
  label: string;
  placeholder: string;
  suggestionsId: string;
  readOnly?: boolean;
  onChange: (phase: string | null) => Promise<boolean> | boolean;
};

// Pegasus fork (PEGA-170): free text with the project's phases as native
// suggestions. Commits on blur or Enter; blank text clears the phase.
export function ColumnPhaseInput({
  phase,
  label,
  placeholder,
  suggestionsId,
  readOnly = false,
  onChange,
}: ColumnPhaseInputProps) {
  const current = phase ?? "";
  const [draft, setDraft] = useState(current);
  const [synced, setSynced] = useState(current);
  const cancelled = useRef(false);

  if (current !== synced) {
    setSynced(current);
    setDraft(current);
  }

  const commit = async () => {
    const trimmed = draft.trim();
    if (cancelled.current || trimmed === current) {
      cancelled.current = false;
      setDraft(current);
      return;
    }

    setDraft(trimmed);
    if (!(await onChange(trimmed || null))) setDraft(current);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelled.current = true;
      event.currentTarget.blur();
    }
  };

  return (
    <input
      value={draft}
      list={suggestionsId}
      title={current || undefined}
      aria-label={label}
      placeholder={readOnly ? undefined : placeholder}
      readOnly={readOnly}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={handleKeyDown}
      className={cn(
        "h-7.5 w-32 min-w-0 shrink-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-muted-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/56 sm:w-64",
        !readOnly &&
          "hover:border-input focus-visible:border-ring focus-visible:bg-background focus-visible:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/24 dark:focus-visible:bg-input/32",
      )}
    />
  );
}
