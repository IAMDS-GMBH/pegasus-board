import { format, isValid, parseISO } from "date-fns";
import { Clock } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DatePickerMenu } from "@/components/common/date-picker/date-picker-menu";
import { Input } from "@/components/ui/input";
import { berlinDateTimeToIso, isoToBerlinParts } from "./custom-field-date";

type DateFieldEditorProps = {
  name: string;
  value: string;
  required: boolean;
  onSelect: (value: string) => void;
};

// Pegasus fork (PEGA-123): the day plus an optional time in German time
// (the Hub's appointment). With a time the value is stored as UTC ISO 8601,
// without one as a plain day.
function toValue(day: string, time: string) {
  return time ? berlinDateTimeToIso(day, time) : day;
}

export function DateFieldEditor({
  name,
  value,
  required,
  onSelect,
}: DateFieldEditorProps) {
  const { t } = useTranslation();
  const stored = isoToBerlinParts(value);
  const parsed = stored.date ? parseISO(stored.date) : null;
  const selected = parsed && isValid(parsed) ? parsed : null;
  const [time, setTime] = useState(stored.time);

  return (
    <>
      <DatePickerMenu
        label={name}
        placeholder={t("tasks:datePicker.datePlaceholder")}
        clearLabel={t("tasks:customFields.clear")}
        value={selected}
        onChange={(date) =>
          onSelect(date ? toValue(format(date, "yyyy-MM-dd"), time) : "")
        }
        canClear={!required && selected !== null}
      />
      <label className="flex items-center gap-2 border-border border-t px-3 py-2 text-muted-foreground text-xs">
        <Clock aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="shrink-0">{t("tasks:customFields.time")}</span>
        <Input
          type="time"
          size="sm"
          value={time}
          aria-label={t("tasks:customFields.time")}
          className="ml-auto w-28"
          onChange={(event) => setTime(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !selected) return;
            event.preventDefault();
            onSelect(toValue(stored.date, event.currentTarget.value));
          }}
        />
      </label>
    </>
  );
}
