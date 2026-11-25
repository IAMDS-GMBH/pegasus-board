import { DUE_DATE_FILTER_VALUES } from "@/hooks/use-task-filters";

export const DUE_DATE_OPTIONS = [
  // Pegasus fork (PEGA-66): first, the filter a Führungskraft reaches for.
  {
    value: DUE_DATE_FILTER_VALUES.overdue,
    labelKey: "tasks:backlog.filters.overdue",
  },
  {
    value: DUE_DATE_FILTER_VALUES.dueThisWeek,
    labelKey: "tasks:backlog.filters.dueThisWeek",
  },
  {
    value: DUE_DATE_FILTER_VALUES.dueNextWeek,
    labelKey: "tasks:backlog.filters.dueNextWeek",
  },
  {
    value: DUE_DATE_FILTER_VALUES.noDueDate,
    labelKey: "tasks:backlog.filters.noDueDate",
  },
] as const;
