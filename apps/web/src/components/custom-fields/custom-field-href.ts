import type { CustomFieldType } from "@/components/project/custom-fields/types";
import { normalizeCustomFieldEmail } from "./custom-field-email";
import { customFieldPhoneHref } from "./custom-field-phone";
import { normalizeCustomFieldUrl } from "./custom-field-url";

const LINK_TYPES: CustomFieldType[] = ["url", "email", "phone"];

/** Whether values of this type render as links. */
export function isLinkFieldType(type: CustomFieldType) {
  return LINK_TYPES.includes(type);
}

export type CustomFieldHref = { href: string; external: boolean };

/**
 * Where a field value links to: a web link opens a new tab, an email or phone
 * value opens the mail or phone app (PEGA-86). `null` when the type has no
 * link or the stored value doesn't fit it, so it renders as plain text.
 */
export function customFieldHref(
  type: CustomFieldType,
  value: string,
): CustomFieldHref | null {
  if (type === "url") {
    const href = normalizeCustomFieldUrl(value);
    return href ? { href, external: true } : null;
  }
  if (type === "email") {
    const email = normalizeCustomFieldEmail(value);
    return email ? { href: `mailto:${email}`, external: false } : null;
  }
  if (type === "phone") {
    const href = customFieldPhoneHref(value);
    return href ? { href, external: false } : null;
  }
  return null;
}
