import {
  Calendar,
  Hash,
  Link,
  List,
  type LucideIcon,
  Mail,
  Phone,
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
  email: Mail,
  phone: Phone,
};

export function customFieldIcon(type: CustomFieldType): LucideIcon {
  return ICONS[type] ?? Type;
}
