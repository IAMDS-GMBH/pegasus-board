import { Plus } from "lucide-react";
import { type FocusEvent, type KeyboardEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ColumnIconPicker } from "@/components/project/columns/column-icon-picker";
import { Switch } from "@/components/ui/switch";
import { getColumnIcon } from "@/lib/column";

export type NewColumn = {
  name: string;
  icon: string;
  phase?: string;
  isLocked?: boolean;
  isRestricted?: boolean;
};

type AddColumnRowProps = {
  phaseSuggestionsId: string;
  onCreate: (column: NewColumn) => Promise<boolean>;
};

const DEFAULT_ICON = "Circle";

export function AddColumnRow({
  phaseSuggestionsId,
  onCreate,
}: AddColumnRowProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [phase, setPhase] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);
  const [saving, setSaving] = useState(false);
  const pickerOpen = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setEditing(false);
    setName("");
    setIcon(DEFAULT_ICON);
    setPhase("");
    setIsLocked(false);
    setIsRestricted(false);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    // Pegasus fork (PEGA-170): a phase, the lock and the restriction only
    // when set.
    const created = await onCreate({
      name: trimmed,
      icon,
      ...(phase.trim() && { phase: phase.trim() }),
      ...(isLocked && { isLocked }),
      ...(isRestricted && { isRestricted }),
    });
    setSaving(false);
    if (created) {
      setName("");
      setIcon(DEFAULT_ICON);
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (pickerOpen.current || name.trim() || phase.trim()) return;
    if (event.currentTarget.contains(event.relatedTarget)) return;
    close();
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex h-11 w-full items-center gap-2.5 px-4 text-left text-sm text-muted-foreground outline-none transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:bg-accent/40 focus-visible:text-foreground"
      >
        <span aria-hidden="true" className="w-3.5 shrink-0" />
        <span className="flex size-7 shrink-0 items-center justify-center">
          <Plus aria-hidden="true" className="size-3.5" />
        </span>
        {t("settings:columnEditor.addColumn")}
      </button>
    );
  }

  return (
    <div onBlur={handleBlur} className="flex h-12 items-center gap-2.5 px-4">
      <span aria-hidden="true" className="w-3.5 shrink-0" />
      <ColumnIconPicker
        selected={icon}
        label={t("settings:columnEditor.pickIconTitle")}
        onSelect={setIcon}
        onOpenChange={(open) => {
          pickerOpen.current = open;
          if (!open) inputRef.current?.focus();
        }}
      >
        {getColumnIcon("", false, icon)}
      </ColumnIconPicker>
      <input
        ref={inputRef}
        autoFocus
        value={name}
        readOnly={saving}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("settings:columnEditor.newColumnPlaceholder")}
        aria-label={t("settings:columnEditor.newColumnPlaceholder")}
        className="-ml-2 h-7.5 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none placeholder:text-muted-foreground/72 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24 dark:bg-input/32"
      />
      <input
        value={phase}
        list={phaseSuggestionsId}
        readOnly={saving}
        onChange={(event) => setPhase(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("settings:columnEditor.phasePlaceholder")}
        aria-label={t("settings:columnEditor.newColumnPhaseAria")}
        className="h-7.5 w-32 min-w-0 shrink-0 rounded-md border border-input bg-background px-2 text-sm outline-none placeholder:text-muted-foreground/72 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24 sm:w-64 dark:bg-input/32"
      />
      <div className="flex w-13 shrink-0 justify-center">
        <Switch
          checked={isLocked}
          onCheckedChange={setIsLocked}
          aria-label={t("settings:columnEditor.newColumnLockedAria")}
        />
      </div>
      <div className="flex w-13 shrink-0 justify-center">
        <Switch
          checked={isRestricted}
          onCheckedChange={setIsRestricted}
          aria-label={t("settings:columnEditor.newColumnRestrictedAria")}
        />
      </div>
      <span aria-hidden="true" className="w-13 shrink-0" />
      <span aria-hidden="true" className="w-7 shrink-0" />
    </div>
  );
}
