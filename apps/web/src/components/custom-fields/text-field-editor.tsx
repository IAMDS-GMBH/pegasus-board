import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { Kbd } from "@/components/ui/kbd";
import { TEXT_FIELD_INPUTS } from "./text-field-inputs";

type TextFieldEditorProps = {
  field: CustomFieldDefinition;
  draft: string;
  invalid?: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
};

export function TextFieldEditor({
  field,
  draft,
  invalid = false,
  onDraftChange,
  onSubmit,
}: TextFieldEditorProps) {
  const { t } = useTranslation();
  const input = TEXT_FIELD_INPUTS[field.type];
  const errorId = useId();
  // Pegasus fork (PEGA-123): text holds notes with several lines; Enter adds
  // a line and Ctrl/⌘+Enter saves.
  const multiline = field.type === "text";
  const shared = {
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? errorId : undefined,
    "aria-label": field.name,
    value: draft,
    placeholder: field.defaultValue || field.name,
    onChange: (event: { target: { value: string } }) =>
      onDraftChange(event.target.value),
  };

  return (
    <div className={multiline ? "w-80" : "w-64"}>
      {multiline ? (
        <textarea
          autoFocus
          rows={3}
          {...shared}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey))
              return;
            event.preventDefault();
            onSubmit();
          }}
          className="field-sizing-content block max-h-64 min-h-20 w-full resize-none bg-transparent px-3 py-2.5 text-[13px] text-foreground leading-5 outline-none placeholder:text-muted-foreground"
        />
      ) : (
        <input
          autoFocus
          type={input?.type ?? "text"}
          inputMode={input?.inputMode}
          {...shared}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            onSubmit();
          }}
          className="h-10 w-full bg-transparent px-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
      )}
      <div className="flex items-center justify-between gap-2 border-border/80 border-t px-3 py-2 text-muted-foreground text-xs">
        {invalid ? (
          <span
            id={errorId}
            role="alert"
            className="text-destructive-foreground"
          >
            {input?.invalidKey && t(input.invalidKey)}
          </span>
        ) : (
          <span>
            {field.required ? t("tasks:customFields.required") : null}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Kbd>
            {t(
              multiline
                ? "tasks:customFields.modEnterKey"
                : "tasks:customFields.enterKey",
            )}
          </Kbd>
          {t("tasks:customFields.toSave")}
        </span>
      </div>
    </div>
  );
}
