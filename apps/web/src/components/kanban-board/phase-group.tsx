import { type ReactNode, useId } from "react";

type PhaseGroupProps = {
  phase: string | null;
  children: ReactNode;
};

// Pegasus fork (PEGA-170): a phase heading over its run of columns. Columns
// without a phase keep the heading's height so every column starts level.
export function PhaseGroup({ phase, children }: PhaseGroupProps) {
  const headingId = useId();

  if (!phase) {
    return (
      <div className="flex h-full shrink-0 flex-col gap-2">
        <div aria-hidden="true" className="h-6 shrink-0" />
        <div className="flex min-h-0 flex-1 gap-4">{children}</div>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="flex h-full shrink-0 flex-col gap-2"
    >
      <h2
        id={headingId}
        className="flex h-6 shrink-0 items-center gap-2 border-b border-border/70 px-1 text-xs font-medium text-muted-foreground"
      >
        <span className="truncate">{phase}</span>
      </h2>
      <div className="flex min-h-0 flex-1 gap-4">{children}</div>
    </div>
  );
}
