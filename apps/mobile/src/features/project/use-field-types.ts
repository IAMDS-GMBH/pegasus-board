import { useTranslation } from "react-i18next";

export function useFieldTypes() {
  const { t } = useTranslation(["mobile"]);
  return [
    { value: "text", label: t("mobile:projectSettings.text") },
    { value: "number", label: t("mobile:projectSettings.number") },
    { value: "date", label: t("mobile:projectSettings.date") },
    { value: "boolean", label: t("mobile:projectSettings.checkbox") },
    { value: "dropdown", label: t("mobile:projectSettings.dropdown") },
    { value: "multiselect", label: t("mobile:projectSettings.multiSelect") },
    { value: "url", label: t("mobile:projectSettings.url") },
    { value: "email", label: t("mobile:projectSettings.email") },
    { value: "phone", label: t("mobile:projectSettings.phone") },
  ] as const;
}
