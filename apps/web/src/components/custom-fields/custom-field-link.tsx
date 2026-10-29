import type { ComponentProps, SyntheticEvent } from "react";
import type { CustomFieldType } from "@/components/project/custom-fields/types";
import { stopCardEvents } from "@/components/task-chips/stop-card-events";
import { cn } from "@/lib/cn";
import { customFieldHref } from "./custom-field-href";

type CustomFieldLinkProps = Omit<
  ComponentProps<"a">,
  "href" | "target" | "rel" | "type"
> & {
  type: CustomFieldType;
  value: string;
};

const stopEvent = (event: SyntheticEvent) => event.stopPropagation();

/**
 * Links a field value: a `url` opens in a new tab, an `email` or `phone`
 * value opens the mail or phone app. Values that don't fit their type render
 * as plain text, so stored data can never become a script link. Stops click,
 * pointer, mouse, touch and key events so a link on a card neither opens nor
 * drags the card.
 */
export function CustomFieldLink({
  type,
  value,
  className,
  children,
  ...props
}: CustomFieldLinkProps) {
  const link = customFieldHref(type, value);
  if (!link) return <span className={className}>{children}</span>;

  return (
    <a
      href={link.href}
      {...(link.external && { target: "_blank", rel: "noopener noreferrer" })}
      {...stopCardEvents}
      // The board's mouse sensor listens to mousedown, not pointerdown.
      onMouseDown={stopEvent}
      onKeyDown={stopEvent}
      className={cn(
        "underline decoration-muted-foreground/50 underline-offset-2 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}
