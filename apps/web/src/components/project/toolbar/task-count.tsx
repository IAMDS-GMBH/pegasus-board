import { useTranslation } from "react-i18next";

// Pegasus fork (PEGA-89): `total` is unknown while the server filters the
// board, so only the shown count is rendered then.
export function TaskCount({
  shown,
  total,
}: {
  shown: number;
  total: number | undefined;
}) {
  const { t } = useTranslation();

  return (
    <span className="hidden truncate text-xs text-muted-foreground tabular-nums sm:inline">
      {total === undefined
        ? t("tasks:toolbar.taskCount", { count: shown })
        : shown === total
          ? t("tasks:toolbar.taskCount", { count: total })
          : t("tasks:toolbar.shownCount", { shown, count: total })}
    </span>
  );
}
