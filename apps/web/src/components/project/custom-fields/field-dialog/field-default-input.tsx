import { useTranslation } from "react-i18next";
import { TEXT_FIELD_INPUTS } from "@/components/custom-fields/text-field-inputs";
import { CheckboxDefaultSelect } from "@/components/project/custom-fields/field-dialog/checkbox-default-select";
import { ChoiceDefaultSelect } from "@/components/project/custom-fields/field-dialog/choice-default-select";
import { DateDefaultPicker } from "@/components/project/custom-fields/field-dialog/date-default-picker";
import type { FieldFormState } from "@/components/project/custom-fields/field-dialog/field-form";
import { MultiChoiceDefaultSelect } from "@/components/project/custom-fields/field-dialog/multi-choice-default-select";
import { Input } from "@/components/ui/input";

type FieldDefaultInputProps = {
  form: FieldFormState;
  labelledBy: string;
  onChange: (
    defaults: Pick<FieldFormState, "defaultValue" | "defaultValues">,
  ) => void;
};

export function FieldDefaultInput({
  form,
  labelledBy,
  onChange,
}: FieldDefaultInputProps) {
  const { t } = useTranslation();
  const setValue = (defaultValue: string) =>
    onChange({ defaultValue, defaultValues: form.defaultValues });

  switch (form.kind) {
    case "boolean":
      return (
        <CheckboxDefaultSelect
          value={form.defaultValue}
          labelledBy={labelledBy}
          onChange={setValue}
        />
      );
    case "date":
      return (
        <DateDefaultPicker
          value={form.defaultValue}
          labelledBy={labelledBy}
          clearable={!form.required}
          onChange={setValue}
        />
      );
    case "dropdown":
      return form.multiple ? (
        <MultiChoiceDefaultSelect
          options={form.options}
          value={form.defaultValues}
          labelledBy={labelledBy}
          onChange={(defaultValues) =>
            onChange({ defaultValue: "", defaultValues })
          }
        />
      ) : (
        <ChoiceDefaultSelect
          options={form.options}
          value={form.defaultValue}
          labelledBy={labelledBy}
          clearable={!form.required}
          onChange={setValue}
        />
      );
    default:
      return (
        <Input
          size="sm"
          type={TEXT_FIELD_INPUTS[form.kind]?.type ?? "text"}
          inputMode={TEXT_FIELD_INPUTS[form.kind]?.inputMode}
          value={form.defaultValue}
          aria-labelledby={labelledBy}
          placeholder={t("settings:customFields.noDefault")}
          onChange={(event) => setValue(event.target.value)}
          className="sm:w-48"
        />
      );
  }
}
