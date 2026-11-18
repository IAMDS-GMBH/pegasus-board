export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "dropdown"
  | "boolean"
  | "multiselect"
  | "url"
  // Pegasus fork (PEGA-86): rendered as mailto: and tel: links.
  | "email"
  | "phone";

export type CustomFieldDefinition = {
  id: string;
  projectId: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
  defaultValue: string | null;
  options: string[] | null;
  position: number;
  showOnCard: boolean;
  // Pegasus fork (PEGA-123): group in the detail view; fields the Pegasus Hub
  // owns (definition) and sets (value). Optional for older responses.
  section?: string | null;
  hubDefined?: boolean;
  hubManaged?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FieldKind = Exclude<CustomFieldType, "multiselect">;
