import { useNavigate } from "@tanstack/react-router";
import { type Dispatch, type SetStateAction, useEffect } from "react";
import { setSubjectNegated } from "@/lib/task-filters/set-subject-negated";
import { type BoardFilters, DUE_DATE_FILTER_VALUES } from "./use-task-filters";

// Pegasus fork (PEGA-66): the start page's "alle anzeigen" opens the board
// with `?filter=overdue`. Board filters live in local storage, so the param
// only seeds them once and then leaves the URL.
export function useOverdueFilterFromSearch(
  filter: string | undefined,
  setFilters: Dispatch<SetStateAction<BoardFilters>>,
) {
  const navigate = useNavigate();

  useEffect(() => {
    if (filter !== DUE_DATE_FILTER_VALUES.overdue) return;
    setFilters((prev) => ({
      ...prev,
      dueDate: [DUE_DATE_FILTER_VALUES.overdue],
      negated: setSubjectNegated(prev.negated, "dueDate", false),
    }));
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        filter: undefined,
      }),
      replace: true,
    });
  }, [filter, setFilters, navigate]);
}
