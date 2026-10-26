// Pegasus fork (PEGA-90): DayPicker texts in the UI language. Built on Intl
// through formatDate, so no date-fns locale bundles are needed.
import type { TFunction } from "i18next";
import type { DayPickerProps } from "react-day-picker";
import { formatDate } from "@/lib/format";

const monthYear = (month: Date) =>
  formatDate(month, { month: "long", year: "numeric" });

export function dayPickerText(
  t: TFunction,
): Pick<DayPickerProps, "formatters" | "labels"> {
  return {
    formatters: {
      formatCaption: monthYear,
      formatWeekdayName: (day) => formatDate(day, { weekday: "short" }),
    },
    labels: {
      labelGrid: monthYear,
      labelWeekday: (day) => formatDate(day, { weekday: "long" }),
      labelDayButton: (day, modifiers) => {
        const label = formatDate(day, { dateStyle: "full" });
        return modifiers.today
          ? `${t("tasks:calendar.today")}, ${label}`
          : label;
      },
      labelPrevious: () => t("tasks:calendar.previousMonth"),
      labelNext: () => t("tasks:calendar.nextMonth"),
      labelNav: () => t("tasks:calendar.monthNavigation"),
    },
  };
}
