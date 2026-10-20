import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { CustomFieldLink } from "./custom-field-link";
import { normalizeCustomFieldUrl } from "./custom-field-url";

type CustomFieldOpenLinkProps = {
  fieldName: string;
  value: string;
  className?: string;
};

/**
 * Icon link next to an editable `url` value. It sits beside the edit button
 * rather than inside it, because a link cannot live inside a button.
 */
export function CustomFieldOpenLink({
  fieldName,
  value,
  className,
}: CustomFieldOpenLinkProps) {
  const { t } = useTranslation();
  const label = t("tasks:customFields.openLink", { field: fieldName });
  if (!normalizeCustomFieldUrl(value)) return null;

  return (
    <CustomFieldLink
      value={value}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </CustomFieldLink>
  );
}
