import { useTranslation } from "react-i18next";
import type { CardField } from "./card-fields";
import { CheckboxMark } from "./checkbox-mark";
import { CustomFieldLink } from "./custom-field-link";
import { formatCustomFieldValue } from "./format-custom-field-value";

/**
 * Pegasus fork (PEGA-88): the card's "label: value" preview. Shows every field
 * the admin put on the card, truncated to the card width, with no hover-only
 * parts so it reads the same on a phone.
 */
export function CardFieldRows({ fields }: { fields: CardField[] }) {
  const { t } = useTranslation();

  if (fields.length === 0) return null;

  return (
    <dl className="mt-2 grid grid-cols-[fit-content(40%)_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs leading-[18px]">
      {fields.map((field) => {
        const display = formatCustomFieldValue(
          field.type,
          field.value,
          "medium",
        );

        return (
          <div key={field.fieldId} className="contents">
            <dt className="truncate text-muted-foreground" title={field.name}>
              {field.name}
            </dt>
            <dd className="flex min-w-0 items-center gap-1 text-board-title">
              {field.type === "boolean" ? (
                <>
                  <CheckboxMark checked className="size-3" />
                  <span className="sr-only">
                    {t("settings:customFields.checked")}
                  </span>
                </>
              ) : field.type === "url" ? (
                <CustomFieldLink
                  value={field.value}
                  className="truncate"
                  title={field.value}
                >
                  {display?.text}
                </CustomFieldLink>
              ) : (
                <span className="truncate" title={display?.text}>
                  {display?.text}
                </span>
              )}
              {!!display?.more && (
                <span className="shrink-0 text-muted-foreground">
                  +{display.more}
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
