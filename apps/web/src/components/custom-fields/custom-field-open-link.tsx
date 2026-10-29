import { ExternalLink, type LucideIcon, Mail, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CustomFieldType } from "@/components/project/custom-fields/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { customFieldHref } from "./custom-field-href";
import { CustomFieldLink } from "./custom-field-link";

type CustomFieldOpenLinkProps = {
  fieldName: string;
  type: CustomFieldType;
  value: string;
  className?: string;
};

// Pegasus fork (PEGA-86): email and phone values call or write instead.
const ACTIONS: Partial<
  Record<CustomFieldType, { icon: LucideIcon; label: string }>
> = {
  url: { icon: ExternalLink, label: "tasks:customFields.openLink" },
  email: { icon: Mail, label: "tasks:customFields.sendEmail" },
  phone: { icon: Phone, label: "tasks:customFields.callNumber" },
};

/**
 * Icon link next to an editable link, email or phone value. It sits beside
 * the edit button rather than inside it, because a link cannot live inside a
 * button.
 */
export function CustomFieldOpenLink({
  fieldName,
  type,
  value,
  className,
}: CustomFieldOpenLinkProps) {
  const { t } = useTranslation();
  const action = ACTIONS[type];
  if (!action || !customFieldHref(type, value)) return null;

  const label = t(action.label, { field: fieldName });
  const Icon = action.icon;

  return (
    <CustomFieldLink
      type={type}
      value={value}
      aria-label={label}
      title={label}
      // An outlined icon button (PEGA-86), so calling or writing reads as an
      // action next to the value and is a full touch target on phones.
      className={cn(
        buttonVariants({ variant: "outline", size: "icon" }),
        "no-underline",
        className,
      )}
    >
      <Icon aria-hidden="true" />
    </CustomFieldLink>
  );
}
