"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import {
  getReactNodeText,
  selectOptionMatchesQuery,
} from "@/lib/selectSearch";
import SelectSearchInput from "@/components/shared/SelectSearchInput";

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  const isControlled = Object.prototype.hasOwnProperty.call(props, "value");
  const normalizedProps = isControlled
    ? { ...props, value: props.value ?? "" }
    : props;
  return <SelectPrimitive.Root data-slot="select" {...normalizedProps} />;
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function elementTypeName(type: unknown): string | undefined {
  if (typeof type === "function" || (typeof type === "object" && type !== null)) {
    const t = type as { displayName?: string; name?: string };
    return t.displayName ?? t.name;
  }
  return undefined;
}

function isType(child: React.ReactElement, component: unknown, name: string): boolean {
  return child.type === component || elementTypeName(child.type) === name;
}

/**
 * Filtra hijos de SelectContent por query (SelectItem / SelectGroup).
 * Oculta labels/separadores mientras hay búsqueda activa.
 */
function filterSelectChildren(
  children: React.ReactNode,
  query: string
): { nodes: React.ReactNode; matchCount: number } {
  let matchCount = 0;

  function walk(nodes: React.ReactNode): React.ReactNode[] {
    return React.Children.toArray(nodes).flatMap((child) => {
      if (!React.isValidElement(child)) {
        return [child];
      }

      if (isType(child, SelectItem, "SelectItem")) {
        const props = child.props as {
          value?: string;
          textValue?: string;
          children?: React.ReactNode;
        };
        const label =
          (typeof props.textValue === "string" && props.textValue.trim() !== ""
            ? props.textValue
            : getReactNodeText(props.children)) || String(props.value ?? "");
        if (!selectOptionMatchesQuery(label, query)) {
          return [];
        }
        matchCount += 1;
        return [child];
      }

      if (isType(child, SelectGroup, "SelectGroup")) {
        const props = child.props as { children?: React.ReactNode };
        const nextChildren = walk(props.children);
        const hasItem = nextChildren.some(
          (c) => React.isValidElement(c) && isType(c, SelectItem, "SelectItem")
        );
        if (!hasItem) {
          return [];
        }
        return [React.cloneElement(child, { children: nextChildren } as never)];
      }

      if (child.type === React.Fragment) {
        const props = child.props as { children?: React.ReactNode };
        return walk(props.children);
      }

      if (isType(child, SelectLabel, "SelectLabel")) {
        return [];
      }
      if (isType(child, SelectSeparator, "SelectSeparator")) {
        return [];
      }

      const props = child.props as { children?: React.ReactNode };
      if (props.children != null) {
        return [
          React.cloneElement(child, {
            children: walk(props.children),
          } as never),
        ];
      }
      return [child];
    });
  }

  return { nodes: walk(children), matchCount };
}

type SelectContentProps = React.ComponentProps<typeof SelectPrimitive.Content> & {
  /**
   * Muestra input **BUSCAR...** como primer elemento y filtra opciones.
   * Default `true` (regla transversal de la app). Solo desactivar en casos excepcionales documentados.
   */
  searchable?: boolean;
  /** Placeholder del buscador (MAYÚSCULAS). */
  searchPlaceholder?: string;
};

function SelectContent({
  className,
  children,
  position = "popper",
  side = "bottom",
  align = "start",
  searchable = true,
  searchPlaceholder = "BUSCAR...",
  onCloseAutoFocus,
  ...props
}: SelectContentProps) {
  const [query, setQuery] = React.useState("");

  const { nodes, matchCount } = React.useMemo(() => {
    if (!searchable || !query.trim()) {
      return { nodes: children, matchCount: null as number | null };
    }
    return filterSelectChildren(children, query);
  }, [children, query, searchable]);

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        data-searchable={searchable ? "true" : "false"}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-[90] min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden rounded-md border shadow-md",
          // Usa todo el alto disponible bajo el trigger (no limitar a la altura del trigger).
          "max-h-[var(--radix-select-content-available-height)]",
          searchable ? "flex flex-col overflow-hidden" : "overflow-y-auto",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        side={side}
        align={align}
        onCloseAutoFocus={(event) => {
          setQuery("");
          onCloseAutoFocus?.(event);
        }}
        {...props}
      >
        {searchable ? (
          <div className="shrink-0 border-b border-border bg-popover p-1">
            <SelectSearchInput
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
              autoFocus
            />
          </div>
        ) : null}
        <div
          className={cn(
            searchable
              ? "min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
              : undefined
          )}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.Viewport
            className={cn(
              "p-1",
              // Ancho = trigger; sin altura fija para mostrar la mayor cantidad de opciones posible.
              position === "popper" &&
                "w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1"
            )}
          >
            {nodes}
            {searchable && query.trim() && matchCount === 0 ? (
              <div
                className="px-2 py-1.5 text-sm text-muted-foreground"
                role="status"
              >
                SIN RESULTADOS
              </div>
            ) : null}
          </SelectPrimitive.Viewport>
          <SelectScrollDownButton />
        </div>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  );
}
SelectLabel.displayName = "SelectLabel";

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
SelectItem.displayName = "SelectItem";

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}
SelectSeparator.displayName = "SelectSeparator";

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

SelectGroup.displayName = "SelectGroup";
SelectContent.displayName = "SelectContent";

export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
};
