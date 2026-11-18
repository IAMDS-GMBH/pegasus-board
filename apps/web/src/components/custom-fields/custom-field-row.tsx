import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { PropertyRow } from "@/components/task/properties/property-row";
import { PropertyValue } from "@/components/task/properties/property-value";
import { CheckboxMark } from "./checkbox-mark";
import { CustomFieldOpenLink } from "./custom-field-open-link";
import { CustomFieldPopover } from "./custom-field-popover";
import { formatCustomFieldValue } from "./format-custom-field-value";

type CustomFieldRowProps = {
  field: CustomFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function CustomFieldRow({
  field,
  value,
  onChange,
  disabled = false,
}: CustomFieldRowProps) {
  const { t } = useTranslation();
  // Pegasus fork (PEGA-123): only the Pegasus Hub sets these values.
  const locked = !!field.hubManaged;
  const readOnly = disabled || locked;
  const lockHint = locked ? t("tasks:customFields.hubManaged") : undefined;

  if (field.type === "boolean") {
    const checked = value === "true";
    return (
      <PropertyRow label={field.name}>
        <PropertyValue
          role="checkbox"
          aria-checked={checked}
          aria-label={field.name}
          title={lockHint}
          disabled={readOnly}
          onClick={() => onChange(checked ? "false" : "true")}
        >
          <CheckboxMark checked={checked} />
        </PropertyValue>
      </PropertyRow>
    );
  }

  const display = formatCustomFieldValue(field.type, value, "medium");
  // Pegasus fork (PEGA-123): notes keep their line breaks.
  const multiline = field.type === "text" && value.includes("\n");
  const button = (
    <PropertyValue
      disabled={readOnly}
      aria-label={field.name}
      title={lockHint}
      className={multiline ? "h-auto min-h-7.5 items-start py-1.5" : undefined}
    >
      {display ? (
        <>
          <span
            className={multiline ? "whitespace-pre-line" : "truncate"}
            title={display.text}
          >
            {display.text}
          </span>
          {!!display.more && (
            <span className="shrink-0 text-muted-foreground">
              +{display.more}
            </span>
          )}
        </>
      ) : (
        <span className="truncate font-normal text-muted-foreground/70">
          {t("tasks:customFields.empty")}
        </span>
      )}
      {locked && (
        <Lock
          data-hub-lock
          aria-hidden="true"
          className="ml-auto size-3 shrink-0 text-muted-foreground/70"
        />
      )}
    </PropertyValue>
  );

  return (
    <PropertyRow label={field.name} align={multiline ? "start" : "center"}>
      {readOnly ? (
        button
      ) : (
        <CustomFieldPopover
          field={field}
          value={value}
          onChange={onChange}
          side="left"
        >
          {button}
        </CustomFieldPopover>
      )}
      <CustomFieldOpenLink
        fieldName={field.name}
        type={field.type}
        value={value}
        className="ml-1"
      />
    </PropertyRow>
  );
}
