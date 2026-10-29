import {
  CalendarIcon,
  Hash,
  Link,
  List,
  type LucideIcon,
  Mail,
  Phone,
  SquareCheck,
  Type,
} from "lucide-react";
import type {
  CustomFieldType,
  FieldKind,
} from "@/components/project/custom-fields/types";

export const FIELD_KIND_ICONS: Record<FieldKind, LucideIcon> = {
  text: Type,
  number: Hash,
  date: CalendarIcon,
  dropdown: List,
  boolean: SquareCheck,
  url: Link,
  // Pegasus fork (PEGA-86)
  email: Mail,
  phone: Phone,
};

export const FIELD_KINDS = (Object.keys(FIELD_KIND_ICONS) as FieldKind[]).map(
  (kind) => ({ kind, icon: FIELD_KIND_ICONS[kind] }),
);

export function toFieldKind(type: CustomFieldType): FieldKind {
  return type === "multiselect" ? "dropdown" : type;
}

// Pegasus fork (PEGA-86): the API lets these switch into each other.
const TEXT_KINDS: FieldKind[] = ["text", "email", "phone"];

/** The kinds an existing field of `kind` can be changed to. */
export function switchableKinds(kind: FieldKind): FieldKind[] {
  return TEXT_KINDS.includes(kind) ? TEXT_KINDS : [kind];
}
