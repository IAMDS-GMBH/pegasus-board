import type { ComponentProps, SyntheticEvent } from "react";
import { stopCardEvents } from "@/components/task-chips/stop-card-events";
import { cn } from "@/lib/cn";
import { normalizeCustomFieldUrl } from "./custom-field-url";

type CustomFieldLinkProps = Omit<
  ComponentProps<"a">,
  "href" | "target" | "rel"
> & {
  value: string;
};

const stopEvent = (event: SyntheticEvent) => event.stopPropagation();

/**
 * Opens a `url` field value in a new tab. Values that are not http(s) links
 * render as plain text, so stored data can never become a script link. Stops
 * click, pointer, mouse, touch and key events so a link on a card neither
 * opens nor drags the card.
 */
export function CustomFieldLink({
  value,
  className,
  children,
  ...props
}: CustomFieldLinkProps) {
  const href = normalizeCustomFieldUrl(value);
  if (!href) return <span className={className}>{children}</span>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
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
