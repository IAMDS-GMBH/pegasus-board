import {
  Calendar,
  Hash,
  Link,
  List,
  type LucideIcon,
  SquareCheck,
  SquareChevronDown,
  Type,
} from "lucide-react";
import type { CustomFieldType } from "@/components/project/custom-fields/types";

const ICONS: Record<CustomFieldType, LucideIcon> = {
  text: Type,
  number: Hash,
  date: Calendar,
  dropdown: SquareChevronDown,
  boolean: SquareCheck,
  multiselect: List,
  url: Link,
};

export function customFieldIcon(type: CustomFieldType): LucideIcon {
  return ICONS[type] ?? Type;
}
